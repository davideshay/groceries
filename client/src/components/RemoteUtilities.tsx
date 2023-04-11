import { DBCreds, DBCredsInit, RemoteDBState } from "./RemoteDBState";
import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import jwt_decode from 'jwt-decode';
import { ListRow } from "./DataTypes";
import { UUIDDoc, maxAppSupportedSchemaVersion } from "./DBSchema";
import { DBUUIDAction, DBUUIDCheck } from "./RemoteDBState";
import { History } from "history";
import { urlPatternValidation, usernamePatternValidation, emailPatternValidation,
        fullnamePatternValidation, apiConnectTimeout, isJsonString, DEFAULT_API_URL } from "./Utilities";
import { cloneDeep, pick, keys, isEqual } from 'lodash';


export async function navigateToFirstListID(phistory: History,remoteDBCreds: DBCreds, listRows: ListRow[]) {
    let firstListID = null;
    if (listRows.length > 0) {
      firstListID = listRows[0].listDoc._id;
    }
    if (firstListID == null) {
        phistory.push("/lists");
    } else {
        phistory.push("/items/list/"+firstListID)
    }  
  }

export async function createNewUser(remoteDBState: RemoteDBState,remoteDBCreds: DBCreds, password: string): Promise<(HttpResponse | undefined)> {
    let response: HttpResponse | undefined;
    const options: HttpOptions = {
        url: String(remoteDBCreds.apiServerURL+"/registernewuser"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteDBCreds.refreshJWT },
        data: {
            username: remoteDBCreds.dbUsername,
            password: password,
            email: remoteDBCreds.email,
            fullname: remoteDBCreds.fullName,
            deviceUUID: remoteDBState.deviceUUID
        },
        connectTimeout: apiConnectTimeout
    };
    try {response = await CapacitorHttp.post(options);}
    catch(err) {console.log("http error:",err)}
    return response;
}

export function getTokenInfo(JWT: string) {
    let tokenResponse = {
        valid : false,
        expireDate: 0
    }
    let JWTDecode;
    let JWTDecodeValid = true;
    try { JWTDecode = jwt_decode(JWT);}
    catch(err) {console.log("INVALID access token:",err); JWTDecodeValid= false}
    if (JWTDecodeValid) {
        tokenResponse.valid = true;
        tokenResponse.expireDate = (JWTDecode as any).exp
    }
    return(tokenResponse);
}

export async function refreshToken(remoteDBCreds: DBCreds, devID: string) {
    console.log("STATUS: refreshing token, device id: ", devID);
    console.log("STATUS: Using API Server: ", remoteDBCreds.apiServerURL);
    let response: HttpResponse | undefined;
    const options: HttpOptions = {
        url: String(remoteDBCreds.apiServerURL+"/refreshtoken"),
        method: "POST",
        headers: { 'Content-Type' : 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Bearer '+remoteDBCreds.refreshJWT},
        connectTimeout: apiConnectTimeout,            
        data: {
            refreshJWT: remoteDBCreds.refreshJWT,
            deviceUUID: devID
        }            
    };
    try { response = await CapacitorHttp.post(options);}
    catch(err) { console.log(err);}
    return response;
}

export function errorCheckCreds({credsObj,background, creatingNewUser = false, password = "", verifyPassword = ""} :
    { credsObj: DBCreds, background: boolean, creatingNewUser?: boolean, password?: string, verifyPassword?: string}) {
    let credsCheck={
        credsError: false,
        errorText: ""
    }
    function setError(err: string) {
        credsCheck.credsError = true; credsCheck.errorText=err;
    }
    if (background && (credsObj.refreshJWT === null || credsObj.refreshJWT === "")) {
        setError("No existing credentials found (refresh)"); return credsCheck;}
    if (credsObj.apiServerURL === null || credsObj.apiServerURL === "") {
        setError("No API Server URL entered"); return credsCheck;}    
    if ((background) && (credsObj.couchBaseURL === null || credsObj.couchBaseURL === "")) {
        setError("No CouchDB URL found"); return credsCheck;}
    if (!urlPatternValidation(credsObj.apiServerURL)) {
        setError("Invalid API URL"); return credsCheck;}
    if ((background) && (!urlPatternValidation(String(credsObj.couchBaseURL)))) {
        setError("Invalid CouchDB URL"); return credsCheck;}
    if (credsObj.apiServerURL.endsWith("/")) {
        credsObj.apiServerURL = String(credsObj.apiServerURL?.slice(0,-1))}
    if (String(credsObj.couchBaseURL).endsWith("/")) {
        credsObj.couchBaseURL = String(credsObj.couchBaseURL?.slice(0,-1))}
    if ((background) && (credsObj.database === null || credsObj.database === "")) {
        setError("No database name found"); return credsCheck;}
    if (credsObj.dbUsername === null || credsObj.dbUsername === "") {
        setError("No database user name entered"); return credsCheck;}
    if ((creatingNewUser) && credsObj.dbUsername.length < 5) {
        setError("Please enter username of 6 characters or more");
        return credsCheck; }    
    if ((creatingNewUser) && !usernamePatternValidation(credsObj.dbUsername)) {
        setError("Invalid username format"); return credsCheck; }
    if ((creatingNewUser) && !fullnamePatternValidation(String(credsObj.fullName))) {
        setError("Invalid full name format"); return credsCheck; }
    if ((creatingNewUser) && (credsObj.email === null || credsObj.email === "")) {
        setError("No email entered"); return credsCheck;}
    if ((creatingNewUser) && (!emailPatternValidation(String(credsObj.email)))) {
        setError("Invalid email format"); return credsCheck;}
    if ((!background && !creatingNewUser) && (password === undefined || password === "")) {
        setError("No password entered"); return credsCheck;}
    if ((creatingNewUser) && password.length < 5) {
        setError("Password not long enough. Please have 6 character or longer password");
        return credsCheck;}
    if ((creatingNewUser) && (password !== verifyPassword)) {
        setError("Passwords do not match"); return credsCheck;}
    return credsCheck;
}

export async function checkJWT(accessJWT: string, remoteDBCreds: DBCreds) {
    let checkResponse = {
        JWTValid: false,
        DBServerAvailable: true,
        JWTExpireDate: 0
    }
    let response: HttpResponse | undefined;
    checkResponse.DBServerAvailable = true;
    const options: HttpOptions = {
        url: String(remoteDBCreds.couchBaseURL+"/_session"),
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
        } 
    } 
    return checkResponse;
} 

export async function checkDBUUID(db: PouchDB.Database, remoteDB: PouchDB.Database) {
    let UUIDCheck: DBUUIDCheck = {
        checkOK: true,
        schemaVersion: 0,
        dbUUIDAction: DBUUIDAction.none
    }
    let UUIDResults = await remoteDB.find({
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

  export async function  getPrefsDBCreds(curCreds: DBCreds)  {
    let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
    let credsObj: DBCreds = cloneDeep(DBCredsInit);
    const credsOrigKeys = keys(credsObj);
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','JWT','refreshJWT','lastConflictsViewed'])
      credsObj = credsObjFiltered;
    }
    const credKeys = keys(credsObj);
    if (credsObj === null || credsObj.apiServerURL === undefined || (!isEqual(credsOrigKeys.sort(),credKeys.sort()))) {
        credsObj = { apiServerURL: DEFAULT_API_URL,
            couchBaseURL: "",
            database: "",
            dbUsername:"",
            refreshJWT: "",
            email: "",
            fullName: "",
            lastConflictsViewed: (new Date()).toISOString()
            };
    }
    return credsObj;
  }
