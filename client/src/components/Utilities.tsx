import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { GlobalState } from './GlobalState';
import { RemoteDBState } from './RemoteDBState';

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

export async function checkUserByEmailExists(email: string, remoteDBState: RemoteDBState) {
    let response: HttpResponse | undefined;
    const options = {
        url: String(remoteDBState.dbCreds?.apiServerURL+"/checkuserbyemailexists"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteDBState.dbCreds?.JWT },
        data: {
            email: email,
        }           
    };
    console.log("about to execute checkuser httpget with options: ", {options})
    response = await CapacitorHttp.post(options);
    console.log("got httpget response: ",{response});
    return response.data;
}

// export const DEFAULT_API_URL="https://groceries.shaytech.net/api"
export const DEFAULT_API_URL=(window as any)._env_.DEFAULT_API_URL
