import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { initUsersInfo, ListCombinedRows, RowType, UserIDList, UserInfo, UsersInfo } from './DataTypes';
import { ListGroupDoc, ListGroupDocInit } from './DBSchema';
import { cloneDeep } from 'lodash';
import { DBCreds} from './RemoteDBState';
import { PouchResponse, PouchResponseInit } from './DataTypes';
import loglevelnext, { LogLevel } from 'loglevelnext';
import { MethodFactory } from 'loglevelnext';
import { t } from "i18next"

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
    try { new URL(url);return true; }
    catch(err) {return false;}
  };

export function emailPatternValidation(email: string) {
    const emailRegex=/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
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
    let checkResponse = {
        userExists : false,
        fullname: "",
        username: "",
        email: "",
        apiError: false
    }
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
    catch(err) {log.error("CheckUserByEmail: http:",err); checkResponse.apiError = true};
    if ((!checkResponse.apiError) && (response?.data !== undefined)) {
        checkResponse.userExists = response.data.userExists;
        checkResponse.email = response.data.email;
        checkResponse.fullname = response.data.fullname;
        checkResponse.username = response.data.username;
    }
    return checkResponse;
}

export async function getUsersInfo(userIDList: UserIDList,apiServerURL: string, accessJWT: string): Promise<[boolean,UsersInfo]> {
    let usersInfo: UsersInfo = cloneDeep(initUsersInfo);
    if (accessJWT === "") { return([false,usersInfo]); }
    const usersUrl = apiServerURL+"/getusersinfo"
    if (!urlPatternValidation(usersUrl)) {return [false,usersInfo]}
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
    catch(err) {log.error("GetUsersInfo HTTP Error",err); return [false,usersInfo]}
    if (response && response.data) {
        if (response.data.hasOwnProperty("users")) {
            usersInfo = response.data.users
        }
    }
    return [true,usersInfo];
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
    catch(err) {log.error("UpdateUserInfo HTTP Error: ",err); return result}
    if (response && response.data) {
        if (response.data.hasOwnProperty("success")) {
            result=response.data.success
        }
    }
    return result;
}

export async function initialSetupActivities(db: PouchDB.Database, username: string) {
 //  Migration to the new listgroup structure will create for existing users, this is for new users added later, or for offline model
    log.debug("SETUP: Running Initial Setup Activities for :",username);
    let totalDocs: number = 0;
    try {totalDocs = (await db.info()).doc_count}
    catch(err) {log.error("Cannot retrieve doc count from local database"); return false;}
    let listGroupDocs: PouchDB.Find.FindResponse<{}>
    try {listGroupDocs = await db.find({ use_index:"stdTypeOwnerDefault",selector: { type: "listgroup", listGroupOwner: username},
         limit: totalDocs});}
    catch(err) {log.error("Cannot retrieve list groups from local database"); return false;}
    let recipeGroupFound = false;
    let nonRecipeGroupFound = false;
    if (listGroupDocs.docs.length !== 0) {
        for (const lgd of listGroupDocs.docs) {
            if ((lgd as ListGroupDoc).recipe) { recipeGroupFound = true} else { nonRecipeGroupFound=true}
        }
    }
    if (!nonRecipeGroupFound) {
        log.info("No default group found for ",username, "... creating now ...");
        const defaultListGroupDoc : ListGroupDoc = cloneDeep(ListGroupDocInit);
        defaultListGroupDoc.recipe = false;
        defaultListGroupDoc.name = username+" (default)";
        defaultListGroupDoc.listGroupOwner = username;
        let curDateStr=(new Date()).toISOString()
        defaultListGroupDoc.updatedAt = curDateStr;
        let response: PouchResponse = cloneDeep(PouchResponseInit);
        try { response.pouchData = await db.post(defaultListGroupDoc);}
        catch(err) { response.successful = false; response.fullError = err;}
        if (!response.pouchData.ok) { response.successful = false;}
        if (!response.successful) { log.error("Could not create new default listGroup for ",username); return;}
    }
    if (!recipeGroupFound) {
        log.info("No recipe group found for ",username, "... creating now ...");
        const recipeListGroupDoc : ListGroupDoc = cloneDeep(ListGroupDocInit);
        recipeListGroupDoc.recipe = true;
        recipeListGroupDoc.name = username+" (Recipes)";
        recipeListGroupDoc.listGroupOwner = username;
        let curDateStr=(new Date()).toISOString()
        recipeListGroupDoc.updatedAt = curDateStr;
        let response: PouchResponse = cloneDeep(PouchResponseInit);
        try { response.pouchData = await db.post(recipeListGroupDoc);}
        catch(err) { response.successful = false; response.fullError = err;}
        if (!response.pouchData.ok) { response.successful = false;}
        if (!response.successful) { log.error("Could not create new recipe listGroup for ",username); return;}
    }
    log.debug("SETUP: Initial Setup Complete")
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
    let newListRow = listCombinedRows.find(lcr => lcr.listOrGroupID === listOrGroupID);
    if (newListRow === undefined) {return null}
    else { return newListRow.listGroupID}
}

export function getRowTypeFromListOrGroupID(listOrGroupID: string, listCombinedRows: ListCombinedRows) : RowType | null {
    let newListRow = listCombinedRows.find(lcr => lcr.listOrGroupID === listOrGroupID);
    if (newListRow === undefined) {return null}
    else { return newListRow.rowType}
}

function getLoggingLevel(level: string) : number {
    let uLevel=level.toUpperCase();
    let retLevel: number = 3;
    if (["0","TRACE","T"].includes(uLevel)) {
        retLevel = 0 
    } else if (["1","DEBUG","D"].includes(uLevel)) {
        retLevel = 1
    } else if (["2","INFO","INFORMATION","I"].includes(uLevel)) {
        retLevel = 2
    } else if (["3","WARN","WARNING","W"].includes(uLevel)) {
        retLevel = 3
    } else if (["4","ERROR","E"].includes(uLevel)) {
        retLevel = 4
    } else if (["5","SILENT","S","NONE","N"].includes(uLevel)) {
        retLevel = 5
    } else {retLevel = 2}
    console.log("Setting log level to ",retLevel);
    return retLevel;
}

export class LogFileFactory extends MethodFactory {

    constructor (logger?: LogLevel) {
        super(logger);
        console.log("setup file write here...");
    }

    make(methodName: string) {
        const og = super.make(methodName);
        return (...args: any[]) => {}
    }

}

export function secondsToDHMS(seconds: number) : string {
    let d: number = 0; let h: number = 0; let m: number =0; let s : number = 0;
    if (seconds < 0) { seconds = seconds * -1;}
    d = Math.floor(seconds / (3600 * 24))
    h = Math.floor((seconds % (3600 * 24)) / 3600)
    m = Math.floor((seconds % 3600) / 60)
    s = Math.floor(seconds % 60) 
    let outStr = d>0 ? d + (t("general.days",{count: d})) + " " : "";
    outStr = outStr + h.toString().padStart(2,"0") + ":" + m.toString().padStart(2,"0") + ":" + s.toString().padStart(2,"0")
    return outStr;
}

export const DEFAULT_API_URL=(window as any)._env_.DEFAULT_API_URL === undefined ? "https://groceries.mydomain.com/api" : (window as any)._env_.DEFAULT_API_URL
export const LOG_LEVEL= (window as any)._env_.LOG_LEVEL === undefined ? "INFO" : (window as any)._env_.LOG_LEVEL
export const log = loglevelnext.create({name: "applogger", level: getLoggingLevel(LOG_LEVEL)})
