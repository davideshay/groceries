import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import { isJsonString,  DEFAULT_API_URL, apiConnectTimeout, initialSetupActivities } from '../components/Utilities'; 
import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { Device } from '@capacitor/device';
import PouchDB from 'pouchdb';
import { getTokenInfo, refreshToken, errorCheckCreds } from "./RemoteUtilities";
import { maxAppSupportedSchemaVersion, UUIDDoc } from "./DBSchema";

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
    checkDBUUID: () => Promise<DBUUIDCheck>,
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
  
const DBUUIDCheckInit: DBUUIDCheck = {
    checkOK: true,
    schemaVersion: 0,
    dbUUIDAction: DBUUIDAction.none
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
    checkDBUUID: async (remoteDB: PouchDB.Database,credsObj: DBCreds): Promise<DBUUIDCheck> => {return DBUUIDCheckInit },
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

    async function  getPrefsDBCreds()  {
        let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
        let credsObj: DBCreds = cloneDeep(DBCredsInit);
        const credsOrigKeys = keys(credsObj);
        if (isJsonString(String(credsStr))) {
          credsObj=JSON.parse(String(credsStr));
          let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','JWT','refreshJWT','lastConflictsViewed'])
          remoteDBCreds.current = credsObjFiltered;
        }
        const credKeys = keys(remoteDBCreds.current);
        if (remoteDBCreds.current === null || remoteDBCreds.current.apiServerURL === undefined || (!isEqual(credsOrigKeys.sort(),credKeys.sort()))) {
            credsObj = { apiServerURL: DEFAULT_API_URL,
                couchBaseURL: "",
                database: "",
                dbUsername:"",
                refreshJWT: "",
                email: "",
                fullName: "",
                lastConflictsViewed: (new Date()).toISOString()
                };
            remoteDBCreds.current = credsObj;
        }
        return remoteDBCreds.current;
      }
        
    async function checkJWT(accessJWT: string) {
        let checkResponse = {
            JWTValid: false,
            DBServerAvailable: true,
            JWTExpireDate: 0
        }
        let response: HttpResponse | undefined;
        checkResponse.DBServerAvailable = true;
        const options: HttpOptions = {
            url: String(remoteDBCreds.current.couchBaseURL+"/_session"),
            method: "GET",
            headers: { 'Content-Type': 'application/json',
                       'Accept': 'application/json',
                       'Authorization': 'Bearer '+ accessJWT },
            connectTimeout: apiConnectTimeout          
              };
        try { response = await CapacitorHttp.get(options); }
        catch(err) {console.log("Got error:",err); checkResponse.DBServerAvailable=false}
        if (checkResponse.DBServerAvailable) {
            if ((response?.status === 200) && (response.data?.userCtx?.name !== null)) {
                let tokenInfo = getTokenInfo(accessJWT);
                if (tokenInfo.valid) {
                    checkResponse.JWTValid = true;
                    checkResponse.JWTExpireDate = tokenInfo.expireDate;
                }
            } else {
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid JWT credentials"}));
            }
        } else {
            setRemoteDBState(prevState => ({...prevState,serverAvailable: false, credsError: true, credsErrorText: "Database offline"}));
        }
        return checkResponse;
    } 

    async function checkDBUUID() {
        let UUIDCheck: DBUUIDCheck = {
            checkOK: true,
            schemaVersion: 0,
            dbUUIDAction: DBUUIDAction.none
        }
        let UUIDResults = await (globalRemoteDB as PouchDB.Database).find({
            selector: { "type": { "$eq": "dbuuid"} } })
        let UUIDResult : null|string = null;
        if (UUIDResults.docs.length > 0) {
          UUIDResult = (UUIDResults.docs[0] as UUIDDoc).uuid;
        }
        if (UUIDResult == null) {
          UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.exit_no_uuid_on_server;
          return UUIDCheck;
        }
        UUIDCheck.schemaVersion = (UUIDResults.docs[0] as UUIDDoc).schemaVersion;
        let remoteSchemaVersion = Number(UUIDCheck.schemaVersion);
        let localDBInfo = null;
        let localHasRecords = false;
        let localDBUUID = null;
        let localSchemaVersion = 0;
        try { localDBInfo = await db.info();} catch(e) {localHasRecords=false};
        if (localDBInfo != null && localDBInfo.doc_count > 0) { localHasRecords = true}
        if (localHasRecords) {
          let localDBAllDocs = null;
          try { localDBAllDocs = await db.allDocs({include_docs: true});} catch(e) {console.log(e)};
          localHasRecords = false;
          if (localDBAllDocs != null) {
            localDBAllDocs.rows.forEach(row => {
              if ((row.doc as any).language !== "query") {
                    localHasRecords=true;
                }
            });
          }
        }
        if (localHasRecords) {
            let localDBFindDocs = null;
            try { localDBFindDocs = await db.find({selector: { "type": { "$eq": "dbuuid"} }}) }
            catch(e) {console.log(e)};
            if ((localDBFindDocs !== null) && localDBFindDocs.docs.length === 1) {
                localDBUUID = (localDBFindDocs.docs[0] as UUIDDoc).uuid;
                localSchemaVersion = Number((localDBFindDocs.docs[0] as UUIDDoc).schemaVersion);
            }
        }
//        console.log("maxAppSupportedVersion",maxAppSupportedSchemaVersion)
        if (Number(UUIDCheck.schemaVersion) > maxAppSupportedSchemaVersion) {
            UUIDCheck.checkOK = false;
            UUIDCheck.dbUUIDAction = DBUUIDAction.exit_app_schema_mismatch;
            return UUIDCheck;
        }

        // compare to current DBCreds one.
        if (localDBUUID === UUIDResult) {
            // console.log("Schema: remote:",remoteSchemaVersion," local:",localSchemaVersion);
            if (remoteSchemaVersion > localSchemaVersion) {
                console.log("ERROR: Remote Schema greater than local");
                UUIDCheck.checkOK = false;
                UUIDCheck.dbUUIDAction = DBUUIDAction.exit_local_remote_schema_mismatch;
            }   
            return UUIDCheck;
        } 
          // if current DBCreds doesn't have one, set it to the remote one.
        if ((localDBUUID === null || localDBUUID === "" ) && !localHasRecords) {
          return UUIDCheck;
        }
        UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.destroy_needed;
        return UUIDCheck;
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
        let DBUUIDCheck = await checkDBUUID();
        if (!DBUUIDCheck.checkOK) {
            console.log("not check ok, action:",DBUUIDCheck.dbUUIDAction);
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid DBUUID", dbUUIDAction: DBUUIDCheck.dbUUIDAction, connectionStatus: ConnectionStatus.navToLoginScreen}))
        } else {
            await initialSetupActivities(db as PouchDB.Database,remoteDBCreds.current.dbUsername as string)
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
        let credsObj = await getPrefsDBCreds();
        let credsCheck =  errorCheckCreds({credsObj: credsObj, background: true});
        if (credsCheck.credsError) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: credsCheck.errorText, connectionStatus: ConnectionStatus.navToLoginScreen}))
            return;
        } 
        let refreshResponse = await refreshToken(credsObj as DBCreds,devID);
        if (refreshResponse === undefined) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Could not contact API server", connectionStatus: ConnectionStatus.navToLoginScreen}));
            return;
        }
        if (!refreshResponse.data.valid) {
            credsObj.refreshJWT = "";
            remoteDBCreds.current = credsObj;
            await setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid JWT Token", connectionStatus: ConnectionStatus.navToLoginScreen}));
            return;
        }
        remoteDBCreds.current = credsObj;
        remoteDBCreds.current.refreshJWT = refreshResponse.data.refreshJWT;
        let JWTCheck = await checkJWT(refreshResponse.data.accessJWT);
        await setPrefsDBCreds();
        if (!JWTCheck.JWTValid) {
            remoteDBCreds.current.refreshJWT = "";
            setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid JWT Token", connectionStatus: ConnectionStatus.navToLoginScreen}))
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
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Error contacting API server", connectionStatus: ConnectionStatus.navToLoginScreen}));
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

    let value: RemoteDBStateContextType = {remoteDBState, remoteDBCreds: remoteDBCreds.current, remoteDB: globalRemoteDB as PouchDB.Database<{}> , setRemoteDBState, setRemoteDBCreds, startSync, checkDBUUID, assignDB, setDBCredsValue, setConnectionStatus};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}