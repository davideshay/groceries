import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { initialSetupActivities } from '../components/Utilities'; 
import { Device } from '@capacitor/device';
import PouchDB from 'pouchdb';
import { getTokenInfo, refreshToken, errorCheckCreds , checkJWT, checkDBUUID, getPrefsDBCreds } from "./RemoteUtilities";
import { useTranslation } from 'react-i18next';    

const secondsBeforeAccessRefresh = 180;

let globalSync: PouchDB.Replication.Sync<{}>;
let globalRemoteDB: PouchDB.Database | undefined = undefined;

export type RemoteDBState = {
    sync: PouchDB.Replication.Sync<{}> | null,
    deviceUUID: string | null,
    accessJWT: string,
    accessJWTExpirationTime: Number,
    syncStatus: SyncStatus,
    connectionStatus: ConnectionStatus,
    dbUUIDAction: DBUUIDAction,
    credsError: boolean,
    credsErrorText: string,
    serverAvailable: boolean,
    workingOffline: boolean
}

export interface RemoteDBStateContextType {
    remoteDBState: RemoteDBState,
    remoteDBCreds: DBCreds,
    remoteDB: PouchDB.Database,
    setRemoteDBState: React.Dispatch<React.SetStateAction<RemoteDBState>>,
    setRemoteDBCreds: (newCreds: DBCreds) => void,
    startSync: () => void,
    assignDB: (accessJWT: string) => Promise<boolean>,
    setDBCredsValue: (key: string, value: string|null) => void,
    setConnectionStatus: (value: ConnectionStatus) => void
}

export enum SyncStatus {
    init = 0,
    active = 1,
    paused = 2,
    error = 3,
    denied = 4,
    offline = 5
  }

export enum DBUUIDAction {
    none = 0,
    exit_app_schema_mismatch = 1,
    exit_local_remote_schema_mismatch = 2,
    exit_no_uuid_on_server = 3,
    destroy_needed = 4
}  

export type DBUUIDCheck = {
    checkOK: boolean,
    schemaVersion: Number,
    dbUUIDAction: DBUUIDAction
}

export type CredsCheck = {
    credsError: boolean,
    errorText: string
}

export enum ConnectionStatus {
    cannotStart = 0,
    retry = 1,
    dbAssigned = 2,
    navToLoginScreen = 12,
    onLoginScreen = 13,
    loginComplete = 14,
    initialNavComplete = 15
}

export interface DBCreds {
    apiServerURL: string | null,
    couchBaseURL: string | null,
    database: string | null,
    dbUsername: string | null,
    email: string | null,
    fullName: string | null,
    refreshJWT: string | null,
    lastConflictsViewed: string | null;
}

export const DBCredsInit: DBCreds = {
    apiServerURL: null, couchBaseURL: null, database: null,
    dbUsername: null, email: null, fullName: null, refreshJWT: null, lastConflictsViewed: null
}

export const initialRemoteDBState: RemoteDBState = {
    sync: null,
    deviceUUID: null,
    accessJWT: "",
    accessJWTExpirationTime: 0,
    syncStatus: SyncStatus.init,
    connectionStatus: ConnectionStatus.cannotStart,
    dbUUIDAction: DBUUIDAction.none,
    credsError: false,
    credsErrorText: "",
    serverAvailable: true,
    workingOffline: false
}

const initialContext = {
    remoteDBState: initialRemoteDBState,
    remoteDBCreds: DBCredsInit,
    remoteDB: {},
    setRemoteDBState: (state: RemoteDBState ) => {},
    setRemoteDBCreds: (dbCreds: DBCreds) => {},
    startSync: () => {},
    assignDB: async (accessJWT: string): Promise<boolean> => {return false},
    setDBCredsValue: (key: string, value: string | null) => {},
    setConnectionStatus: (value: ConnectionStatus) => {},
}

export const RemoteDBStateContext = createContext(initialContext)

type RemoteDBStateProviderProps = {
    children: React.ReactNode;
}

