import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import { isJsonString, urlPatternValidation, emailPatternValidation, usernamePatternValidation, fullnamePatternValidation, DEFAULT_API_URL } from '../components/Utilities'; 
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Device } from '@capacitor/device';
import PouchDB from 'pouchdb';
import { getTokenInfo, refreshToken } from "./RemoteUtilities";

const secondsBeforeAccessRefresh = 90;

let globalSync: any = null;
let globalRemoteDB: PouchDB.Database | undefined = undefined;

export type RemoteDBState = {
    remoteDB: PouchDB.Database | undefined,
    sync: any,
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
    setRemoteDBState: React.SetStateAction<RemoteDBState>,
    setRemoteDBCreds: any,
    startSync: any,
    errorCheckCreds: any,
    checkDBUUID: DBUUIDCheck,
    assignDB: boolean,
    setDBCredsValue: any,
    setConnectionStatus: any
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
    exit_no_uuid_on_server = 1,
    destroy_needed = 2
}  

export type DBUUIDCheck = {
    checkOK: boolean,
    dbUUIDAction: DBUUIDAction
}
  
const DBUUIDCheckInit: DBUUIDCheck = {
    checkOK: true,
    dbUUIDAction: DBUUIDAction.none
}

export type CredsCheck = {
    credsError: boolean,
    errorText: string
}

const CredsCheckInit: CredsCheck = {
    credsError: false,
    errorText: ""
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
    remoteDB: undefined ,
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
    setRemoteDBState: (state: RemoteDBState ) => {},
    setRemoteDBCreds: (dbCreds: DBCreds) => {},
    startSync: () => {},
    errorCheckCreds: (credsObj: DBCreds,background: boolean, creatingNewUser: boolean = false, password: string = "", verifyPassword: string = ""): CredsCheck => {return CredsCheckInit},
    checkDBUUID: async (remoteDB: PouchDB.Database,credsObj: DBCreds): Promise<DBUUIDCheck> => {return DBUUIDCheckInit },
    assignDB: async (accessJWT: string): Promise<boolean> => {return false},
    setDBCredsValue: (key: any, value: any) => {},
    setConnectionStatus: (value: ConnectionStatus) => {},
}

export const RemoteDBStateContext = createContext(initialContext)

type RemoteDBStateProviderProps = {
    children: React.ReactNode;
}

