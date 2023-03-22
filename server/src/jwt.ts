import jose from 'jose';
import { usersDBAsAdmin } from './dbstartup';
import { couchKey, couchStandardRole } from './apicalls';
import { getUserDoc } from './utilities';
import { isEqual, isEmpty } from 'lodash';

const JWTKey = new TextEncoder().encode(couchKey);

export async function isValidToken(refreshJWT) {
    let jwtResponse = null;
    let returnValue = {
        isValid: false,
        protectedHeader: null,
        payload: null,
        error : null
    };
    try { jwtResponse = await jose.jwtVerify(refreshJWT, JWTKey); }
    catch(err) { returnValue.isValid = false; returnValue.error = err;
            return returnValue;}
    if (jwtResponse.hasOwnProperty("payload") && jwtResponse.hasOwnProperty("protectedHeader")) {
        if (jwtResponse.payload.hasOwnProperty("sub")) {
            returnValue.isValid = true;
            returnValue.protectedHeader = jwtResponse.protectedHeader;
            returnValue.payload = jwtResponse.payload;
        }
    }        
    return returnValue;
}

export async function generateJWT({ username, deviceUUID, timeString, includeRoles}) {
    const alg = "HS256";
    const secret = new TextEncoder().encode(couchKey);
    const payload = {'sub': username, 'deviceUUID': deviceUUID};
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

export async function JWTMatchesUserDB(refreshJWT, deviceUUID, username) {
    let userDoc: any = await getUserDoc(username);
    if (userDoc.fullDoc.hasOwnProperty('refreshJWTs')) {
        console.log("Refresh JWT matches the database:",userDoc.fullDoc.refreshJWTs[deviceUUID] == refreshJWT);    
    }
    if (userDoc.error) { return false;}
    if (userDoc.fullDoc.name !== username) { return false;}
    if (!userDoc.fullDoc.hasOwnProperty("refreshJWTs")) { return false;}
    if (userDoc.fullDoc.refreshJWTs[deviceUUID] !== refreshJWT) { return false;}
    return true;
}

export async function invalidateToken(username, deviceUUID, invalidateAll) {
    console.log("invalidating token now...");
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
    console.log("token now invalidated");
    return true;
}

export async function expireJWTs() {
    console.log("STATUS: Checking for expired JWTs");
    let userDocs;
    try {userDocs = await usersDBAsAdmin.list({include_docs: true});}
    catch(err) {console.log("ERROR: Could not find user records to expire JWTs:",err); return false;}
    for (let i = 0; i < userDocs.rows.length; i++) {
        const userDoc = userDocs.rows[i].doc;
        if (userDoc.hasOwnProperty("refreshJWTs")) {
            let updateJWTs = {};
            for (const [device,jwt] of Object.entries(userDoc.refreshJWTs)) {
                if (isEmpty(jwt)) {continue;}
                let jwtVerify = await isValidToken(jwt);
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

