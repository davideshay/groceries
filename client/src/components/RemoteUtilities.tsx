import { DBCreds } from "./DataTypes";
import { CapacitorHttp, HttpResponse } from '@capacitor/core';

export type RemoteState = {
    dbCreds: DBCreds,
    password: string | undefined,
    credsStatus: CredsStatus,
    connectionStatus: ConnectionStatus,
    httpResponse: HttpResponse | undefined,
    showLoginForm: boolean,
    loginByPassword: boolean,
    createNewUser: boolean,
    formError: string,
    formSubmitted: boolean,
    firstListID: string | null,
    gotListID: boolean
  }

  export enum CredsStatus {
    needLoaded = 0,
    loading = 1,
    loaded = 2
  }
  
  export enum ConnectionStatus {
    cannotStart = 0,
    JWTNeedsChecking = 1,
    checkingJWT = 2,
    JWTResponseFound = 3,
    JWTInvalid = 4,
    JWTValid = 5,
    tryIssueToken = 6,
    checkingIssueToken = 7,
    tokenResponseFound = 8,
    startingCreateUser = 9,
    createUserResponseFound = 10,
    remoteDBNeedsAssigned = 10,
    remoteDBAssigned = 11,
    attemptToSync = 12,
    loginComplete = 13
  }
  
export async function createNewUser(remoteState: RemoteState) {
    let response: HttpResponse | undefined;
    const options = {
        url: String(remoteState.dbCreds.apiServerURL+"/registernewuser"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteState.dbCreds.JWT },
        data: {
            username: remoteState.dbCreds.dbUsername,
            password: remoteState.password,
            email: remoteState.dbCreds.email,
            fullname: remoteState.dbCreds.fullName
        }           
    };
    console.log("about to execute createnewuser httpget with options: ", {options})
    response = await CapacitorHttp.post(options);
    console.log("got httpget response: ",{response});
    return response.data;
}