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
import { t } from "i18next";
import log from "loglevel";

export async function navigateToFirstListID(phistory: History,remoteDBCreds: DBCreds, listRows: ListRow[]) {
    let firstListID = null;
    if (listRows !== undefined) {
        if (listRows.length > 0) {
        firstListID = listRows[0].listDoc._id;
        }
    }
    if (firstListID == null) {
        phistory.push("/lists");
    } else {
        phistory.push("/items/list/"+firstListID)
    }  
  }

export async function isServerAvailable(apiServerURL: string|null) {
    let respObj = {
        apiServerAvailable: false,
        dbServerAvailable: false
    }
    if (apiServerURL === null || apiServerURL === undefined || apiServerURL === "") {
        return respObj;
    }
    let response: HttpResponse | undefined;
    const options: HttpOptions = {
        url: String(apiServerURL+"/isavailable"),
        method: "GET",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                },
        connectTimeout: apiConnectTimeout
    };
    let responseSuccessful = true;
    try {response = await CapacitorHttp.get(options);}
    catch(err) {responseSuccessful = false; log.error("http error in contacting API server:",err); return respObj}
    if (response.status === 200 && response.data && responseSuccessful && response.data.apiServerAvailable) {
        respObj.apiServerAvailable = true;
        respObj.dbServerAvailable = response.data.dbServerAvailable;
    }    
    return respObj
}

export async function isDBServerAvailable(refreshJWT: string | null, couchBaseURL: string | null) {
    let response = false;
    if (refreshJWT === null || refreshJWT === undefined || refreshJWT === "" ||
        couchBaseURL === null || couchBaseURL === undefined || couchBaseURL === "" ) {
        return response;
    }
    let checkResponse = checkJWT(refreshJWT,couchBaseURL);
    return (await checkResponse).DBServerAvailable;
}


export function JWTMatchesUser(refreshJWT: string | null, username: string | null) {
    let validJWTMatch = false;
    if (refreshJWT !== null) {
        let JWTResponse = getTokenInfo(refreshJWT,true);
        if (JWTResponse.valid && username === JWTResponse.username) {
            validJWTMatch = true;
        }
    }            
    return validJWTMatch;
}

export type CreateResponse = {
    invalidData: boolean,
    userAlreadyExists: boolean,
    createdSuccessfully: boolean,
    creationDisabled: boolean,
    idCreated: string,
    refreshJWT: string,
    accessJWT: string,
    couchdbUrl: string,
    couchdbDatabase: string,
    email: string,
    fullname: string,
    apiError: boolean,
    dbError: boolean
}

export const createResponseInit : CreateResponse = {
    invalidData: false,
    userAlreadyExists: false,
    createdSuccessfully: false,
    creationDisabled: false,
    idCreated: "",
    refreshJWT: "",
    accessJWT: "",
    couchdbUrl: "",
    couchdbDatabase: "",
    email: "",
    fullname: "",
    apiError: false,
    dbError: false
}


export async function createNewUser(remoteDBState: RemoteDBState,remoteDBCreds: DBCreds, password: string): Promise<CreateResponse> {
    let createResponse : CreateResponse = cloneDeep(createResponseInit);
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
    catch(err) {log.error("http error in creating new user:",err); createResponse.apiError= true};
    if (response?.data === undefined) {
        createResponse.apiError = true;
    } else {
        createResponse = Object.assign(createResponse,response.data);        
    }
    if (!createResponse.createdSuccessfully) {createResponse.dbError=true;}
    return createResponse;
}

export function getTokenInfo(JWT: string, logIt: boolean) {
    let tokenResponse = {
        valid : false,
        expireDate: 0,
        expiresInSeconds: 0,
        expired: true,
        username: ""
    }
    if (JWT === "" || JWT === undefined || JWT === null) { return tokenResponse}
    let JWTDecode;
    let JWTDecodeValid = true;
    try { JWTDecode = jwt_decode(JWT);}
    catch(err) {log.error("INVALID access token:",err); JWTDecodeValid= false}
    if (JWTDecodeValid) {
        tokenResponse.valid = true;
        tokenResponse.expireDate = (JWTDecode as any).exp
        tokenResponse.expiresInSeconds = (JWTDecode as any).exp - (new Date().getTime() / 1000); 
        tokenResponse.username = (JWTDecode as any).sub
        if (tokenResponse.expireDate >= (new Date().getTime() / 1000)) {
            tokenResponse.expired = false;
        }
    }
    if (logIt ) {log.debug("Got token info:",tokenResponse);}
    return(tokenResponse);
}

