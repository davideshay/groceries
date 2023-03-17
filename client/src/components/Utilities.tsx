import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { initUsersInfo, ListGroupDoc, ListGroupDocInit, UserIDList, UsersInfo } from './DataTypes';
import { cloneDeep } from 'lodash';
import { DBCreds} from './RemoteDBState';
import { PouchResponse, PouchResponseInit } from './DataTypes';

export function isJsonString(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export function urlPatternValidation(url: string) {
    const regex = new RegExp('https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))')
    return regex.test(url);
  };

export function emailPatternValidation(email: string) {
    const emailRegex=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return emailRegex.test(email);
};

export function usernamePatternValidation(username: string) {
    const usernameRegex=/^[a-zA-Z0-9]*$/
    return usernameRegex.test(username);
}

export function fullnamePatternValidation(fullname: string) {
    const usernameRegex=/^[a-zA-Z0-9 ]*$/
    return usernameRegex.test(fullname);
}

export async function checkUserByEmailExists(email: string, remoteDBCreds: DBCreds) {
    let response: HttpResponse | undefined;
    const options = {
        url: String(remoteDBCreds?.apiServerURL+"/checkuserbyemailexists"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteDBCreds?.refreshJWT },
        data: {
            email: email,
        }           
    };
    console.log("about to execute checkuser httpget with options: ", {options})
    response = await CapacitorHttp.post(options);
    console.log("got httpget response: ",{response});
    return response.data;
}

export async function getUsersInfo(userIDList: UserIDList,apiServerURL: string, accessJWT: string): Promise<UsersInfo> {
    let usersInfo: UsersInfo = cloneDeep(initUsersInfo);
    if (accessJWT == "") { return(usersInfo); }
    const usersUrl = apiServerURL+"/getusersinfo"
    if (!urlPatternValidation(usersUrl)) {return usersInfo}
    const options = {
      url: String(usersUrl),
      data: userIDList,
      method: "POST",
      headers: { 'Content-Type': 'application/json',
                 'Accept': 'application/json',
                 'Authorization': 'Bearer '+accessJWT }
    };
    let response:HttpResponse;
    let httpError=false;
    try { response = await CapacitorHttp.post(options); }
    catch(err) {httpError=true; console.log("HTTP Error: ",err); return usersInfo}
    if (response && response.data) {
        if (response.data.hasOwnProperty("users")) {
            usersInfo = response.data.users
        }
    }
    return usersInfo;
}

export async function initialSetupActivities(db: PouchDB.Database, username: string) {
 //  Migration to the new listgroup structure will create for existing users, this is for new users added later, or for offline model
    const totalDocs = (await db.info()).doc_count
    const listGroupDocs = await db.find({ selector: { type: "listgroup", listGroupOwner: username, default: true},
         limit: totalDocs});
    if (listGroupDocs.docs.length == 0) {
        console.log("STATUS: No default group found for ",username, "... creating now ...");
        const defaultListGroupDoc : ListGroupDoc = cloneDeep(ListGroupDocInit);
        defaultListGroupDoc.default = true;
        defaultListGroupDoc.name = username+" (default)";
        defaultListGroupDoc.listGroupOwner = username;
        let curDateStr=(new Date()).toISOString()
        defaultListGroupDoc.updatedAt = curDateStr;
        let response: PouchResponse = cloneDeep(PouchResponseInit);
        try { response.pouchData = await db.post(defaultListGroupDoc);}
        catch(err) { response.successful = false; response.fullError = err;}
        if (!response.pouchData.ok) { response.successful = false;}
        if (!response.successful) { console.error("Could not create new default listGroup for ",username); return;}
    }
}

export const DEFAULT_API_URL=(window as any)._env_.DEFAULT_API_URL
