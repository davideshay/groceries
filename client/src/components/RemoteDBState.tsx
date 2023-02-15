import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import { isJsonString, urlPatternValidation, emailPatternValidation, usernamePatternValidation, fullnamePatternValidation, DEFAULT_API_URL } from '../components/Utilities'; 
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Device } from '@capacitor/device';
import PouchDB from 'pouchdb';
import { refreshToken } from "./RemoteUtilities";

export type RemoteDBState = {
    remoteDB: PouchDB.Database | undefined,
    dbCreds: DBCreds,
    deviceUUID: string | null,
    accessJWT: string,
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
    setRemoteDBState: React.SetStateAction<RemoteDBState>,
    startSync: any,
    errorCheckCreds: any,
    checkDBUUID: DBUUIDCheck,
    assignDBAndSync: boolean,
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
    dbCreds: DBCredsInit,
    deviceUUID: null,
    accessJWT: "",
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
    setRemoteDBState: (state: RemoteDBState ) => {},
    startSync: () => {},
    errorCheckCreds: (credsObj: DBCreds,background: boolean, creatingNewUser: boolean = false, password: string = "", verifyPassword: string = ""): CredsCheck => {return CredsCheckInit},
    checkDBUUID: async (remoteDB: PouchDB.Database,credsObj: DBCreds): Promise<DBUUIDCheck> => {return DBUUIDCheckInit },
    assignDBAndSync: async (credsObj: DBCreds, accessJWT: string): Promise<boolean> => {return false},
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
    const db=usePouch();

    function setSyncStatus(status: number) {
        setRemoteDBState(prevState => ({...prevState,syncStatus: status}))
    }

    function setDBCredsValue(key: any, value: any) {
        setRemoteDBState(prevState => ({...prevState, dbCreds: {...prevState.dbCreds,[key]: value}}));
        setPrefsDBCreds({...remoteDBState.dbCreds, [key]: value});
    }

    function setConnectionStatus(value: ConnectionStatus) {
        setRemoteDBState(prevState => ({...prevState, connectionStatus: value}));
    }

    function startSync(remoteDB: PouchDB.Database) {
        const sync = db.sync((remoteDB), {
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
    }

    async function  getPrefsDBCreds()  {
        let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
        let credsObj: DBCreds = cloneDeep(DBCredsInit);
        const credsOrigKeys = keys(credsObj);
        if (isJsonString(String(credsStr))) {
          credsObj=JSON.parse(String(credsStr));
          let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','JWT','refreshJWT','lastConflictsViewed'])
          setRemoteDBState(prevstate => ({...prevstate,dbCreds: credsObjFiltered}))
          credsObj = credsObjFiltered;
        }
        const credKeys = keys(credsObj);
        if (credsObj == null || (credsObj as any).apiServerURL == undefined || (!isEqual(credsOrigKeys.sort(),credKeys.sort()))) {
            credsObj = { apiServerURL: DEFAULT_API_URL,
                couchBaseURL: "",
                database: "",
                dbUsername:"",
                refreshJWT: "",
                email: "",
                fullName: "",
                lastConflictsViewed: (new Date()).toISOString()
                };
            setRemoteDBState(prevstate => ({...prevstate, dbCreds: credsObj}))
        }
        return credsObj;
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
    
    async function checkJWT(credsObj: DBCreds, accessJWT: string) {
        let JWTOK = false;
        let response: HttpResponse | undefined;
        let serverAvailable = true;
        const options = {
            url: String(credsObj.couchBaseURL+"/_session"),
            method: "GET",
            headers: { 'Content-Type': 'application/json',
                       'Accept': 'application/json',
                       'Authorization': 'Bearer '+ accessJWT },
              };
        try { response = await CapacitorHttp.get(options); }
        catch(err) {console.log("Got error:",err); serverAvailable=false}
        if (serverAvailable) {
            if ((response?.status == 200) && (response.data?.userCtx?.name != null)) {
                JWTOK = true;
            } else {
                setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid JWT credentials"}));
            }
        } else {
            setRemoteDBState(prevState => ({...prevState,serverAvailable: false, credsError: true, credsErrorText: "Database offline"}));
        }
        return JWTOK;
    } 

    async function checkDBUUID(remoteDB: PouchDB.Database, credsObj: DBCreds) {
        let UUIDCheck: DBUUIDCheck = {
            checkOK: true,
            dbUUIDAction: DBUUIDAction.none
        }
        let UUIDResults = await (remoteDB as PouchDB.Database).find({
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
  
    async function setPrefsDBCreds(credsObj: DBCreds) {
        let credsStr = JSON.stringify(credsObj);
        setRemoteDBState(prevState => ({...prevState,dbCreds: credsObj}))
        await Preferences.set({key: 'dbcreds', value: credsStr})  
    }

    async function assignDBAndSync(credsObj: DBCreds, accessJWT: string): Promise<boolean> {
        console.log(cloneDeep(credsObj));
        console.log("assignDB accessJWT:",accessJWT);
        let assignSuccessful = true;
        let remoteDB = new PouchDB(credsObj.couchBaseURL+"/"+credsObj.database, 
        { fetch: (url, opts: any) => ( 
             fetch(url, { ...opts, credentials: 'include', headers:
              { ...opts.headers, 'Authorization': 'Bearer '+accessJWT, 'Content-type': 'application/json' }})
              )} );
        setRemoteDBState(prevState => ({...prevState,remoteDB: remoteDB}));
        let DBUUIDCheck = await checkDBUUID(remoteDB,credsObj);
        if (!DBUUIDCheck.checkOK) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid DBUUID", dbUUIDAction: DBUUIDCheck.dbUUIDAction}))
            assignSuccessful = false;
        } else {
            await setPrefsDBCreds(credsObj);
            startSync(remoteDB);
        }
        return assignSuccessful;
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
            setPrefsDBCreds(credsObj);
            setRemoteDBState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,refreshJWT:""},credsError: true, credsErrorText: "Invalid JWT Token", connectionStatus: ConnectionStatus.navToLoginScreen}));
            return;
        }
        credsObj.refreshJWT = refreshResponse.data.refreshJWT;
        let JWTCheck = await checkJWT(credsObj as DBCreds,refreshResponse.data.accessJWT);
        await setPrefsDBCreds(credsObj);
        console.log("JWT Check: ",JWTCheck);
        if (!JWTCheck) {
            credsObj.refreshJWT = "";
            setPrefsDBCreds(credsObj);
            setRemoteDBState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,refreshJWT:""},credsError: true, credsErrorText: "Invalid JWT Token", connectionStatus: ConnectionStatus.navToLoginScreen}))
             return;
        }
        setRemoteDBState(prevState => ({...prevState, accessJWT: refreshResponse.data.accessJWT}));
        let assignSuccess = await assignDBAndSync(credsObj as DBCreds, refreshResponse.data.accessJWT);
        if (!assignSuccess) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Unable to start sync", connectionStatus: ConnectionStatus.navToLoginScreen}))
        };
    }

    async function retrySync() {
        console.log("retrySync");
        let refreshResponse = await refreshToken(remoteDBState.dbCreds,String(remoteDBState.deviceUUID));
        console.log("token refreshed, response:",cloneDeep(refreshResponse));
        if (refreshResponse.data.valid) {
            assignDBAndSync(remoteDBState.dbCreds,refreshResponse.data.accessJWT);
        }
    }

    useEffect(() => {    
        if (!loginAttempted.current && !(remoteDBState.connectionStatus == ConnectionStatus.navToLoginScreen) && !(remoteDBState.connectionStatus == ConnectionStatus.onLoginScreen)) {
            console.log("about to attempt full login...");
            attemptFullLogin()
            loginAttempted.current = true;
//            setRemoteDBState((prevState: any) => ({...prevState,loginAttempted: true}))
        }
      },[loginAttempted,remoteDBState.connectionStatus])
  
    useEffect(() => {
        console.log("syncstatus changed to:", remoteDBState.syncStatus);
        if (( remoteDBState.syncStatus == SyncStatus.active || remoteDBState.syncStatus == SyncStatus.paused) && (remoteDBState.connectionStatus !== ConnectionStatus.initialNavComplete)) {
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.loginComplete}));
        }
        if (remoteDBState.syncStatus == SyncStatus.error) {
            console.log("ERROR syncing, refreshing access token and retrying...");
            retrySync();
        }
    },[remoteDBState.syncStatus])

    let value: any = {remoteDBState, setRemoteDBState, startSync, errorCheckCreds, checkDBUUID, assignDBAndSync, setDBCredsValue, setConnectionStatus};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}