export const RemoteDBStateProvider: React.FC<RemoteDBStateProviderProps> = (props: RemoteDBStateProviderProps) => {
    const [remoteDBState,setRemoteDBState] = useState<RemoteDBState>(initialRemoteDBState);
    const loginAttempted = useRef(false);
    const remoteDBCreds = useRef(DBCredsInit);
    const db=usePouch();

//    console.log("rendering, dbcreds: ",cloneDeep(remoteDBState.dbCreds.refreshJWT));

    function setSyncStatus(status: number) {
        setRemoteDBState(prevState => ({...prevState,syncStatus: status}))
    }

    function setDBCredsValue(key: string, value: any) { 
        (remoteDBCreds.current as any)[key] = value;
        setPrefsDBCreds();
    }

    function setRemoteDBCreds(newCreds: DBCreds) {
        remoteDBCreds.current = newCreds;
    }

    function setConnectionStatus(value: ConnectionStatus) {
        setRemoteDBState(prevState => ({...prevState, connectionStatus: value}));
    }

    function startSync() {
        console.log("before sync, :", cloneDeep(globalSync));
        console.log("before sync, remoteDB: ", cloneDeep(globalRemoteDB));
        console.log("before sync, refreshJWT:", cloneDeep(remoteDBCreds.current.refreshJWT));
        globalSync = db.sync((globalRemoteDB as any), {
            back_off_function: function(delay) {
                console.log("going offline");
                setSyncStatus(SyncStatus.offline);
                if (delay===0) {return 1000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: true,
            }).on('paused', () => { setSyncStatus(SyncStatus.paused)})
            .on('active', () => { setSyncStatus(SyncStatus.active)})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied); console.log("sync denied: ",{err})})
            .on('error', (err) => { console.log ("db.sync error state",{err}) ; 
                                setSyncStatus(SyncStatus.error);
                                })
        console.log("sync started");
        console.log("started with refreshJWT : ", cloneDeep(remoteDBCreds.current.refreshJWT));
    }

    async function  getPrefsDBCreds()  {
        console.log("setting dbcreds state from creds in preferences....");
        let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
        let credsObj: DBCreds = cloneDeep(DBCredsInit);
        const credsOrigKeys = keys(credsObj);
        if (isJsonString(String(credsStr))) {
          credsObj=JSON.parse(String(credsStr));
          let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','JWT','refreshJWT','lastConflictsViewed'])
          console.log("in getprefs, setting dbcreds to ",cloneDeep(credsObjFiltered));
          remoteDBCreds.current = credsObjFiltered;
        }
        const credKeys = keys(remoteDBCreds.current);
        if (remoteDBCreds.current == null || remoteDBCreds.current.apiServerURL == undefined || (!isEqual(credsOrigKeys.sort(),credKeys.sort()))) {
            credsObj = { apiServerURL: DEFAULT_API_URL,
                couchBaseURL: "",
                database: "",
                dbUsername:"",
                refreshJWT: "",
                email: "",
                fullName: "",
                lastConflictsViewed: (new Date()).toISOString()
                };
            console.log("setting dbcreds to init state...");
            remoteDBCreds.current = credsObj;
        }
        return remoteDBCreds.current;
      }
    
      function errorCheckCreds(credsObj: DBCreds,background: boolean, creatingNewUser: boolean = false, password: string = "", verifyPassword: string = "") {
        let credsCheck={
            credsError: false,
            errorText: ""
        }
        function setError(err: string) {
            credsCheck.credsError = true; credsCheck.errorText=err;
        }
        if (background && (credsObj.refreshJWT == null || credsObj.refreshJWT == "")) {
            setError("No existing credentials found (refresh)"); return credsCheck;}
        if (credsObj.apiServerURL == null || credsObj.apiServerURL == "") {
            setError("No API Server URL entered"); return credsCheck;}    
        if ((background) && (credsObj.couchBaseURL == null || credsObj.couchBaseURL == "")) {
            setError("No CouchDB URL found"); return credsCheck;}
        if (!urlPatternValidation(credsObj.apiServerURL)) {
            setError("Invalid API URL"); return credsCheck;}
        if ((background) && (!urlPatternValidation(String(credsObj.couchBaseURL)))) {
            setError("Invalid CouchDB URL"); return credsCheck;}
        if (credsObj.apiServerURL.endsWith("/")) {
            credsObj.apiServerURL = String(credsObj.apiServerURL?.slice(0,-1))}
        if (String(credsObj.couchBaseURL).endsWith("/")) {
            credsObj.couchBaseURL = String(credsObj.couchBaseURL?.slice(0,-1))}
        if ((background) && (credsObj.database == null || credsObj.database == "")) {
            setError("No database name found"); return credsCheck;}
        if (credsObj.dbUsername == null || credsObj.dbUsername == "") {
            setError("No database user name entered"); return credsCheck;}
        if ((creatingNewUser) && credsObj.dbUsername.length < 5) {
            setError("Please enter username of 6 characters or more");
            return credsCheck; }    
        if ((creatingNewUser) && !usernamePatternValidation(credsObj.dbUsername)) {
            setError("Invalid username format"); return credsCheck; }
        if ((creatingNewUser) && !fullnamePatternValidation(String(credsObj.fullName))) {
            setError("Invalid full name format"); return credsCheck; }
        if ((creatingNewUser) && (credsObj.email == null || credsObj.email == "")) {
            setError("No email entered"); return credsCheck;}
        if ((creatingNewUser) && (!emailPatternValidation(String(credsObj.email)))) {
            setError("Invalid email format"); return credsCheck;}
        if ((!background && !creatingNewUser) && (password == undefined || password == "")) {
            setError("No password entered"); return credsCheck;}
        if ((creatingNewUser) && password.length < 5) {
            setError("Password not long enough. Please have 6 character or longer password");
            return credsCheck;}
        if ((creatingNewUser) && (password != verifyPassword)) {
            setError("Passwords do not match"); return credsCheck;}
        return credsCheck;
    }
    
    async function checkJWT(accessJWT: string) {
        let checkResponse = {
            JWTValid: false,
            DBServerAvailable: true,
            JWTExpireDate: 0
        }
        let response: HttpResponse | undefined;
        checkResponse.DBServerAvailable = true;
        const options = {
            url: String(remoteDBCreds.current.couchBaseURL+"/_session"),
            method: "GET",
            headers: { 'Content-Type': 'application/json',
                       'Accept': 'application/json',
                       'Authorization': 'Bearer '+ accessJWT },
              };
        try { response = await CapacitorHttp.get(options); }
        catch(err) {console.log("Got error:",err); checkResponse.DBServerAvailable=false}
        if (checkResponse.DBServerAvailable) {
            if ((response?.status == 200) && (response.data?.userCtx?.name != null)) {
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
            dbUUIDAction: DBUUIDAction.none
        }
        let UUIDResults = await (globalRemoteDB as PouchDB.Database).find({
            selector: { "type": { "$eq": "dbuuid"} } })
        let UUIDResult : null|string = null;
        if (UUIDResults.docs.length > 0) {
          UUIDResult = (UUIDResults.docs[0] as any).uuid;
        }
        if (UUIDResult == null) {
          UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.exit_no_uuid_on_server;
          return UUIDCheck;
        }

        let localDBInfo = null;
        let localHasRecords = false;
        let localDBUUID = null;
        try { localDBInfo = await db.info();} catch(e) {localHasRecords=false};
        if (localDBInfo != null && localDBInfo.doc_count > 0) { localHasRecords = true}
        if (localHasRecords) {
          let localDBAllDocs = null;
          try { localDBAllDocs = await db.allDocs({include_docs: true});} catch(e) {console.log(e)};
          localHasRecords = false;
          if (localDBAllDocs != null) {
            localDBAllDocs.rows.forEach(row => {
              if ((row.doc as any).language != "query") {
                    localHasRecords=true;
                }
            });
          }
        }
        if (localHasRecords) {
            let localDBFindDocs = null;
            try { localDBFindDocs = await db.find({selector: { "type": { "$eq": "dbuuid"} }}) }
            catch(e) {console.log(e)};
            if ((localDBFindDocs != null) && localDBFindDocs.docs.length == 1) {
                localDBUUID = (localDBFindDocs.docs[0] as any).uuid;
            }
        }      
        // compare to current DBCreds one.
        if (localDBUUID == UUIDResult) {
        return UUIDCheck;
        } 
          // if current DBCreds doesn't have one, set it to the remote one.
        if ((localDBUUID == null || localDBUUID == "" ) && !localHasRecords) {
 //           credsObj.remoteDBUUID = UUIDResult;
          return UUIDCheck;
        }
        UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.destroy_needed;
        return UUIDCheck;
      }
  
    async function setPrefsDBCreds() {
        console.log("saving prefs to localstorage and state: RefreshJWT: ",cloneDeep(remoteDBCreds.current));
        let credsStr = JSON.stringify(remoteDBCreds.current);
        await Preferences.set({key: 'dbcreds', value: credsStr})  
    }

    async function assignDB(accessJWT: string) {
        console.log("in assignDB, credsObj: ",cloneDeep(remoteDBCreds.current));
        console.log("assignDB accessJWT:",accessJWT);
        if (globalRemoteDB != undefined) {
            if (!(globalSync == undefined || globalSync == null)) {
                console.log("cancelling sync...");
                await globalSync.cancel();
            }
            console.log("current sync obj:", cloneDeep(globalSync));
            console.log("closing current remoteDB...");
            console.log("db before close:",cloneDeep(globalRemoteDB));
            await globalRemoteDB.close();
            await globalRemoteDB.removeAllListeners();
            await new Promise(r => setTimeout(r,2000));
            console.log("db after close:", cloneDeep(globalRemoteDB));
            globalRemoteDB = undefined;
        }
        globalRemoteDB = new PouchDB(remoteDBCreds.current.couchBaseURL+"/"+remoteDBCreds.current.database, 
            { fetch: (url, opts: any) => ( 
                fetch(url, { ...opts, credentials: 'include', headers:
                { ...opts.headers, 'Authorization': 'Bearer '+accessJWT, 'Content-type': 'application/json' }})
            )})
//        globalRemoteDB.setMaxListeners(40);    
        setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.dbAssigned, 
                accessJWT: accessJWT }));  
        setPrefsDBCreds(); 
    }

    async function CheckDBUUIDAndStartSync() {
        let DBUUIDCheck = await checkDBUUID();
        if (!DBUUIDCheck.checkOK) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid DBUUID", dbUUIDAction: DBUUIDCheck.dbUUIDAction}))
        } else {
            startSync();
        }
    }

    async function attemptFullLogin() {
        const devIDInfo = await Device.getId();
        let devID = "";
        if (devIDInfo.hasOwnProperty('uuid')) {
            devID = devIDInfo.uuid;
        }
        console.log("Here is my devID:", devID);
        setRemoteDBState(prevState => ({...prevState,deviceUUID: devID}));
        let credsObj = await getPrefsDBCreds();
        console.log({credsObj});
        let credsCheck =  errorCheckCreds((credsObj as DBCreds),true);
        console.log("Creds check",credsCheck);
        if (credsCheck.credsError) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: credsCheck.errorText, connectionStatus: ConnectionStatus.navToLoginScreen}))
            return;
        } 
        let refreshResponse = await refreshToken(credsObj as DBCreds,devID);
        console.log("Refresh token response:",refreshResponse);
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
        console.log("JWT Check: ",JWTCheck);
        await setPrefsDBCreds();
        if (!JWTCheck.JWTValid) {
            remoteDBCreds.current.refreshJWT = "";
            setPrefsDBCreds();
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid JWT Token", connectionStatus: ConnectionStatus.navToLoginScreen}))
             return;
        }
        setRemoteDBState(prevState => ({...prevState, accessJWT: refreshResponse.data.accessJWT, accessJWTExpirationTime: JWTCheck.JWTExpireDate}));
        await assignDB(refreshResponse.data.accessJWT);
