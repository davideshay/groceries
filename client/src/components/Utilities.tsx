import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { initUsersInfo, ListCombinedRows, LogLevel, RowType, UserIDList, UserInfo, UsersInfo } from './DataTypes';
import { ListGroupDoc, ListGroupDocInit, UomDoc } from './DBSchema';
import { cloneDeep } from 'lodash';
import { DBCreds} from './RemoteDBState';
import { PouchResponse, PouchResponseInit } from './DataTypes';

export const apiConnectTimeout = 500;

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
    const options: HttpOptions = {
        url: String(remoteDBCreds?.apiServerURL+"/checkuserbyemailexists"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteDBCreds?.refreshJWT },
        data: {
            email: email,
        },
        connectTimeout: apiConnectTimeout         
    };
    try { response = await CapacitorHttp.post(options);}
    catch(err) {logger(LogLevel.ERROR,"ERROR: http:",err)};
    return response?.data;
}

export async function getUsersInfo(userIDList: UserIDList,apiServerURL: string, accessJWT: string): Promise<UsersInfo> {
    let usersInfo: UsersInfo = cloneDeep(initUsersInfo);
    if (accessJWT === "") { return(usersInfo); }
    const usersUrl = apiServerURL+"/getusersinfo"
    if (!urlPatternValidation(usersUrl)) {return usersInfo}
    const options : HttpOptions = {
      url: String(usersUrl),
      data: userIDList,
      method: "POST",
      headers: { 'Content-Type': 'application/json',
                 'Accept': 'application/json',
                 'Authorization': 'Bearer '+accessJWT },
      connectTimeout: apiConnectTimeout           
    };
    let response:HttpResponse;
    try { response = await CapacitorHttp.post(options); }
    catch(err) {logger(LogLevel.ERROR,"HTTP Error: ",err); return usersInfo}
    if (response && response.data) {
        if (response.data.hasOwnProperty("users")) {
            usersInfo = response.data.users
        }
    }
    return usersInfo;
}

export async function updateUserInfo(apiServerURL: string, accessJWT: string, userInfo: UserInfo) : Promise<boolean> {
    let result=false;
    let updateUrl=apiServerURL+"/updateuserinfo";
    const options: HttpOptions = {
        url: String(updateUrl),
        data: userInfo,
        method: "POST",
        headers: { 'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer '+accessJWT },
        connectTimeout: apiConnectTimeout           
    }
    let response:HttpResponse;
    try { response = await CapacitorHttp.post(options)}
    catch(err) {logger(LogLevel.ERROR,"HTTP Error: ",err); return result}
    if (response && response.data) {
        if (response.data.hasOwnProperty("success")) {
            result=response.data.success
        }
    }
    return result;
}

export async function initialSetupActivities(db: PouchDB.Database, username: string) {
 //  Migration to the new listgroup structure will create for existing users, this is for new users added later, or for offline model
    logger(LogLevel.DEBUG,"SETUP: Running Initial Setup Activities for :",username);
    const totalDocs = (await db.info()).doc_count
    const listGroupDocs = await db.find({ selector: { type: "listgroup", listGroupOwner: username, default: true},
         limit: totalDocs});
    if (listGroupDocs.docs.length === 0) {
        logger(LogLevel.INFO,"STATUS: No default group found for ",username, "... creating now ...");
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

export async function adaptResultToBase64(res: Blob): Promise<string> {
    let reader: FileReader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onloadend = () => {
            resolve(reader.result as string);
        }
        reader.onerror = () => {
            reject("Error reading file.");
        }
        reader.readAsDataURL(res);
    })
}

export function getListGroupIDFromListOrGroupID(listOrGroupID: string, listCombinedRows: ListCombinedRows) : string | null {
    let newListRow= listCombinedRows.find(lcr => lcr.listOrGroupID == listOrGroupID);
    if (newListRow == undefined) {return null}
    else { return newListRow.listGroupID}
}

export function getRowTypeFromListOrGroupID(listOrGroupID: string, listCombinedRows: ListCombinedRows) : RowType | null {
    let newListRow = listCombinedRows.find(lcr => lcr.listOrGroupID == listOrGroupID);
    if (newListRow == undefined) {return null}
    else { return newListRow.rowType}
}

export function getUOMIDFromShortName(uomName: string, uomDocs: UomDoc[]) : string | null {
    let foundUOM = uomDocs.find(uom => (uom.name.toUpperCase() === uomName.toUpperCase()));
    if (foundUOM == undefined) { return null}
    else { return (foundUOM._id as string)}
}

export function logger(lvl: LogLevel, ...args: any) {
    let argsarray = Array.from(arguments);
    if (lvl >= LOG_LEVEL) {
        let date=new Date();
        let timePrefix=date.toLocaleDateString()+" "+date.toLocaleTimeString();
        console.log(timePrefix+": ",...args);
    }
}

function getLogLevel(level: string) {
    switch (level.toUpperCase()) {
        case "I":
        case "INFO":
        case "INFORMATION":
            return LogLevel.INFO
        case "D":
        case "DEBUG":
            return LogLevel.DEBUG
        case "W":
        case "WARN":
        case "WARNING":
            return LogLevel.WARNING
        case "E":
        case "ERROR":
            return LogLevel.ERROR
        default:
            return LogLevel.INFO
    }
}

export const DEFAULT_API_URL=(window as any)._env_.DEFAULT_API_URL
export const LOG_LEVEL= (window as any)._env_.LOG_LEVEL == undefined ? LogLevel.INFO : getLogLevel((window as any)._env.LOG_LEVEL)
