import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { getUsersInfo, initialSetupActivities } from '../components/Utilities'; 
import { Device } from '@capacitor/device';
import PouchDB from 'pouchdb';
import { getTokenInfo, refreshToken, errorCheckCreds , checkJWT, checkDBUUID, getPrefsDBCreds, isAPIServerAvailable } from "./RemoteUtilities";
import { useTranslation } from 'react-i18next';    
import { UserIDList } from "./DataTypes";
import { cloneDeep } from "lodash";
import log from "loglevel";
import { useHistory } from "react-router";

const secondsBeforeAccessRefresh = 180;

let globalSync: PouchDB.Replication.Sync<{}>;
let globalRemoteDB: PouchDB.Database<{}> | undefined = undefined;

export type RemoteDBState = {
    sync: PouchDB.Replication.Sync<{}> | null,
    deviceUUID: string | null,
    accessJWT: string,
    accessJWTExpirationTime: Number,
    syncStatus: SyncStatus,
    connectionStatus: ConnectionStatus,
    initialSyncStarted: boolean,
    initialSyncComplete: boolean,
    dbUUIDAction: DBUUIDAction,
    credsError: boolean,
    credsErrorText: string,
    serverAvailable: boolean,
    workingOffline: boolean,
    offlineJWTMatch: boolean,
    loggedIn: boolean,
}

export enum LoginType {
    unknown = "U",
    autoLoginFromRoot = "R",
    autoLoginSpecificURL = "S",
    loginFromLoginPage = "L"
}

export interface RemoteDBStateContextType {
    remoteDBState: RemoteDBState,
    remoteDBCreds: DBCreds,
    remoteDB: PouchDB.Database, 
    setRemoteDBState: React.Dispatch<React.SetStateAction<RemoteDBState>>,
    setRemoteDBCreds: (newCreds: DBCreds) => void,
    stopSyncAndCloseRemote: () => Promise<boolean>,
    assignDB: (accessJWT: string) => Promise<boolean>,
    setDBCredsValue: (key: string, value: string|null) => void,
    setConnectionStatus: (value: ConnectionStatus) => void,
    setLoginType: (lType: LoginType) => void,
    attemptFullLogin: () => Promise<[boolean,string]>
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
    initialSyncStarted: false,
    initialSyncComplete: false,
    dbUUIDAction: DBUUIDAction.none,
    credsError: false,
    credsErrorText: "",
    serverAvailable: true,
    workingOffline: false,
    offlineJWTMatch: false,
    loggedIn: false,
}

const initialContext = {
    remoteDBState: initialRemoteDBState,
    remoteDBCreds: DBCredsInit,
    remoteDB: {},
    setRemoteDBState: (state: RemoteDBState ) => {},
    setRemoteDBCreds: (dbCreds: DBCreds) => {},
    stopSyncAndCloseRemote: async () => {return false},
    assignDB: async (accessJWT: string): Promise<boolean> => {return false},
    setDBCredsValue: (key: string, value: string | null) => {},
    setConnectionStatus: (value: ConnectionStatus) => {},
    setLoginType: (lType: LoginType) => {},
    attemptFullLogin: async (): Promise<[boolean,string]> => {return [false,""]}
}

export const RemoteDBStateContext = createContext(initialContext)

type RemoteDBStateProviderProps = {
    children: React.ReactNode;
}

