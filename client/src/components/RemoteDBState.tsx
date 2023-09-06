import React, { createContext, useState, useEffect, useRef, useCallback} from "react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { getUsersInfo, initialSetupActivities } from '../components/Utilities'; 
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import PouchDB from 'pouchdb';
import { getTokenInfo, refreshToken, errorCheckCreds , checkJWT, checkDBUUID, getPrefsDBCreds, isServerAvailable, JWTMatchesUser, getDeviceID } from "./RemoteUtilities";
import { useTranslation } from 'react-i18next';    
import { UserIDList } from "./DataTypes";
import log from "loglevel";
import { useHistory } from "react-router";
import PQueue from "p-queue";
import { Capacitor } from "@capacitor/core";

import { minimumAccessRefreshSeconds } from "./DBSchema";
import { cloneDeep } from "lodash";

const secondsBetweenRefreshRetries = 30;

let globalSync: PouchDB.Replication.Sync<{}>;
let globalRemoteDB: PouchDB.Database<{}> | undefined = undefined;
const queue = new PQueue({concurrency: 1, timeout: 2000});

export type RemoteDBState = {
    sync: PouchDB.Replication.Sync<{}> | null,
    deviceUUID: string | null,
    accessJWT: string,
    accessJWTExpirationTime: Number,
    syncStatus: SyncStatus,
    connectionStatus: ConnectionStatus,
    initialSyncStarted: boolean,
    initialSyncComplete: boolean,
    initialNavComplete: boolean,
    dbUUIDAction: DBUUIDAction,
    credsError: boolean,
    credsErrorText: string,
    forceShowLoginScreen: boolean,
    apiServerAvailable: boolean,
    dbServerAvailable: boolean,
    apiServerVersion: string,
    ignoreAppVersionWarning: boolean,
    workingOffline: boolean,
    offlineJWTMatch: boolean,
    loggedIn: boolean,
    retryCount: number,
    tokenTimerAction: TokenTimerAction,
    dupCheck: DupCheckStatus,
    restartAction: RestartAction
}

enum TokenTimerAction {
    NotStarted = "N",
    NeedToStart = "NS",
    Started = "S",
    NeedToStop = "NST",
    Stopped = "ST",
    NeedToRestart = "NR"
}

export enum RestartAction {
    None = "X",
    RestartNeeded = "N",
    Restarted = "R"
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
    remoteDB: PouchDB.Database | undefined, 
    setRemoteDBState: React.Dispatch<React.SetStateAction<RemoteDBState>>,
    setRemoteDBCreds: (newCreds: DBCreds) => void,
    removeUserInfoDBCreds: (onlyToken: boolean) => Promise<void>,
    stopSyncAndCloseRemote: () => Promise<boolean>,
    restartSync: () => Promise<boolean>,
    assignDB: (accessJWT: string) => Promise<boolean>,
    setDBCredsValue: (key: string, value: string|null) => void,
    setLoginType: (lType: LoginType) => void,
    attemptFullLogin: () => Promise<[boolean,string]>
}

export enum SyncStatus {
    init = 0,
    up = 1,
    down = 2,
    active = up || down,
    paused = 3,
    error = 4,
    denied = 5,
    offline = 6
  }

export enum DBUUIDAction {
    none = 0,
    warning_app_version_mismatch = 1,
    exit_app_schema_mismatch = 2,
    exit_local_remote_schema_mismatch = 3,
    exit_no_uuid_on_server = 4,
    destroy_needed = 5
}  

export enum RefreshTokenResults {
    Failed = 0,
    OK = 1,
    Locked = 2
}

export type DBUUIDCheck = {
    checkOK: boolean,
    dbAvailable: boolean,
    schemaVersion: Number,
    syncListGroupIDs: string[],
    dbUUIDAction: DBUUIDAction,
    errorText: string
}

export type CredsCheck = {
    credsError: boolean,
    errorText: string
}

export enum ConnectionStatus {
    cannotStart = 0,
    retry = 1,
    dbAssigned = 2,
    syncStarted = 3,
    navToLoginScreen = 12,
    onLoginScreen = 13,
    loginComplete = 14,
}

export enum AppStatus {
    pausing = "PG",
    paused = "PD",
    resuming = "RG",
    resumed = "RD"
}

enum BroadcastMessage {
    CheckAlive,
    AmAlive
}