//        if (!assignSuccess) {
//            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Unable to start sync", connectionStatus: ConnectionStatus.navToLoginScreen}))
//        };
    }

     async function retrySync() {
         console.log("retrySync");
         refreshTokenAndUpdate();
     }

    async function refreshTokenAndUpdate() {
        console.log("refreshTokenAndUpdate, sync is: ",globalSync)
        if (remoteDBCreds.current.refreshJWT !== "") {
            console.log("attempting refresh with current refreshJWT :",cloneDeep(remoteDBCreds.current.refreshJWT));
            let refreshResponse = await refreshToken(remoteDBCreds.current,String(remoteDBState.deviceUUID));
            console.log("token refreshed, response:",cloneDeep(refreshResponse));
            if (refreshResponse.data.valid) {
                let tokenInfo = getTokenInfo(refreshResponse.data.accessJWT)
                setRemoteDBState(prevState => ({...prevState, accessJWT: refreshResponse.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate, connectionStatus: ConnectionStatus.retry}));
                remoteDBCreds.current.refreshJWT = refreshResponse.data.refreshJWT;
                assignDB(refreshResponse.data.accessJWT);
            }
        } else {
            setRemoteDBState(prevState => ({...prevState, syncStatus: SyncStatus.error}));
        }
    }

    useEffect(() => {
        console.log("new connection status : ",remoteDBState.connectionStatus);    
        if (!loginAttempted.current && !(remoteDBState.connectionStatus == ConnectionStatus.navToLoginScreen) && !(remoteDBState.connectionStatus == ConnectionStatus.onLoginScreen)) {
            console.log("about to attempt full login...");
            attemptFullLogin()
            loginAttempted.current = true;
//            setRemoteDBState((prevState: any) => ({...prevState,loginAttempted: true}))
        }
      },[loginAttempted,remoteDBState.connectionStatus])
  
    useEffect(() => {
        if (remoteDBState.connectionStatus == ConnectionStatus.dbAssigned) {
            CheckDBUUIDAndStartSync();
        }
    },[remoteDBState.connectionStatus])

    useEffect(() => { console.log("refreshJWT changed to:",cloneDeep(remoteDBCreds.current.refreshJWT))
    },[remoteDBCreds.current.refreshJWT]);


    useEffect(() => {
        console.log("syncstatus changed to:", remoteDBState.syncStatus);
        if (( remoteDBState.syncStatus == SyncStatus.active || remoteDBState.syncStatus == SyncStatus.paused) && (remoteDBState.connectionStatus !== ConnectionStatus.initialNavComplete)) {
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.loginComplete}));
        }
        if (remoteDBState.syncStatus == SyncStatus.error) {
            console.log("ERROR syncing, refreshing access token and retrying...");
            retrySync();
        }
        const logTimer = setInterval(() => {console.log("refresh:",cloneDeep(remoteDBCreds.current.refreshJWT))},5000);
        return () => clearInterval(logTimer);
    },[remoteDBState.syncStatus])

    useEffect(() => {
        console.log("Access JWT expiration time changed to:",remoteDBState.accessJWTExpirationTime);
        if (remoteDBState.accessJWTExpirationTime == 0) {return;}
        const secondsToRefresh = Number(remoteDBState.accessJWTExpirationTime) - (Math.round(Date.now() / 1000)) - secondsBeforeAccessRefresh;
        console.log("expires in seconds:",secondsToRefresh);
        const refreshTimer = setTimeout(() => {
            console.log("refreshing token now...");
            console.log("... skipping actual refresh to create error...")
            refreshTokenAndUpdate();
        }, secondsToRefresh*1000);
        return () => clearTimeout(refreshTimer);
    },[remoteDBState.accessJWTExpirationTime])

    let value: any = {remoteDBState, remoteDBCreds: remoteDBCreds.current, setRemoteDBState, setRemoteDBCreds, startSync, errorCheckCreds, checkDBUUID, assignDB, setDBCredsValue, setConnectionStatus};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}