export async function refreshToken(remoteDBCreds: DBCreds, devID: string) {
    log.info("Refreshing token, device id: ", devID);
    let tokenResponse = {
        valid : false,
        dbError: false,
        apiError: false,
        refreshJWT: "",
        accessJWT: ""
    }
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
    catch(err) { log.error("http error refreshing token",err); tokenResponse.apiError = true;}
    if (!tokenResponse.apiError && response?.status === 200 && response.data !== undefined) {
        tokenResponse.valid = response.data.valid;
        tokenResponse.dbError = response.data.dbError;
        tokenResponse.refreshJWT = response.data.refreshJWT;
        tokenResponse.accessJWT = response.data.accessJWT;
    }
    return tokenResponse;
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
        setError(t("error.no_existing_credentials_found")); return credsCheck;}
    if (credsObj.apiServerURL === null || credsObj.apiServerURL === "") {
        setError(t("error.no_api_server_url_entered")); return credsCheck;}    
    if ((background) && (credsObj.couchBaseURL === null || credsObj.couchBaseURL === "")) {
        setError(t("error.no_couchdb_url_found")); return credsCheck;}
    if (!urlPatternValidation(credsObj.apiServerURL)) {
        setError(t("error.invalid_api_url")); return credsCheck;}
    if ((background) && (!urlPatternValidation(String(credsObj.couchBaseURL)))) {
        setError(t("error.invalid_couchdb_url")); return credsCheck;}
    if (credsObj.apiServerURL.endsWith("/")) {
        credsObj.apiServerURL = String(credsObj.apiServerURL?.slice(0,-1))}
    if (String(credsObj.couchBaseURL).endsWith("/")) {
        credsObj.couchBaseURL = String(credsObj.couchBaseURL?.slice(0,-1))}
    if ((background) && (credsObj.database === null || credsObj.database === "")) {
        setError(t("error.no_database_name_found")); return credsCheck;}
    if (credsObj.dbUsername === null || credsObj.dbUsername === "") {
        setError(t("error.no_database_username_entered")); return credsCheck;}
    if ((creatingNewUser) && credsObj.dbUsername.length < 5) {
        setError(t("error.username_6_chars_or_more"));
        return credsCheck; }    
    if ((creatingNewUser) && !usernamePatternValidation(credsObj.dbUsername)) {
        setError(t("error.invalid_username_format")); return credsCheck; }
    if ((creatingNewUser) && !fullnamePatternValidation(String(credsObj.fullName))) {
        setError(t("error.invalid_fullname_format")); return credsCheck; }
    if ((creatingNewUser) && (credsObj.email === null || credsObj.email === "")) {
        setError(t("error.no_email_entered")); return credsCheck;}
    if ((creatingNewUser) && (!emailPatternValidation(String(credsObj.email)))) {
        setError(t("error.invalid_email_format")); return credsCheck;}
    if ((!background && !creatingNewUser) && (password === undefined || password === "")) {
        setError(t("error.no_password_entered")); return credsCheck;}
    if ((creatingNewUser) && password.length < 5) {
        setError(t("error.password_not_long_enough"));
        return credsCheck;}
    if ((creatingNewUser) && (password !== verifyPassword)) {
        setError(t("error.passwords_no_match")); return credsCheck;}
    return credsCheck;
}

export async function checkJWT(accessJWT: string, couchBaseURL: string | null) {
    let checkResponse = {
        JWTValid: false,
        DBServerAvailable: true,
        JWTExpireDate: 0
    }
    if (couchBaseURL === null) {checkResponse.DBServerAvailable = false; return checkResponse}
    let response: HttpResponse | undefined;
    checkResponse.DBServerAvailable = true;
    const options: HttpOptions = {
        url: String(couchBaseURL+"/_session"),
        method: "GET",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+ accessJWT },
        connectTimeout: apiConnectTimeout          
          };
    try { response = await CapacitorHttp.get(options); }
    catch(err) {log.error("http error getting session error:",err); checkResponse.DBServerAvailable=false}
    if (checkResponse.DBServerAvailable) {
        if ((response?.status === 200) && (response.data?.userCtx?.name !== null)) {
            let tokenInfo = getTokenInfo(accessJWT,true);
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
    async function getData() {
        let results = await remoteDB.find({
            selector: { "type": { "$eq": "dbuuid"} } })
        return results;
    }
    let UUIDResults : PouchDB.Find.FindResponse<{}>
    try { UUIDResults = await getData() }
    catch(err) {
                log.error("Error getting remote DB UUID"); 
                await new Promise(r => setTimeout(r,1000));
                try { UUIDResults = await getData()}
                catch(err) {log.error("Retry of DBUUID from remote also failed");
                            UUIDCheck.checkOK = false;
                            return UUIDCheck;}
    }
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
      try { localDBAllDocs = await db.allDocs({include_docs: true});} catch(e) {log.error("error checking docs for uuid",e)};
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
        catch(e) {log.error("error finding dbuuid doc",e)};
        if ((localDBFindDocs !== null) && localDBFindDocs.docs.length === 1) {
            localDBUUID = (localDBFindDocs.docs[0] as UUIDDoc).uuid;
            localSchemaVersion = Number((localDBFindDocs.docs[0] as UUIDDoc).schemaVersion);
        }
    }
    log.info("maxAppSupportedVersion",maxAppSupportedSchemaVersion)
    if (Number(UUIDCheck.schemaVersion) > maxAppSupportedSchemaVersion) {
        UUIDCheck.checkOK = false;
        UUIDCheck.dbUUIDAction = DBUUIDAction.exit_app_schema_mismatch;
        return UUIDCheck;
    }

    // compare to current DBCreds one.
    if (localDBUUID === UUIDResult) {
        log.debug("Schema: remote:",remoteSchemaVersion," local:",localSchemaVersion);
        if (remoteSchemaVersion > localSchemaVersion) {
            log.error("Remote Schema greater than local");
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