export enum DupCheckStatus {
    channelNeedsRegistered = "CN",
    channelRegistered = "CR",
    messageSent = "MS",
    dupDetected = "DD",
    noDupDetected = "ND"
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
    initialNavComplete: false,
    dbUUIDAction: DBUUIDAction.none,
    credsError: false,
    credsErrorText: "",
    apiServerAvailable: true,
    apiServerVersion: "",
    dbServerAvailable: true,
    ignoreAppVersionWarning: false,
    forceShowLoginScreen: false,
    workingOffline: false,
    offlineJWTMatch: false,
    loggedIn: false,
    retryCount: 0,
    tokenTimerAction: TokenTimerAction.NeedToStart,
    dupCheck: DupCheckStatus.channelNeedsRegistered,
    restartAction: RestartAction.None
}

const initialContext: RemoteDBStateContextType = {
    remoteDBState: initialRemoteDBState,
    remoteDBCreds: DBCredsInit,
    remoteDB: undefined,
    setRemoteDBState: (prevState => (prevState)),
    setRemoteDBCreds: (dbCreds: DBCreds) => {},
    removeUserInfoDBCreds: async (onlyToken: boolean) => {},
    stopSyncAndCloseRemote: async () => {return false},
    restartSync: async () => {return false},
    assignDB: async (accessJWT: string): Promise<boolean> => {return false},
    setDBCredsValue: (key: string, value: string | null) => {},
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
    const syncListGroupIDs = useRef<string[]>([]);
    const [, forceUpdateState] = React.useState<{}>();
    const forceUpdate = React.useCallback(() => forceUpdateState({}), []);
    const db=usePouch();
    const { t } = useTranslation();
    const history = useHistory();
    const refreshTokenLocked = useRef(false);
    const tokenTimer = useRef<NodeJS.Timeout>();
    const retryingNetwork = useRef<boolean>(false);
    const appStatus = useRef<AppStatus>(AppStatus.resumed);
    const broadcastChannel = useRef<BroadcastChannel>(new BroadcastChannel("dupcheck"))

    function setLoginType(lType: LoginType) {
        loginType.current = lType;
    }

    function setSyncStatus(status: number) {
        setRemoteDBState(prevState => ({...prevState,syncStatus: status}))
    }

    const setDBCredsValue = useCallback( async (key: string, value: string | null) => {
       (remoteDBCreds.current as any)[key] = value;
        await setPrefsDBCreds();
        forceUpdate();
    },[forceUpdate])

    async function setRemoteDBCreds(newCreds: DBCreds) {
        remoteDBCreds.current = newCreds;
        await setPrefsDBCreds();
        forceUpdate();
    }

    async function removeUserInfoDBCreds(onlyToken: boolean) {
        let newCreds: DBCreds = remoteDBCreds.current;
        if (onlyToken) {
            newCreds.refreshJWT = ""
        } else {
            newCreds.dbUsername = "";
            newCreds.email = "";
            newCreds.fullName = "";
            newCreds.lastConflictsViewed = new Date().toISOString();
            newCreds.refreshJWT = "";    
        }
        await setRemoteDBCreds(newCreds);
    }

    function setDBServerAvailable(value: boolean) {
        setRemoteDBState(prevState => ({...prevState,dbServerAvailable: value}));
    }

    function registerBroadcastChannel() {
        broadcastChannel.current.onmessage = (event) => {
            if (event.data === BroadcastMessage.CheckAlive) {
                broadcastChannel.current.postMessage(BroadcastMessage.AmAlive);
            } else if (event.data === BroadcastMessage.AmAlive) {
                setRemoteDBState(prevState => ({...prevState,dupCheck: DupCheckStatus.dupDetected}))
            }
        }
        setRemoteDBState(prevState => ({...prevState,dupCheck: DupCheckStatus.channelRegistered}))
    }

    function sendCheckAliveMessage() {
        broadcastChannel.current.postMessage(BroadcastMessage.CheckAlive);
        setRemoteDBState(prevState => ({...prevState,dupCheck: DupCheckStatus.messageSent}))
    }

    const checkRetryNetworkIsUp = useCallback( async () => {
        let netOnline = (await Network.getStatus()).connected;
        log.debug("Network online status:",netOnline);
        if (netOnline) return true;
        if (retryingNetwork.current) return netOnline;
        retryingNetwork.current = true;
        let retryCount = 0;
        let maxRetries = 10;
        let timeBetweenRetries = 2*1000;
        while (retryCount < maxRetries) {
            await new Promise(r => setTimeout(r,timeBetweenRetries));
            netOnline = (await Network.getStatus()).connected;
            if (netOnline) {
                log.debug("Network back online, continuing");
                retryingNetwork.current = false;
                return true
            } else {
                log.debug("Network still not online, retry count:",retryCount);
                retryCount++;
            }
        }
        log.error("Network did not come back online after retrying");
        return false;
    },[])

    const checkTriggers = useCallback( (docs: any) => {
        for (const doc of docs) {
            if (doc.hasOwnProperty("type") && doc.type && doc.type === "trigger") {
                log.debug("Trigger received to restart sync via change...");
                setRemoteDBState(prevState => ({...prevState,restartAction: RestartAction.RestartNeeded}))
                break;
            }
        }
    },[])

    const liveSync = useCallback(() => {
        log.debug("Starting live sync of database");
        if (appStatus.current === AppStatus.paused || appStatus.current === AppStatus.pausing) {
            log.debug("Not starting live sync... App being paused...");
        }
        setRemoteDBState(prevState=>({...prevState,initialSyncComplete: true}));
        let queryParams = {username: remoteDBCreds.current.dbUsername, listgroups: syncListGroupIDs.current};
        try {globalSync = db.sync((globalRemoteDB as PouchDB.Database), {
            filter: 'replfilter/by_user',
            query_params: queryParams,
            back_off_function: function(delay) {
                async function takeAction () {
                    log.debug("live sync going offline: delay: ",delay);
                    setSyncStatus(SyncStatus.offline);
                    setDBServerAvailable(false);
                    await checkRetryNetworkIsUp();
                }
                takeAction();
                if (delay===0) {return 8000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: true,
            }).on('paused', () => {  log.debug("live sync paused");
                                    setSyncStatus(SyncStatus.paused);
                                    setDBServerAvailable(true)})
            .on('active', () => { log.debug("live sync active");
                                    setSyncStatus(SyncStatus.active);
                                    setDBServerAvailable(true)})
            .on('change', (info) => {
                                    info.direction === "push" ? setSyncStatus(SyncStatus.up) : setSyncStatus(SyncStatus.down);  
                                    checkTriggers(info.change.docs)})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied);
//                                    setDBServerAvailable(false)
                                    log.debug("live sync denied: ",{err})})
            .on('error', (err) => { log.debug("live sync error state",{err}) ; 
                                globalSync.cancel();
                                setSyncStatus(SyncStatus.error);
                                setDBServerAvailable(false);
                                })
            }
        catch(err) {log.debug("Error in setting up live sync", err); setSyncStatus(SyncStatus.offline);}                         
    },[db,checkRetryNetworkIsUp,checkTriggers]);

    const beginLiveSync = useCallback( async () => {
        await initialSetupActivities(db,String(remoteDBCreds.current.dbUsername));
        liveSync()
    },[db,liveSync])

    const startSync = useCallback( () => {
        log.debug("Starting initial sync of database. List groups engaged:",syncListGroupIDs.current.length);
        if (appStatus.current === AppStatus.paused || appStatus.current === AppStatus.pausing) {
            log.debug("Not starting initial sync... App being paused...");
        }
        let queryParams = {username: remoteDBCreds.current.dbUsername, listgroups: syncListGroupIDs.current};
        try { globalSync = db.sync((globalRemoteDB as PouchDB.Database), {
            filter: 'replfilter/by_user',
            query_params: queryParams,
            back_off_function: function(delay) {
                async function takeAction () {
                    log.debug("initial sync going offline, delay is:",delay);
                    setSyncStatus(SyncStatus.offline);
                    // setDBServerAvailable(false);  Normal 404s were triggering
                    await checkRetryNetworkIsUp();
                }
                takeAction();
                if (delay===0) {return 8000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: false,
            }).on('paused', () => {log.debug("Initial sync paused");
                                    setSyncStatus(SyncStatus.paused);
                                    setDBServerAvailable(true)})
            .on('active', () => { log.debug("Initial sync active");
                                    setSyncStatus(SyncStatus.active);
                                    setDBServerAvailable(true)})
            .on('change', (info) => {
                                    setSyncStatus(SyncStatus.down);})  
            .on('complete', () => {log.debug("Initial sync complete");
                                    globalSync.cancel();
                                    if (appStatus.current === AppStatus.paused || appStatus.current === AppStatus.pausing) {
                                        log.debug("Not proceeding to live sync, operations have been paused.")
                                    } else {
                                        beginLiveSync()
                                    }
                                    })
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied);
//                                    setDBServerAvailable(false);
                                    log.debug("Initial sync denied: ",{err})})
            .on('error', (err) => { log.debug("initial error state",{err}) ; 
                                globalSync.cancel();
                                setSyncStatus(SyncStatus.error);
                                setDBServerAvailable(false);
                                });
            }
        catch(err) {log.debug("Error setting up initial sync",err); setSyncStatus(SyncStatus.error)}                    
        setRemoteDBState(prevState=>({...prevState,initialSyncStarted: true}))
    },[db,beginLiveSync,checkRetryNetworkIsUp]);
    
    async function setPrefsDBCreds() {
        let credsStr = JSON.stringify(remoteDBCreds.current);
        await Preferences.set({key: 'dbcreds', value: credsStr})  
    }

    const stopSyncAndCloseRemote = useCallback( async () => {
        let success=true;
        if (globalRemoteDB !== undefined && globalRemoteDB !== null) {
            if (globalSync !== undefined && globalSync !== null) {
                globalSync.cancel();
            }
            globalRemoteDB.removeAllListeners();
            await globalRemoteDB.close();
            log.debug("RemoteDB Closed");
//            await new Promise(r => setTimeout(r,1000));
            globalRemoteDB = undefined;
        }
        setRemoteDBState(prevState => ({...prevState,syncStatus: SyncStatus.offline}));
        return success;
    },[])

    const assignDB = useCallback( async (accessJWT: string): Promise<boolean> => {
        log.debug("Assigning Database/setting sync");
        await stopSyncAndCloseRemote();
        let tokenInfo = getTokenInfo(accessJWT,true);
        let networkUp = await checkRetryNetworkIsUp();
        if (!networkUp) {log.debug("Cannot assign DB, network not up."); return false;}
        try {
            globalRemoteDB = new PouchDB(remoteDBCreds.current.couchBaseURL+"/"+remoteDBCreds.current.database, 
                { fetch: (url, opts) => {                  
                    try {return fetch(url, { ...opts, credentials: 'include', headers:
                    { ...opts?.headers, 'Authorization': 'Bearer '+accessJWT, 'Content-type': 'application/json' }}) }
                    catch(err) {log.error("Error in fetch for remote Couch server",err);
                        let pouchResponse: Response = new Response(null,{status: 503,statusText:"Couch server error"});
                        let pouchPromise : Promise<Response> = new Promise((resolve,reject)=>(resolve(pouchResponse)))
                        return pouchPromise}
                    }}) }
        catch(err) {log.error("Could not assign PouchDB Remote Server:",err); return false;}        
        globalRemoteDB.setMaxListeners(40);    
        setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.dbAssigned, 
                accessJWT: accessJWT, accessJWTExpirationTime: tokenInfo.expireDate }));  
        await setPrefsDBCreds(); 
        return true;
    },[stopSyncAndCloseRemote, checkRetryNetworkIsUp])

    const checkDBUUIDAndStartSync = useCallback( async () => {
        if (appStatus.current === AppStatus.paused || appStatus.current === AppStatus.pausing) {
            log.error("Not checking ID and syncing, app pausing..."); return false;
        }
        let DBUUIDCheck = await checkDBUUID(db as PouchDB.Database,globalRemoteDB as PouchDB.Database,String(remoteDBCreds.current.dbUsername),remoteDBState.apiServerVersion, remoteDBState.ignoreAppVersionWarning);
        // if (appStatus.current === AppStatus.paused || appStatus.current === AppStatus.pausing) {
        //     log.error("Not checking ID and syncing, app pausing..."); return false;
        // }
        if (!DBUUIDCheck.checkOK) {
            log.debug("Did not pass DB unique ID check.");
            if (DBUUIDCheck.dbAvailable) {
                log.debug("DBUUID Action is : ",DBUUIDCheck.dbUUIDAction, " naving to login screen...");
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: DBUUIDCheck.errorText, dbUUIDAction: DBUUIDCheck.dbUUIDAction, connectionStatus: ConnectionStatus.navToLoginScreen}))
            } else {
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.db_server_not_available"), dbUUIDAction: DBUUIDAction.exit_no_uuid_on_server, connectionStatus: ConnectionStatus.navToLoginScreen}))
            }    
        } else {
            syncListGroupIDs.current = DBUUIDCheck.syncListGroupIDs;
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.syncStarted}));
//            await initialSetupActivities(globalRemoteDB as PouchDB.Database,remoteDBCreds.current.dbUsername as string)
            log.debug("DB Unique ID check passed. Setup Activities complete. Starting Sync.");
            startSync();
        }
    },[db,startSync,t,remoteDBState.apiServerVersion, remoteDBState.ignoreAppVersionWarning])

    const attemptFullLogin = useCallback( async (): Promise<[boolean,string]> => {
        let devID = await getDeviceID();
        setRemoteDBState(prevState => ({...prevState,deviceUUID: devID}));
        let [initialState,credsObj] = await getPrefsDBCreds(remoteDBCreds.current);
        if (initialState) {
            setRemoteDBState(prevState => ({...prevState,forceShowLoginScreen: true, connectionStatus: ConnectionStatus.navToLoginScreen}));
            remoteDBCreds.current = credsObj;
            await setPrefsDBCreds();
            return [false,""];
        }
//        log.debug("Got credsObj",JSON.stringify(credsObj));
        remoteDBCreds.current = credsObj;
        let serverAvailable = await isServerAvailable(remoteDBCreds.current.apiServerURL); 
        log.debug("is api server available: ",JSON.stringify(serverAvailable));
        if (!(serverAvailable.apiServerAvailable && serverAvailable.dbServerAvailable)) {
            // validate you have a refreshJWT matching userid
            let validJWTMatch = JWTMatchesUser(credsObj.refreshJWT,credsObj.dbUsername);
            // if you do, present a work offline option
            setRemoteDBState(prevState => ({...prevState,apiServerAvailable: serverAvailable.apiServerAvailable, dbServerAvailable: serverAvailable.dbServerAvailable, offlineJWTMatch: validJWTMatch, credsError: true, credsErrorText: ( serverAvailable.apiServerAvailable ? t("error.database_server_not_available") : t("error.could_not_contact_api_server")), connectionStatus: ConnectionStatus.navToLoginScreen}))
            return [false,String(t("error.could_not_contact_api_server"))];
        }
        setRemoteDBState(prevState => ({...prevState,apiServerVersion: serverAvailable.apiServerAppVersion}))
        let credsCheck =  errorCheckCreds({credsObj: credsObj, background: true});
//        log.debug("Attempt Full Login: credsCheck:",credsCheck);
        if (credsCheck.credsError) {
            log.error("Got a creds error -- ",cloneDeep(remoteDBCreds.current));
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: credsCheck.errorText, connectionStatus: ConnectionStatus.navToLoginScreen}))
            return [false,credsCheck.errorText];
        } 
        let refreshResponse = await refreshToken(credsObj as DBCreds,devID);