export const RemoteDBStateProvider: React.FC<RemoteDBStateProviderProps> = (props: RemoteDBStateProviderProps) => {
    const [remoteDBState,setRemoteDBState] = useState<RemoteDBState>(initialRemoteDBState);
    const loginAttempted = useRef(false);
    const remoteDBCreds = useRef<DBCreds>(DBCredsInit);
    const [, forceUpdateState] = React.useState<{}>();
    const forceUpdate = React.useCallback(() => forceUpdateState({}), []);
    const db=usePouch();
    const { t } = useTranslation();

    function setSyncStatus(status: number) {
        setRemoteDBState(prevState => ({...prevState,syncStatus: status}))
    }

    function setDBCredsValue(key: string, value: string | null) { 
        (remoteDBCreds.current as any)[key] = value;
        setPrefsDBCreds();
        forceUpdate();
    }

    function setRemoteDBCreds(newCreds: DBCreds) {
        remoteDBCreds.current = newCreds;
        forceUpdate();
    }

    function setConnectionStatus(value: ConnectionStatus) {
        setRemoteDBState(prevState => ({...prevState, connectionStatus: value}));
    }

    function startSync() {
        globalSync = db.sync((globalRemoteDB as PouchDB.Database), {
            back_off_function: function(delay) {
                console.log("going offline");
                setSyncStatus(SyncStatus.offline);
                if (delay===0) {return 1000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: true,
            }).on('paused', () => { /* console.log("sync paused"); */ setSyncStatus(SyncStatus.paused)})
            .on('active', () => { /* console.log("sync active"); */ setSyncStatus(SyncStatus.active)})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied); console.log("sync denied: ",{err})})
            .on('error', (err) => { console.log ("db.sync error state",{err}) ; 
                                globalSync.cancel();
                                setSyncStatus(SyncStatus.error);
                                })
    }

  
    async function setPrefsDBCreds() {
        let credsStr = JSON.stringify(remoteDBCreds.current);
        await Preferences.set({key: 'dbcreds', value: credsStr})  
    }

    async function assignDB(accessJWT: string): Promise<boolean> {
        if (globalRemoteDB !== undefined) {
            if (!(globalSync === undefined || globalSync === null)) {
                await globalSync.cancel();
            }
            globalRemoteDB.removeAllListeners();
            await globalRemoteDB.close();
            await new Promise(r => setTimeout(r,2000));
            globalRemoteDB = undefined;
        }
        globalRemoteDB = new PouchDB(remoteDBCreds.current.couchBaseURL+"/"+remoteDBCreds.current.database, 
            { fetch: (url, opts) => ( 
                fetch(url, { ...opts, credentials: 'include', headers:
                { ...opts?.headers, 'Authorization': 'Bearer '+accessJWT, 'Content-type': 'application/json' }})
            )})
        globalRemoteDB.setMaxListeners(40);    
        setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.dbAssigned, 
                accessJWT: accessJWT }));  
        setPrefsDBCreds(); 
        return true;
    }

    async function CheckDBUUIDAndStartSync() {
        let DBUUIDCheck = await checkDBUUID(db as PouchDB.Database,globalRemoteDB as PouchDB.Database);
        if (!DBUUIDCheck.checkOK) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_dbuuid") , dbUUIDAction: DBUUIDCheck.dbUUIDAction, connectionStatus: ConnectionStatus.navToLoginScreen}))
        } else {
            await initialSetupActivities(globalRemoteDB as PouchDB.Database,remoteDBCreds.current.dbUsername as string)
            startSync();
        }
    }

    async function attemptFullLogin() {
        const devIDInfo = await Device.getId();
        let devID = "";
        if (devIDInfo.hasOwnProperty('uuid')) {
            devID = devIDInfo.uuid;
        }
        setRemoteDBState(prevState => ({...prevState,deviceUUID: devID}));
        let credsObj = await getPrefsDBCreds(remoteDBCreds.current);
        remoteDBCreds.current = credsObj;
        let credsCheck =  errorCheckCreds({credsObj: credsObj, background: true});
        if (credsCheck.credsError) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: credsCheck.errorText, connectionStatus: ConnectionStatus.navToLoginScreen}))
            return;
        } 
        let refreshResponse = await refreshToken(credsObj as DBCreds,devID);
        if (refreshResponse === undefined) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.could_not_contact_api_server") , connectionStatus: ConnectionStatus.navToLoginScreen}));
            return;
        }
        if (!refreshResponse.data.valid) {
            credsObj.refreshJWT = "";
            remoteDBCreds.current = credsObj;
            await setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_jwt_token") , connectionStatus: ConnectionStatus.navToLoginScreen}));
            return;
        }
        remoteDBCreds.current = credsObj;
        remoteDBCreds.current.refreshJWT = refreshResponse.data.refreshJWT;
        let JWTCheck = await checkJWT(refreshResponse.data.accessJWT,credsObj as DBCreds);
        if (!JWTCheck.DBServerAvailable) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.db_server_not_available") , connectionStatus: ConnectionStatus.navToLoginScreen}))
        }
        await setPrefsDBCreds();
        if (!JWTCheck.JWTValid) {
            remoteDBCreds.current.refreshJWT = "";
            setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error,invalid_jwt_token"), connectionStatus: ConnectionStatus.navToLoginScreen}))
             return;
        }
        setRemoteDBState(prevState => ({...prevState, accessJWT: refreshResponse?.data.accessJWT, accessJWTExpirationTime: JWTCheck.JWTExpireDate}));
        await assignDB(refreshResponse.data.accessJWT);
    }

     async function retrySync() {
         refreshTokenAndUpdate();
     }

    async function refreshTokenAndUpdate() {
        if (remoteDBCreds.current.refreshJWT !== "") {
            let refreshResponse = await refreshToken(remoteDBCreds.current,String(remoteDBState.deviceUUID));
            if (refreshResponse === undefined) {
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.could_not_contact_api_server"), connectionStatus: ConnectionStatus.navToLoginScreen}));
                return;
            }
            if (refreshResponse.data.valid) {
                let tokenInfo = getTokenInfo(refreshResponse.data.accessJWT)
                setRemoteDBState(prevState => ({...prevState, accessJWT: refreshResponse?.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate, connectionStatus: ConnectionStatus.retry}));
                remoteDBCreds.current.refreshJWT = refreshResponse.data.refreshJWT;
                await assignDB(refreshResponse.data.accessJWT);
            }
        } else {
            setRemoteDBState(prevState => ({...prevState, syncStatus: SyncStatus.error}));
        }
    }

    useEffect(() => {
        if (!loginAttempted.current && !(remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) && !(remoteDBState.connectionStatus === ConnectionStatus.onLoginScreen)) {
//            console.log("STATUS: about to attempt full login...");
            attemptFullLogin()
            loginAttempted.current = true;
        }
      },[loginAttempted,remoteDBState.connectionStatus])
  
    useEffect(() => {
        if (remoteDBState.connectionStatus === ConnectionStatus.dbAssigned) {
            CheckDBUUIDAndStartSync();
        }
    },[remoteDBState.connectionStatus])

    useEffect(() => {
        if (( remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) && (remoteDBState.connectionStatus !== ConnectionStatus.initialNavComplete)) {
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.loginComplete}));
        }
        if (remoteDBState.syncStatus === SyncStatus.error) {
            console.log("ERROR syncing, refreshing access token and retrying...");
            retrySync();
        }
    },[remoteDBState.syncStatus,remoteDBState.connectionStatus])

    useEffect(() => {
        if (remoteDBState.accessJWTExpirationTime === 0) {return;}
        const secondsToRefresh = Number(remoteDBState.accessJWTExpirationTime) - (Math.round(Date.now() / 1000)) - secondsBeforeAccessRefresh;
        console.log("STATUS: JWT expires in seconds:",secondsToRefresh);
        const refreshTimer = setTimeout(() => {
            console.log("STATUS: refreshing token now...");
            refreshTokenAndUpdate();
        }, secondsToRefresh*1000);
        return () => clearTimeout(refreshTimer);
    },[remoteDBState.accessJWTExpirationTime])

    let value: RemoteDBStateContextType = {remoteDBState, remoteDBCreds: remoteDBCreds.current, remoteDB: globalRemoteDB as PouchDB.Database<{}> , setRemoteDBState, setRemoteDBCreds, startSync, assignDB, setDBCredsValue, setConnectionStatus};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}