import { couchdbInternalUrl, couchAdminPassword, couchAdminUser, couchDatabase, logLevel } from './config.js';
import nanoAdmin, { DocumentScope,  MangoQuery,  MangoResponse, MaybeDocument } from 'nano';
import { isInteger } from './utilityfunctions.js';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import log from "loglevel"
const nanoAdminOpts = {
    url: couchdbInternalUrl,
    headers: { Authorization: "Basic "+ Buffer.from(couchAdminUser+":"+couchAdminPassword).toString('base64') }
}

export let groceriesNanoAsAdmin = nanoAdmin(nanoAdminOpts);
export let usersNanoAsAdmin = nanoAdmin(nanoAdminOpts);
export let groceriesDBAsAdmin: DocumentScope<unknown>;
export let usersDBAsAdmin: DocumentScope<unknown>;

export function setGroceriesDBAsAdmin(): boolean {
    try {groceriesDBAsAdmin = groceriesNanoAsAdmin.use(couchDatabase);}
    catch(err) {log.error("Could not open grocery database:",err); return false;}
    return true;
}

export function setUsersDBAsAdmin(): boolean {
    try {usersDBAsAdmin = usersNanoAsAdmin.use("_users");}
    catch(err) {log.error("Could not open users database:", err); return false;}
    return true;
}

export async function couchLogin(username: string, password: string) {
    const loginResponse = {
        dbServerAvailable: true,
        loginSuccessful: true,
        loginRoles: []
    }
    const config: AxiosRequestConfig = {
        method: 'get',
        url: couchdbInternalUrl+"/_session",
        auth: { username: username, password: password},
        responseType: 'json'
    }
    let res: AxiosResponse| null;
    try  {res = await axios(config)}
    catch(err: any) { log.debug("auth error for _session:",err.response.status);
                loginResponse.loginSuccessful = false;
                let httpResponseExists = (err && err.response && err.response.status && isInteger(err.response.status));
                if (!httpResponseExists) {
                    loginResponse.dbServerAvailable = false
                } else {
                    let httpResponse = Number(err.response.status);
                    if (httpResponse >= 500 && httpResponse <= 599) {
                        loginResponse.dbServerAvailable = false
                    }
                }
                return loginResponse};
    if (res == null) {loginResponse.loginSuccessful = false; return loginResponse}
    if (loginResponse.loginSuccessful) {
        if (res.status != 200) {
            loginResponse.loginSuccessful = false;
        }
        if (loginResponse.loginSuccessful && (res.data.ok != true)) {
            loginResponse.loginSuccessful = false;
        }
    }
    if (loginResponse.loginSuccessful) {
        loginResponse.loginRoles = res.data.userCtx.roles;
    }
    return(loginResponse);
}