//        log.debug("Refresh Token Response:",refreshResponse);
        if (refreshResponse.apiError) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.could_not_contact_api_server") , apiServerAvailable: false  ,connectionStatus: ConnectionStatus.navToLoginScreen}));
            return [false,String(t("error.could_not_contact_api_server"))];
        }
        if (!refreshResponse.valid) {
            log.debug("Refresh response was not valid.... clearing Refresh JWT...");
            credsObj.refreshJWT = "";
            remoteDBCreds.current = credsObj;
            await setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_jwt_token") , connectionStatus: ConnectionStatus.navToLoginScreen}));
            return [false,String(t("error.invalid_jwt_token"))];
        }
        remoteDBCreds.current = credsObj;
        remoteDBCreds.current.refreshJWT = refreshResponse.refreshJWT;
        let JWTCheck = await checkJWT(refreshResponse.accessJWT,credsObj.couchBaseURL);
        if (!JWTCheck.DBServerAvailable) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, dbServerAvailable: false  ,credsErrorText: t("error.db_server_not_available") , connectionStatus: ConnectionStatus.navToLoginScreen}))
            return [false,String(t("error.db_server_not_available"))];
        }
        await setPrefsDBCreds();
        if (!JWTCheck.JWTValid) {
            log.debug("JWT Check JWT not valid, clearing Refresh JWT");
            remoteDBCreds.current.refreshJWT = "";
            await setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.invalid_jwt_token"), connectionStatus: ConnectionStatus.navToLoginScreen}))
             return [false,String(t("error.invalid_jwt_token"))];
        }
        let userIDList: UserIDList = { userIDs: [String(remoteDBCreds.current.dbUsername)] }
        let [online,userInfo] = await getUsersInfo(userIDList,String(remoteDBCreds.current.apiServerURL),refreshResponse.accessJWT)
        if (!online) {
            setRemoteDBState(prevState => ({...prevState,apiServerAvailable: false}));
            return [false,String(t("error.could_not_contact_api_server"))]
        }
        if (userInfo.length > 0) {
            remoteDBCreds.current.email = userInfo[0].email;
            remoteDBCreds.current.fullName = userInfo[0].fullname;
            await setPrefsDBCreds();
        }
        setRemoteDBState(prevState => ({...prevState,loggedIn: true}));
        await assignDB(refreshResponse.accessJWT);
