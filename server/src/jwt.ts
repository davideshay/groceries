const jose = require('jose');
import { JWTPayload } from 'jose';
import { usersDBAsAdmin } from './dbstartup';
import { couchKey, couchStandardRole } from './apicalls';
import { getUserDoc } from './utilities';
import { isEqual, isEmpty } from 'lodash';
import {UserDoc} from './DBSchema'
import { DocumentListResponse, MangoResponse } from 'nano';

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
    let jwtResponse = null;
    let returnValue: TokenReturnType = {
        isValid: false,
        protectedHeader: null,
        payload: TokenPayloadInit,
        error : null
    };
    try { jwtResponse = await jose.jwtVerify(refreshJWT, JWTKey); }
    catch(err) { returnValue.isValid = false; returnValue.error = err;
            return returnValue;}
    if (jwtResponse.hasOwnProperty("payload") && jwtResponse.hasOwnProperty("protectedHeader")) {
        if (jwtResponse.payload.hasOwnProperty("sub")) {
            returnValue.isValid = true;
//            returnValue.protectedHeader = jwtResponse.protectedHeader;
            returnValue.payload = jwtResponse.payload as TokenPayload;
        }
    }        
    return returnValue;
}

export async function generateJWT ({ username, deviceUUID, timeString, includeRoles}: {username: string, deviceUUID: string, timeString: string, includeRoles: boolean}) {
    const alg = "HS256";
    const secret = new TextEncoder().encode(couchKey);
    const payload: JWTPayload = {'sub': username, 'deviceUUID': deviceUUID};
    if (includeRoles) { 
        payload["_couchdb.roles"] =  [couchStandardRole];
        payload["tokenType"] = "access"
    } else {
        payload["tokenType"] = "refresh"
    }
    const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime(timeString)
        .sign(secret);  
    return (jwt);
}

export async function JWTMatchesUserDB(refreshJWT: string, deviceUUID: string, username: string) {
    let userDoc: any = await getUserDoc(username);
    if (userDoc.fullDoc.hasOwnProperty('refreshJWTs')) {
        console.log("STATUS: Refresh JWT matches the database:",userDoc.fullDoc.refreshJWTs[deviceUUID] == refreshJWT);    
    }
    if (userDoc.error) { return false;}
    if (userDoc.fullDoc.name !== username) { return false;}
    if (!userDoc.fullDoc.hasOwnProperty("refreshJWTs")) { return false;}
    if (userDoc.fullDoc.refreshJWTs[deviceUUID] !== refreshJWT) { return false;}
    return true;
}

export async function invalidateToken(username: string, deviceUUID: string, invalidateAll: boolean) {
    console.log("STATUS: invalidating token now...");
    let userDoc: any = await getUserDoc(username);
    if (userDoc.error) { return false;}
    if (userDoc.fullDoc.name !== username) { return false;}
    if (!userDoc.fullDoc.hasOwnProperty("refreshJWTs")) { return false;}
    if (invalidateAll) {
        userDoc.fullDoc.refreshJWTs = {};
    } else {
        userDoc.fullDoc.refreshJWTs[deviceUUID] = {};
    }    
    try { let res = await usersDBAsAdmin.insert(userDoc.fullDoc); }
    catch(err) { console.log("ERROR: problem invalidating token: ",err); return false; }
    console.log("STATUS: token now invalidated");
    return true;
}

export async function expireJWTs() {
    console.log("STATUS: Checking for expired JWTs");
    let res: DocumentListResponse<unknown> | null = null;
    try {res = (await usersDBAsAdmin.list({include_docs: true})) ;}
    catch(err) {console.log("ERROR: Could not find user records to expire JWTs:",err); return false;}
    if (res == null || !res.hasOwnProperty("rows")) { console.log("ERROR: No user rows found"); return false;}
    for (let i = 0; i < res.rows.length; i++) {
        const userDoc: UserDoc = (res.rows[i].doc as UserDoc);
        if (userDoc.hasOwnProperty("refreshJWTs")) {
            let updateJWTs: any = {};
            for (const [device,jwt] of Object.entries(userDoc.refreshJWTs)) {
                if (isEmpty(jwt)) {continue;}
                let jwtVerify = await isValidToken(String(jwt));
                if (jwtVerify.isValid) {updateJWTs[device] = jwt}
            }
            if (!isEqual(updateJWTs,userDoc.refreshJWTs)) {
                userDoc.refreshJWTs=updateJWTs;
                try { let response=usersDBAsAdmin.insert(userDoc); }
                catch(err) {console.log("ERROR updating JWTs for user ", userDoc._id, err)}
                console.log("STATUS: Expired JWTs for user ",userDoc._id);
            } 
        }
    }
    console.log("STATUS: Finished checking for expired JWTs");
}