export const RemoteDBStateProvider: React.FC<RemoteDBStateProviderProps> = (props: RemoteDBStateProviderProps) => {
    const [remoteDBState,setRemoteDBState] = useState<RemoteDBState>(initialRemoteDBState);
    const loginAttempted = useRef(false);
    const loginType = useRef<LoginType>(LoginType.autoLoginSpecificURL);
    const remoteDBCreds = useRef<DBCreds>(DBCredsInit);
    const [, forceUpdateState] = React.useState<{}>();
    const forceUpdate = React.useCallback(() => forceUpdateState({}), []);
    const db=usePouch();
    const { t } = useTranslation();
    const history = useHistory()

    function setLoginType(lType: LoginType) {
        loginType.current = lType;
    }

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
        setPrefsDBCreds();
        forceUpdate();
    }

    function setConnectionStatus(value: ConnectionStatus) {
        log.debug("Update Connection Status:",value);
        setRemoteDBState(prevState => ({...prevState, connectionStatus: value}));
    }

    function startSync() {
        log.debug("Starting sync of database",cloneDeep(globalRemoteDB));
        globalSync = db.sync((globalRemoteDB as PouchDB.Database), {
            back_off_function: function(delay) {
                log.debug("Initial sync going offline");
                setSyncStatus(SyncStatus.offline);
                if (delay===0) {return 1000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: false,
            }).on('paused', () => {  log.debug("Initial sync paused"); setSyncStatus(SyncStatus.paused)})
            .on('active', () => { log.debug("Initial sync active"); setSyncStatus(SyncStatus.active)})
            .on('complete',() => {log.debug("Initial sync complete"); liveSync()})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied); log.debug("Initial sync denied: ",{err})})
            .on('error', (err) => { log.debug("initial error state",{err}) ; 
                                globalSync.cancel();
                                setSyncStatus(SyncStatus.error);
                                });
        setRemoteDBState(prevState=>({...prevState,initialSyncStarted: true}))
    }

    function liveSync() {
        log.debug("Starting live sync of database",cloneDeep(globalRemoteDB));
        setRemoteDBState(prevState=>({...prevState,initialSyncComplete: true}));
        globalSync = db.sync((globalRemoteDB as PouchDB.Database), {
            back_off_function: function(delay) {
                log.debug("live sync going offline");
                setSyncStatus(SyncStatus.offline);
                if (delay===0) {return 1000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: true,
            }).on('paused', () => {  log.debug("live sync paused"); setSyncStatus(SyncStatus.paused)})
            .on('active', () => { log.debug("live sync active"); setSyncStatus(SyncStatus.active)})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied); log.debug("live sync denied: ",{err})})
            .on('error', (err) => { log.debug("live sync error state",{err}) ; 
                                globalSync.cancel();
                                setSyncStatus(SyncStatus.error);
                                })
    }

    async function setPrefsDBCreds() {
        let credsStr = JSON.stringify(remoteDBCreds.current);
        await Preferences.set({key: 'dbcreds', value: credsStr})  
    }

    async function stopSyncAndCloseRemote() {
        let success=true;
        if (globalRemoteDB !== undefined && globalRemoteDB !== null) {
            log.debug("RemoteDB already exists, closing before assign.");
            if (globalSync !== undefined && globalSync !== null) {
                globalSync.cancel();
            }
            globalRemoteDB.removeAllListeners();
            globalRemoteDB.close();
            await new Promise(r => setTimeout(r,2000));
            globalRemoteDB = undefined;
        }
        return success;
    }

    async function assignDB(accessJWT: string): Promise<boolean> {
        log.debug("Assigning Database/setting sync, access Token is:",accessJWT);
        log.debug("Login Type is : ",loginType.current);
        stopSyncAndCloseRemote();
        globalRemoteDB = new PouchDB(remoteDBCreds.current.couchBaseURL+"/"+remoteDBCreds.current.database, 
            { fetch: (url, opts) => ( 
                fetch(url, { ...opts, credentials: 'include', headers:
                { ...opts?.headers, 'Authorization': 'Bearer '+accessJWT, 'Content-type': 'application/json' }})
            )})
        log.debug("Initiated GlobalRemoteDB to: ",cloneDeep(globalRemoteDB));
        globalRemoteDB.setMaxListeners(40);    
        setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.dbAssigned, 
                accessJWT: accessJWT }));  
        setPrefsDBCreds(); 
        return true;
    }

    async function CheckDBUUIDAndStartSync() {
        let DBUUIDCheck = await checkDBUUID(db as PouchDB.Database,globalRemoteDB as PouchDB.Database);
        if (!DBUUIDCheck.checkOK) {
            log.debug("Did not pass DB unique ID check.");
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_dbuuid") , dbUUIDAction: DBUUIDCheck.dbUUIDAction, connectionStatus: ConnectionStatus.navToLoginScreen}))
        } else {
            await initialSetupActivities(globalRemoteDB as PouchDB.Database,remoteDBCreds.current.dbUsername as string)
            log.debug("DB Unique ID check passed. Setup Activities complete. Starting Sync.");
            startSync();
        }
    }

    async function attemptFullLogin() : Promise<[success: boolean,errorText: string]>{
        const devIDInfo = await Device.getId();
        log.debug("Attempt Full Login: Getting device ID...", cloneDeep(devIDInfo));
        let devID = "";
        if (devIDInfo.hasOwnProperty('identifier')) {
            devID = devIDInfo.identifier;
        }
        setRemoteDBState(prevState => ({...prevState,deviceUUID: devID}));
        let credsObj = await getPrefsDBCreds(remoteDBCreds.current);
        remoteDBCreds.current = credsObj;
        let apiServerAvailable = await isAPIServerAvailable(remoteDBCreds.current); 
        if (!apiServerAvailable) {
            // validate you have a refreshJWT matching userid
            let validJWTMatch = false;
            if (credsObj.refreshJWT !== null) {
                let JWTResponse = getTokenInfo(credsObj.refreshJWT);
                if (JWTResponse.valid && credsObj.dbUsername === JWTResponse.username) {
                    validJWTMatch = true;
                }
            }            
            // if you do, present a work offline option
            setRemoteDBState(prevState => ({...prevState,serverAvailable: false, offlineJWTMatch: validJWTMatch, credsError: true, credsErrorText: t("error.could_not_contact_api_server"), connectionStatus: ConnectionStatus.navToLoginScreen}))
            return [false,t("error.could_not_contact_api_server")];
        }
        let credsCheck =  errorCheckCreds({credsObj: credsObj, background: true});
        log.debug("Attempt Full Login: credsCheck:",credsCheck);
        if (credsCheck.credsError) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: credsCheck.errorText, connectionStatus: ConnectionStatus.navToLoginScreen}))
            return [false,credsCheck.errorText];
        } 
        let refreshResponse = await refreshToken(credsObj as DBCreds,devID);
        log.debug("Refresh Token Response:",refreshResponse);
        if (refreshResponse === undefined) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.could_not_contact_api_server") , serverAvailable: false  ,connectionStatus: ConnectionStatus.navToLoginScreen}));
            return [false,t("error.could_not_contact_api_server")];
        }
        if (!refreshResponse.data.valid) {
            credsObj.refreshJWT = "";
            remoteDBCreds.current = credsObj;
            await setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_jwt_token") , connectionStatus: ConnectionStatus.navToLoginScreen}));
            return [false,t("error.invalid_jwt_token")];
        }
        remoteDBCreds.current = credsObj;
        remoteDBCreds.current.refreshJWT = refreshResponse.data.refreshJWT;
        let JWTCheck = await checkJWT(refreshResponse.data.accessJWT,credsObj as DBCreds);
        if (!JWTCheck.DBServerAvailable) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, serverAvailable: false  ,credsErrorText: t("error.db_server_not_available") , connectionStatus: ConnectionStatus.navToLoginScreen}))
            return [false,t("error.db_server_not_available")];
        }
        await setPrefsDBCreds();
        if (!JWTCheck.JWTValid) {
            remoteDBCreds.current.refreshJWT = "";
            setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_jwt_token"), connectionStatus: ConnectionStatus.navToLoginScreen}))
             return [false,t("error.invalid_jwt_token")];
        }
        let userIDList: UserIDList = { userIDs: [String(remoteDBCreds.current.dbUsername)] }
        let userInfo = await getUsersInfo(userIDList,String(remoteDBCreds.current.apiServerURL),refreshResponse?.data.accessJWT)
        if (userInfo.length > 0) {
            remoteDBCreds.current.email = userInfo[0].email;
            remoteDBCreds.current.fullName = userInfo[0].fullname;
            setPrefsDBCreds();
        }
        setRemoteDBState(prevState => ({...prevState, accessJWT: refreshResponse?.data.accessJWT, accessJWTExpirationTime: JWTCheck.JWTExpireDate, loggedIn: true}));
        await assignDB(refreshResponse.data.accessJWT);
        log.debug("assign DB complete : logintype:",loginType.current);
        return [true,""];
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

    useEffect( () => {console.log("Conn status changed, now:",cloneDeep(remoteDBState.connectionStatus))},[remoteDBState.connectionStatus])

    useEffect(() => {
        if (!loginAttempted.current && !(remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) && !(remoteDBState.connectionStatus === ConnectionStatus.onLoginScreen)) {
            log.debug("STATUS: about to attempt full login...");
            attemptFullLogin()
            loginAttempted.current = true;
        }
      },[loginAttempted,remoteDBState.connectionStatus])
  
    useEffect(() => {
        log.debug("Connection Status:",cloneDeep(remoteDBState.connectionStatus));
        if (remoteDBState.connectionStatus === ConnectionStatus.dbAssigned) {
            CheckDBUUIDAndStartSync();
        }
    },[remoteDBState.connectionStatus])

    useEffect( () => {
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen &&
            loginType.current === LoginType.autoLoginSpecificURL) {
                history.push("/login");
            }
    },[remoteDBState.connectionStatus])

    useEffect(() => {
        if (( remoteDBState.initialSyncComplete) && (remoteDBState.connectionStatus !== ConnectionStatus.initialNavComplete)) {
            log.debug("setting to login complete after initial sync and not nav complete...");
            if (loginType.current === LoginType.autoLoginSpecificURL) {
                setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.initialNavComplete}))
            } else {
                setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.loginComplete}));
            }    
        }
        if (remoteDBState.syncStatus === SyncStatus.error) {
            log.error("ERROR syncing, refreshing access token and retrying...");
            retrySync();
        }
    },[remoteDBState.initialSyncComplete,remoteDBState.syncStatus,remoteDBState.connectionStatus])

    useEffect(() => {
        if (remoteDBState.accessJWTExpirationTime === 0) {return;}
        const secondsToRefresh = Number(remoteDBState.accessJWTExpirationTime) - (Math.round(Date.now() / 1000)) - secondsBeforeAccessRefresh;
        log.info("JWT expires in seconds:",secondsToRefresh);
        const refreshTimer = setTimeout(() => {
            log.info("Refreshing token now...");
            refreshTokenAndUpdate();
        }, secondsToRefresh*1000);
        return () => clearTimeout(refreshTimer);
    },[remoteDBState.accessJWTExpirationTime])

    let value: RemoteDBStateContextType = {remoteDBState, remoteDBCreds: remoteDBCreds.current, remoteDB: globalRemoteDB as PouchDB.Database<{}> , setRemoteDBState, setRemoteDBCreds,
            stopSyncAndCloseRemote, assignDB, setDBCredsValue, setConnectionStatus, setLoginType, attemptFullLogin};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}