//        log.debug("assign DB complete : logintype:",loginType.current);
        return [true,""];
    },[assignDB,t])

    const refreshTokenAndUpdate = useCallback( async (): Promise<RefreshTokenResults> => {
        log.debug("Refresh Token And Update... checking lock");
        if (refreshTokenLocked.current) {
            log.debug("Token already being updated-locked.");
            return RefreshTokenResults.Locked;
        }
        if (appStatus.current === AppStatus.paused || appStatus.current === AppStatus.pausing) {
            log.debug("Cannot refresh token, App is pausing");
            return RefreshTokenResults.Locked;
        }
        refreshTokenLocked.current = true;
        log.debug("Refreshing token/update");
        if (remoteDBCreds.current.refreshJWT !== "") {
            let refreshResponse = await refreshToken(remoteDBCreds.current,String(remoteDBState.deviceUUID));
            log.debug("Response from refresh Token:",refreshResponse);
            if (refreshResponse.apiError) {
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.could_not_contact_api_server"),apiServerAvailable: false,connectionStatus: ConnectionStatus.navToLoginScreen}));
                refreshTokenLocked.current = false;
                return RefreshTokenResults.Failed;
            }
            if (refreshResponse.dbError) {
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: t("error.database_server_not_available"), dbServerAvailable: false, connectionStatus: ConnectionStatus.navToLoginScreen}));
                refreshTokenLocked.current = false;
                return RefreshTokenResults.Failed;
            }
            if (refreshResponse.valid) {
                setRemoteDBState(prevState => ({...prevState, connectionStatus: ConnectionStatus.retry, apiServerAvailable: true}));
//                log.debug("refreshJWT being set to refresh response:",refreshResponse.refreshJWT);
                setDBCredsValue("refreshJWT",refreshResponse.refreshJWT);
                let assignOK = await assignDB(refreshResponse.accessJWT);
                log.debug("re-assigned DB: result:",assignOK);
                refreshTokenLocked.current = false;
                if (assignOK) {return RefreshTokenResults.OK} else {return RefreshTokenResults.Failed}
            }
        } else {
            setRemoteDBState(prevState => ({...prevState, syncStatus: SyncStatus.error}));
            refreshTokenLocked.current = false;
            return RefreshTokenResults.Failed;
        }
        refreshTokenLocked.current = false;
        return RefreshTokenResults.Failed;
    },[assignDB,remoteDBState.deviceUUID,setDBCredsValue,t])

    const checkAndRefreshToken = useCallback(async () => {
        log.debug("In Check And Refresh Token. Logged In: ",remoteDBState.loggedIn)
        if (remoteDBState.loggedIn) {
            let tokenInfo = getTokenInfo(remoteDBState.accessJWT,true);
            if (tokenInfo.expired || tokenInfo.expiresInSeconds <= minimumAccessRefreshSeconds) {
                log.debug("Current Access Token is expired/soon expiring. Updating...",tokenInfo.expiresInSeconds," seconds to expiry...");
                let refreshResults = await refreshTokenAndUpdate();
                if (refreshResults !== RefreshTokenResults.OK) {
                    setRemoteDBState(prevState => ({...prevState,retryCount: 2}));
                } else {
                    if (tokenInfo.expired) {
                        setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStart, syncStatus: SyncStatus.offline}))
                    } else {
                        setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStart}))
                    }    
                }
                return false;
            } else { 
                let assignOK = await assignDB(remoteDBState.accessJWT);
                setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStart}))
                log.debug("After app resumed, re-assigned DB: result:",assignOK);
                return assignOK;
            }
        } else {return false;}
    },[remoteDBState.loggedIn, remoteDBState.accessJWT,assignDB,refreshTokenAndUpdate])

    useEffect( () => {
        let checkDupTimer: ReturnType<typeof setTimeout>;
        if (remoteDBState.dupCheck === DupCheckStatus.channelNeedsRegistered) {
            log.debug("Duplicate Browser Check... Platform is : ",Capacitor.getPlatform(), " native: ",Capacitor.isNativePlatform())
            if (!Capacitor.isNativePlatform()) {
                registerBroadcastChannel()
            } else {
                setRemoteDBState(prevState => ({...prevState,dupCheck: DupCheckStatus.noDupDetected}))
            }
        } else if (remoteDBState.dupCheck === DupCheckStatus.channelRegistered) {
            sendCheckAliveMessage()
        } else if (remoteDBState.dupCheck === DupCheckStatus.messageSent) {
            checkDupTimer = setTimeout(() => {
                log.debug("No other browser sessions active... continuing...");
                setRemoteDBState(prevState => ({...prevState,dupCheck: DupCheckStatus.noDupDetected}))
            },200)
        } else if (remoteDBState.dupCheck === DupCheckStatus.dupDetected) {
            broadcastChannel.current.close()
            alert("Already running in another session, please continue using the app there.");
            window.location.replace('about:blank');
        } else if (remoteDBState.dupCheck === DupCheckStatus.noDupDetected) {
        }
        return () => {clearTimeout(checkDupTimer) }
    },[remoteDBState.dupCheck])

    const restartSync = useCallback( async () => {
        log.debug("Restarting sync, likely due to list group change");
        appStatus.current = AppStatus.pausing;
        setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStop}));
        appStatus.current = AppStatus.resuming;
        if (await checkAndRefreshToken()) {
            setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStart, restartAction: RestartAction.Restarted}))
        } else {
            setRemoteDBState(prevState => ({...prevState,restartAction: RestartAction.None}))
        }
        return true;
    },[checkAndRefreshToken])
    
    useEffect( () => {
        if (remoteDBState.restartAction === RestartAction.RestartNeeded) {
                restartSync();
            }
    },[remoteDBState.restartAction,restartSync])

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            log.debug("Back Button listener registering now...");
            App.addListener('backButton', ({canGoBack}) => {
              if (!canGoBack  || history.length < 3) {
                App.exitApp()
              } else {
                history.goBack();
              }
            })
          }      
        if (remoteDBState.loggedIn) {
            App.addListener("pause", async () => {
                    await queue.add( async () => {
                        appStatus.current = AppStatus.pausing;
                        log.debug("APP PAUSING, clearing timers");
                        setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStop}));
                        await stopSyncAndCloseRemote();
                        appStatus.current = AppStatus.paused;
                    });
                })
            App.addListener("resume", async () => {
                await queue.add( async () => {
                    appStatus.current = AppStatus.resuming;
                    log.debug("APP RESUMING, checking & refreshing token");
                    await stopSyncAndCloseRemote(); // just in case there was no pause event;
                    if (await checkAndRefreshToken()) {
                        setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStart}))
                    }
                    appStatus.current = AppStatus.resumed;    
                })
            })
        }    
        return () => {App.removeAllListeners()};
    },[ remoteDBState.loggedIn, remoteDBState.accessJWT, checkAndRefreshToken, stopSyncAndCloseRemote, history])

    useEffect(() => {
        if ( remoteDBState.dupCheck === DupCheckStatus.noDupDetected && !loginAttempted.current && !(remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) && !(remoteDBState.connectionStatus === ConnectionStatus.onLoginScreen)) {
            log.debug("STATUS: about to attempt full login...");
            attemptFullLogin()
            loginAttempted.current = true;
        }
      },[remoteDBState.dupCheck,loginAttempted,remoteDBState.connectionStatus,attemptFullLogin])
  
    useEffect(() => {
        if (remoteDBState.connectionStatus === ConnectionStatus.dbAssigned) {
            checkDBUUIDAndStartSync();
        }
    },[remoteDBState.connectionStatus,checkDBUUIDAndStartSync])

    useEffect( () => {
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen &&
            loginType.current === LoginType.autoLoginSpecificURL) {
                history.push("/login");
            }
    },[remoteDBState.connectionStatus,history])

    useEffect(() => {
        if (( remoteDBState.initialSyncComplete) && (!remoteDBState.initialNavComplete)) {
            log.debug("setting to login complete after initial sync and not nav complete...");
            if (loginType.current === LoginType.autoLoginSpecificURL) {
                setRemoteDBState(prevState => ({...prevState,initialNavComplete: true}))
            } else {
                setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.loginComplete}));
            }    
        }
        if (remoteDBState.syncStatus === SyncStatus.error) {
            log.error("ERROR syncing, refreshing access token and retrying...");
            refreshTokenAndUpdate();
        }
    },[remoteDBState.initialSyncComplete,remoteDBState.initialNavComplete,remoteDBState.syncStatus,refreshTokenAndUpdate])

    useEffect( () => {
        let curTimer = tokenTimer.current;
        switch (remoteDBState.tokenTimerAction) {
            case TokenTimerAction.NeedToStart:
                if (remoteDBState.accessJWTExpirationTime === 0) {return}
                if (tokenTimer.current !== null && tokenTimer.current !== undefined) {
                    clearTimeout(tokenTimer.current);
                }
                const curTimeSeconds = Math.round(Date.now()/1000);
                const remainingTimeOnToken = Number(remoteDBState.accessJWTExpirationTime) - curTimeSeconds;
                const targetSecondsToRefresh = Math.round(remainingTimeOnToken / 2);
                const secondsToRefresh = (remainingTimeOnToken - targetSecondsToRefresh < minimumAccessRefreshSeconds) ? remainingTimeOnToken - minimumAccessRefreshSeconds : targetSecondsToRefresh
                log.info("Standard Token Timer started, JWT expires in seconds:",secondsToRefresh);        
                tokenTimer.current = setTimeout(async () => {
                    log.debug("standard token timer hit, refreshing ... ")
                    let refreshOK = await refreshTokenAndUpdate();
                    if (refreshOK === RefreshTokenResults.Failed) {setRemoteDBState(prevState=>({...prevState,retryCount: 1}))}
                    else { setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToRestart}))}
                },secondsToRefresh*1000)
                setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.Started}))
                break;
            case TokenTimerAction.NeedToStop:
                log.debug("Stopping standard token timer");
                clearTimeout(tokenTimer.current);
                setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.Stopped}))
                break;
            case TokenTimerAction.NeedToRestart:
                log.debug("Restarting Standard Token Timer");
                clearTimeout(tokenTimer.current);
                setRemoteDBState(prevState => ({...prevState,tokenTimerAction: TokenTimerAction.NeedToStart}))
                break;
            default:
                break;
        }
        return ( () => {clearTimeout(curTimer)})
    },[remoteDBState.tokenTimerAction, remoteDBState.accessJWTExpirationTime,refreshTokenAndUpdate])

    useEffect(() => {
        let retryTimer: ReturnType<typeof setInterval>;
        async function refresh(initial: boolean) {
            log.debug("refreshing Token on retry timer...")
            let refreshOK = await refreshTokenAndUpdate();
            log.debug("refresh OK:",refreshOK,refreshOK ? "clearing interval..." : "leaving retry interval still set");
            if (refreshOK === RefreshTokenResults.OK) {
                clearInterval(retryTimer);
                setRemoteDBState(prevState=>({...prevState, retryCount: 0, tokenTimerAction: TokenTimerAction.NeedToStart}));
            }
        }
        if (remoteDBState.retryCount === 0) {return;}
        log.debug("Kicking off initial refresh retry and setting every 30 second timer...");
        refresh(true);
        retryTimer = setInterval(() => {
            refresh(false);
        }, secondsBetweenRefreshRetries*1000);
        return () => {log.debug("Clearing retry refresh on error timer"); clearInterval(retryTimer);}
    },[remoteDBState.retryCount,refreshTokenAndUpdate])


    let value: RemoteDBStateContextType = {remoteDBState, remoteDBCreds: remoteDBCreds.current, remoteDB: globalRemoteDB as PouchDB.Database<{}> ,
            setRemoteDBState, setRemoteDBCreds, removeUserInfoDBCreds,
            stopSyncAndCloseRemote, restartSync, assignDB, setDBCredsValue,setLoginType, attemptFullLogin};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}