import { DBCreds, DBCredsInit, RemoteDBState } from "./RemoteDBState";
import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { jwtDecode, JwtPayload }  from 'jwt-decode';
import { ListCombinedRows, ListRow, RowType } from "./DataTypes";
import { ListGroupDocs, TriggerDoc, UUIDDoc, appVersion, maxAppSupportedSchemaVersion } from "./DBSchema";
import { DBUUIDAction, DBUUIDCheck } from "./RemoteDBState";
import { History } from "history";
import { urlPatternValidation, usernamePatternValidation, emailPatternValidation,
        fullnamePatternValidation, apiConnectTimeout, isJsonString, DEFAULT_API_URL, getRowTypeFromListOrGroupID } from "./Utilities";
import { cloneDeep, pick, keys, isEqual } from 'lodash-es';
import { Device } from '@capacitor/device';
import { t } from "i18next";
import log from "./logger";

export async function getDeviceID() : Promise<string> {
    const devIDInfo = await Device.getId();
    log.debug("Getting device ID...", cloneDeep(devIDInfo));
    let devID = "";
    if (Object.prototype.hasOwnProperty.call(devIDInfo, 'identifier')) {
        devID = devIDInfo.identifier;
    }
    return devID;
}

export async function navigateToFirstListID(phistory: History, listRows: ListRow[], listCombinedRows: ListCombinedRows, savedListID: string | undefined | null) {
//    log.debug("Nav to first list: ",cloneDeep(remoteDBCreds),cloneDeep(listRows));
    let firstListID = null;
    if (listRows !== undefined) {
        if (listRows.length > 0) {
        firstListID = listRows[0].listDoc._id;
        }
    }
    let navToID = null;
    let navType: RowType;
    if (savedListID === null || savedListID === undefined) {
        navToID = firstListID;
        navType = RowType.list;
    } else {
        navToID = savedListID;
        const savedType = getRowTypeFromListOrGroupID(savedListID,listCombinedRows);
        if (savedType === null) {
            navToID = firstListID;
            navType = RowType.list
        } else {
            navType = savedType;
        }
    }
    if (navToID == null) {
        phistory.push("/lists");
    } else {
        if (navType === RowType.list) {
            phistory.push("/items/list/"+navToID);
        } else {
            phistory.push("/items/group/"+navToID);
        }
    }  
  }

export async function isServerAvailable(apiServerURL: string|null) {
    const respObj = {
        apiServerAvailable: false,
        dbServerAvailable: false,
        apiServerAppVersion: ""     
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
        respObj.apiServerAppVersion = response.data.apiServerAppVersion ? response.data.apiServerAppVersion : ""
    }    
    return respObj
}

export async function isDBServerAvailable(refreshJWT: string | null, couchBaseURL: string | null) {
    const response = false;
    if (refreshJWT === null || refreshJWT === undefined || refreshJWT === "" ||
        couchBaseURL === null || couchBaseURL === undefined || couchBaseURL === "" ) {
        return response;
    }
    const checkResponse = await checkJWT(refreshJWT,couchBaseURL);
    return  (checkResponse.DBServerAvailable);
}


