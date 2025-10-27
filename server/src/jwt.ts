import * as jose from 'jose';
import { JWTPayload } from 'jose';
import { usersDBAsAdmin } from './dbconfig.js';
import { couchKey } from './config.js';
import { getUserDoc } from './utilities.js';
import { isEqual, isEmpty } from 'lodash-es';
import {UserDoc} from './schema/DBSchema.js'
import { DocumentListResponse } from 'nano';
import log from 'loglevel';

const JWTKey = new TextEncoder().encode(couchKey);

export type TokenPayload = {
    sub: string,
    deviceUUID: string
}

export const TokenPayloadInit: TokenPayload = {
    sub: "",
    deviceUUID: ""
}

export type TokenReturnType = {
    isValid: boolean,
    protectedHeader: null | string,
    payload: null | JWTPayload,
    error: any
}

export async function isValidToken(refreshJWT: string) {
//    log.debug("Validating token:",refreshJWT);
    let jwtResponse = null;
    let returnValue: TokenReturnType = {
        isValid: false,
        protectedHeader: null,
        payload: TokenPayloadInit,
        error : null
    };
    try { jwtResponse = await jose.jwtVerify(refreshJWT, JWTKey); }
    catch(err) { 
        returnValue.isValid = false; returnValue.error = err;
        log.error("JWT Verify error:",err);
        return returnValue;}
    if (jwtResponse.hasOwnProperty("payload") && jwtResponse.hasOwnProperty("protectedHeader")) {
        if (jwtResponse.payload.hasOwnProperty("sub")) {
            returnValue.isValid = true;
//            returnValue.protectedHeader = jwtResponse.protectedHeader;
            returnValue.payload = jwtResponse.payload as TokenPayload;
        }
    }
//    log.debug("Returning JWT data:",returnValue);
    return returnValue;
}

export async function JWTMatchesUserDB(refreshJWT: string, deviceUUID: string, username: string) {
    let userDoc: any = await getUserDoc(username);
    if (userDoc.fullDoc === null) { userDoc.error=true; return false };
    if (userDoc.fullDoc.hasOwnProperty('refreshJWTs')) {
        log.debug("Check JWT for ",deviceUUID,"and user",username);
        log.info("Refresh JWT matches the database:",userDoc.fullDoc.refreshJWTs[deviceUUID] == refreshJWT);    
    }
    if (userDoc.error) { return false;}
    if (userDoc.fullDoc.name !== username) { return false;}
    if (!userDoc.fullDoc.hasOwnProperty("refreshJWTs")) { return false;}
    if (userDoc.fullDoc.refreshJWTs[deviceUUID] !== refreshJWT) { return false;}
    return true;
}

export async function invalidateToken(username: string, deviceUUID: string, invalidateAll: boolean) {
    log.info("Invalidating token now... user:",username," for device: ",deviceUUID," for all devices? ",invalidateAll);
    let userDoc: any = await getUserDoc(username);
    if (userDoc.error) { return false;}
    if (userDoc.fullDoc.name !== username) { return false;}
    if (!userDoc.fullDoc.hasOwnProperty("refreshJWTs")) { return false;}
    if (invalidateAll) {
        userDoc.fullDoc.refreshJWTs = {};
    } else {
        userDoc.fullDoc.refreshJWTs[deviceUUID] = {};
    }    
    try { await usersDBAsAdmin.insert(userDoc.fullDoc); }
    catch(err) { log.error("Problem invalidating token: ",err); return false; }
    log.info("Token now invalidated");
    return true;
}

export async function expireJWTs(): Promise<boolean> {
    log.info("Checking for expired JWTs");
    let res: DocumentListResponse<unknown> | null = null;
    try {res = (await usersDBAsAdmin.list({include_docs: true})) ;}
    catch(err) {log.error("Could not find user records to expire JWTs:",err); return false;}
    if (res == null || !res.hasOwnProperty("rows")) { log.error("No user rows found"); return false;}
    for (let i = 0; i < res.rows.length; i++) {
        const userDoc: UserDoc = (res.rows[i].doc as UserDoc);
        if (!userDoc.hasOwnProperty("type")) {continue;}
        if (userDoc.type !== "user") {continue;}
        log.debug("Checking JWT for "+userDoc.name)
        if (userDoc.hasOwnProperty("refreshJWTs")) {
            let updateJWTs: any = {};
            for (const [device,jwt] of Object.entries(userDoc.refreshJWTs)) {
//                log.debug("Checking JWT for ",device);
                if (isEmpty(jwt)) {continue;}
                let jwtVerify = await isValidToken(String(jwt));
                if (jwtVerify.isValid) {updateJWTs[device] = jwt}
            }
            if (!isEqual(updateJWTs,userDoc.refreshJWTs)) {
                userDoc.refreshJWTs=updateJWTs;
                try { usersDBAsAdmin.insert(userDoc); }
                catch(err) {log.error("Updating JWTs for user ", userDoc._id, err); return false;}
                log.info("Expired JWTs for user ",userDoc._id);
            } 
        }
    }
    log.info("Finished checking for expired JWTs");
    return true;
}

