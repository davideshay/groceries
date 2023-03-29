import { DBCreds, RemoteDBState } from "./RemoteDBState";
import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import jwt_decode from 'jwt-decode';
import { ListRow } from "./DataTypes";
import { History } from "history";
import { urlPatternValidation, usernamePatternValidation, emailPatternValidation,
        fullnamePatternValidation, apiConnectTimeout } from "./Utilities";

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
    console.log("refreshing token, device id: ", devID);
    console.log("apiserverURL:", remoteDBCreds.apiServerURL);
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