export function JWTMatchesUser(refreshJWT: string | null, username: string | null) {
    let validJWTMatch = false;
    if (refreshJWT !== null) {
        const JWTResponse = getTokenInfo(refreshJWT,true);
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
    const tokenResponse = {
        valid : false,
        expireDate: 0,
        expiresInSeconds: 0,
        expired: true,
        username: ""
    }
    if (JWT === "" || JWT === undefined || JWT === null) { return tokenResponse}
    let JWTDecode: JwtPayload;
    try { JWTDecode = jwtDecode(JWT);}
    catch(err) {
        log.error("INVALID access token:",err);
        return tokenResponse;
    }
    if (JWTDecode.exp === undefined || JWTDecode.sub === undefined) {
        log.error("Expiration Date or Subject on Token invalid/undefined");
        return tokenResponse;
    }
    tokenResponse.valid = true;
    tokenResponse.expireDate = JWTDecode.exp
    tokenResponse.expiresInSeconds = JWTDecode.exp - (new Date().getTime() / 1000); 
    tokenResponse.username = JWTDecode.sub
    if (tokenResponse.expireDate >= (new Date().getTime() / 1000)) {
        tokenResponse.expired = false;
    }    
    if (logIt ) {log.debug("Got token info:",tokenResponse);}
    return(tokenResponse);
}

export async function refreshToken(remoteDBCreds: DBCreds, devID: string) {
    log.info("Refreshing token, device id: ", devID);
    const tokenResponse = {
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
    const credsCheck={
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
    const checkResponse = {
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
            const tokenInfo = getTokenInfo(accessJWT,true);
            if (tokenInfo.valid) {
                checkResponse.JWTValid = true;
                checkResponse.JWTExpireDate = tokenInfo.expireDate;
            }
        } 
    } 
    return checkResponse;
} 

async function getListGroupIDs(db: PouchDB.Database,username: string): Promise<string[]> {
    let listGroupIDs: string[] = [];
    let listGroupResults: PouchDB.Find.FindResponse<object>
    try { listGroupResults = await db.find({
        use_index: "stdType",
        selector: {
          type: "listgroup",
          "$or": [
            { "listGroupOwner": username },
            { "sharedWith": {"$elemMatch" : {"$eq" : username}}}
            ] 
        }
      }) }
    catch {log.debug("Could not list group IDs for user:",username); return listGroupIDs}
    if (listGroupResults.docs && listGroupResults.docs.length > 0) {
        listGroupIDs = (listGroupResults.docs as ListGroupDocs).map(lg => (String(lg._id)));
    }
    return listGroupIDs;
}

export async function checkDBUUID(db: PouchDB.Database, remoteDB: PouchDB.Database, username: string, remoteAppVersion: string, ignoreAppVersionWarning: boolean) {
    const UUIDCheck: DBUUIDCheck = {
        checkOK: true,
        dbAvailable: true,
        schemaVersion: 0,
        syncListGroupIDs: [],
        dbUUIDAction: DBUUIDAction.none,
        errorText: ""
    }
    async function getData() {
        const results = await remoteDB.find({
            use_index: "stdType",
            selector: { "type": "dbuuid" } })
        return results;
    }
    let UUIDResults : PouchDB.Find.FindResponse<object>
    try { UUIDResults = await getData() }
    catch {
                log.error("Error getting remote DB UUID"); 
                await new Promise(r => setTimeout(r,1000));
                try { UUIDResults = await getData()}
                catch {log.error("Retry of DBUUID from remote also failed");
                            UUIDCheck.dbAvailable = false;
                            UUIDCheck.checkOK = false;
                            UUIDCheck.dbUUIDAction = DBUUIDAction.exit_no_uuid_on_server;
                            UUIDCheck.errorText = t("error.server_no_unique_id_short");
                            return UUIDCheck;}
    }
    let UUIDResult : null|string = null;
    if (UUIDResults.docs.length > 0) {
      UUIDResult = (UUIDResults.docs[0] as UUIDDoc).uuid;
    }
    if (UUIDResult == null) {
      UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.exit_no_uuid_on_server;
      UUIDCheck.errorText = t("error.server_no_unique_id_short");
      return UUIDCheck;
    }
    UUIDCheck.schemaVersion = (UUIDResults.docs[0] as UUIDDoc).schemaVersion;
    const remoteSchemaVersion = Number(UUIDCheck.schemaVersion);
    let localDBInfo = null;
    let localHasRecords = false;
    let localDBUUID = null;
    let localSchemaVersion = 0;
    try { localDBInfo = await db.info();} catch {localHasRecords=false};
    if (localDBInfo != null && localDBInfo.doc_count > 0) { localHasRecords = true}
    if (localHasRecords) {
      let localDBAllDocs = null;
      try { localDBAllDocs = await db.allDocs({include_docs: true});} catch(e) {log.error("error checking docs for uuid",e)};
      localHasRecords = false;
      if (localDBAllDocs != null) {
        for (const row of localDBAllDocs.rows) {
          if (row.doc) {
            if (Object.prototype.hasOwnProperty.call(row.doc,"language"))  {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((row.doc as any).language !== "query") {
                    localHasRecords = true;
                    break;
                }
            } else {
                localHasRecords=true;
                break;
            }
          }
        };
      }
    }
    let foundDBUUIDOK = true;
    if (localHasRecords) {
        let localDBFindDocs = null;
        try { localDBFindDocs = await db.find({use_index: "stdType", selector: { "type": "dbuuid" }}) }
        catch(e) {log.error("error finding dbuuid doc",e,localDBFindDocs); foundDBUUIDOK = false};
        if ((localDBFindDocs !== null) && localDBFindDocs.docs.length === 1) {
            localDBUUID = (localDBFindDocs.docs[0] as UUIDDoc).uuid;
            localSchemaVersion = Number((localDBFindDocs.docs[0] as UUIDDoc).schemaVersion);
        }
    }
    if (!foundDBUUIDOK && localHasRecords) {
        UUIDCheck.checkOK = false;
        log.error("No local DBUUID record, but other records exist");
        UUIDCheck.dbUUIDAction = DBUUIDAction.exit_local_remote_schema_mismatch;
        UUIDCheck.errorText = t("error.different_database_schema_short");
        return UUIDCheck;
    }

    log.info("maxAppSupportedSchemaVersion",maxAppSupportedSchemaVersion)

    // compare to current DBCreds one.
    if (remoteSchemaVersion > localSchemaVersion && localSchemaVersion !== 0) {
        log.error("Remote Schema greater than local");
        UUIDCheck.checkOK = false;
        UUIDCheck.dbUUIDAction = DBUUIDAction.exit_local_remote_schema_mismatch;
        UUIDCheck.errorText = t("error.different_database_schema_short");
        return UUIDCheck;
    }   

    if (localDBUUID !== null && localDBUUID !== UUIDResult) {
        log.error("DBUUID uuid different on server/local.");
        UUIDCheck.checkOK = false;
        UUIDCheck.dbUUIDAction = DBUUIDAction.exit_different_uuids;
        UUIDCheck.errorText = t("error.different_database_unique_id");
        return UUIDCheck;
    }

    if (Number(UUIDCheck.schemaVersion) > maxAppSupportedSchemaVersion) {
        UUIDCheck.checkOK = false;
        UUIDCheck.dbUUIDAction = DBUUIDAction.exit_app_schema_mismatch;
        UUIDCheck.errorText = t("error.app_not_support_newer_schema_short");
        return UUIDCheck;
    }

    if ((appVersion !== remoteAppVersion) && !ignoreAppVersionWarning) {
        UUIDCheck.checkOK = false;
        UUIDCheck.dbUUIDAction = DBUUIDAction.warning_app_version_mismatch;
        UUIDCheck.errorText = t("error.different_server_local_app_versions_short");
        log.error("App Version Mismatch: local:",appVersion," remote: ",remoteAppVersion);
        return UUIDCheck;
    }

    const remoteListGroupIDs = await getListGroupIDs(remoteDB,username);
    const localListGroupIDs = await getListGroupIDs(db,username);
    UUIDCheck.syncListGroupIDs = Array.from(new Set(remoteListGroupIDs.concat(localListGroupIDs)));

      // if current DBCreds doesn't have one, set it to the remote one.
    if ((localDBUUID === null || localDBUUID === "" ) && !localHasRecords) {
      return UUIDCheck;
    }
    return UUIDCheck;
  }

  export async function updateTriggerDoc(remoteDB: PouchDB.Database,data: object) {
    log.debug("updating trigger doc...");
    let results: PouchDB.Find.FindResponse<object> | null = null;
    try { results = await remoteDB.find({
        use_index: "stdType",
        selector: { "type": "trigger" } })}
    catch {log.error("Could not find trigger doc, DB error"); return false;}
    let triggerExists = false;
    if (results !== null  && results.docs && results.docs.length > 0) {triggerExists = true};
    if (triggerExists) {
        const triggerDoc: TriggerDoc = results.docs[0] as TriggerDoc;
        triggerDoc.triggerData = data;
        triggerDoc.updatedAt = new Date().toISOString();
        try { await remoteDB.put(triggerDoc)}
        catch {log.error("Could not update trigger doc, DB error"); return false;}
        log.debug("Trigger Doc updated with new data");
    } else {
        const triggerDoc: TriggerDoc = {
            type: "trigger",
            triggerData: data,
            updatedAt: new Date().toISOString()
        }
        try {await remoteDB.post(triggerDoc)}
        catch {log.error("Could not create trigger doc, DB Error"); return false;}
        log.debug("Trigger doc created with new data");
    }
    return true;
  }

  export async function  getPrefsDBCreds(): Promise<[boolean,DBCreds]>  {
    const { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
    let initial : boolean = false;
    let credsObj: DBCreds = cloneDeep(DBCredsInit);
    const credsOrigKeys = keys(credsObj);
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      const credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','refreshJWT','lastConflictsViewed'])
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
        initial = true;    
    }
    return [initial,credsObj];
  }
