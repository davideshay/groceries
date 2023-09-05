export const couchdbUrl = (process.env.COUCHDB_URL == undefined) ? "" : process.env.COUCHDB_URL.endsWith("/") ? process.env.COUCHDB_URL.slice(0,-1): process.env.COUCHDB_URL;
export const couchdbInternalUrl = (process.env.COUCHDB_INTERNAL_URL == undefined) ? couchdbUrl : process.env.COUCHDB_INTERAL_URL?.endsWith("/") ? process.env.COUCHDB_INTERNAL_URL.slice(0,-1): process.env.COUCHDB_INTERNAL_URL;
export const couchDatabase = (process.env.COUCHDB_DATABASE == undefined) ? "" : process.env.COUCHDB_DATABASE;
export const couchKey = process.env.COUCHDB_HMAC_KEY;
export const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
export const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
export const refreshTokenExpires = (process.env.REFRESH_TOKEN_EXPIRES == undefined) ? "30d" : process.env.REFRESH_TOKEN_EXPIRES;
export const accessTokenExpires = (process.env.ACCESS_TOKEN_EXPIRES == undefined) ? "1d" : process.env.ACCESS_TOKEN_EXPIRES;
export const enableScheduling = (process.env.ENABLE_SCHEDULING == undefined) ? true : getBooleanFromText(process.env.ENABLE_SCHEDULING);
export const resolveConflictsFrequencyMinutes = (process.env.RESOLVE_CONFLICTS_FREQUENCY_MINUTES == undefined) ? 15 : process.env.RESOLVE_CONFLICTS_FREQUENCY_MINUTES;
export const expireJWTFrequencyMinutes = (process.env.EXPIRE_JWT_FREQUENCY_MINUTES == undefined) ? 10 : process.env.EXPIRE_JWT_FREQUENCY_MINUTES;
export const groceryUrl = (process.env.GROCERY_URL == undefined) ? "" : process.env.GROCERY_URL.endsWith("/") ? process.env.GROCERY_URL.slice(0,-1): process.env.GROCERY_URL;
export const groceryAPIUrl = (process.env.GROCERY_API_URL == undefined) ? "" : process.env.GROCERY_API_URL.endsWith("/") ? process.env.GROCERY_API_URL.slice(0,-1): process.env.GROCERY_API_URL;
export const groceryAPIPort = (process.env.GROCERY_API_PORT == undefined) ? "3333" : process.env.GROCERY_API_PORT;
export const disableAccountCreation = (process.env.DISABLE_ACCOUNT_CREATION == undefined) ? false : getBooleanFromText(process.env.DISABLE_ACCOUNT_CREATION);
export const logLevel = (process.env.LOG_LEVEL == undefined) ? "INFO" : process.env.LOG_LEVEL.toUpperCase();
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT);
const smtpSecure = Boolean(process.env.SMTP_SECURE);
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM;
export const couchStandardRole = "crud";
export const couchAdminRole = "dbadmin";
export const couchUserPrefix = "org.couchdb.user";
export const conflictsViewID = "_conflicts_only_view_id";
export const conflictsViewName = "conflicts_view";
export const utilitiesViewID = "_utilities";
const smtpOptions: SMTPTransport.Options= {
    host: smtpHost, port: smtpPort, 
    auth: { user: smtpUser, pass: smtpPassword}
};

import nodemailer from 'nodemailer';
import nanoAdmin, { DocumentListResponse,  MangoResponse, MaybeDocument } from 'nano';
const nanoAdminOpts = {
    url: couchdbInternalUrl,
    requestDefaults: {
        headers: { Authorization: "Basic "+ Buffer.from(couchAdminUser+":"+couchAdminPassword).toString('base64') }
    }
}
export let groceriesNanoAsAdmin = nanoAdmin(nanoAdminOpts);
export let usersNanoAsAdmin = nanoAdmin(nanoAdminOpts);
import { groceriesDBAsAdmin, usersDBAsAdmin, couchLogin } from './dbstartup';
import _ from 'lodash';
import { cloneDeep, isEmpty } from 'lodash';
import { usernamePatternValidation, fullnamePatternValidation, getUserDoc, getUserByEmailDoc,
    totalDocCount, isNothing, createNewUser, updateUnregisteredFriends, getFriendDocByUUID,
    UserResponse, CreateResponseType, checkDBAvailable, getImpactedUsers } from './utilities';
import { generateJWT, isValidToken, invalidateToken, JWTMatchesUserDB, TokenReturnType } from './jwt'     
import { NextFunction, Request, Response } from 'express';
import { CheckUseEmailReqBody, CheckUserExistsReqBody, CustomRequest, NewUserReqBody, RefreshTokenResponse, checkUserByEmailExistsResponse } from './datatypes';
import { ConflictDoc, FriendDoc, UserDoc, appVersion } from './schema/DBSchema';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import log from 'loglevel';

export function getBooleanFromText(val: string | boolean) {
    if (val === true) {return true}; if (val === false) {return false};
    let trueStrings=["TRUE","YES","1"];                                 
    return trueStrings.includes(String(val).toUpperCase());
}

export async function checkUserExists(req: CustomRequest<CheckUserExistsReqBody>, res: Response) {
    const { username } = req.body;
    let response = {
        username: username,
        userExists: false
    }
    let userResponse = await getUserDoc(username);
    response.userExists = !userResponse.error;
    log.info("Checking if user exists: ", response.username, " : ", response.userExists)
    return (response);
}

export async function checkUserByEmailExists(req: CustomRequest<CheckUseEmailReqBody>, res: Response) {
    const { email} = req.body;
    let response: checkUserByEmailExistsResponse = {
        username: "",
        fullname: "",
        email: "",
        userExists: true
    }
    let userResponse = await getUserByEmailDoc(email);
    if (userResponse.error) { response.userExists = false;}
    else {
        response.username = userResponse.username;
        response.email = userResponse.email;
        response.fullname = userResponse.fullname;
    }
    return (response);
}

export async function authenticateJWT(req: Request,res: Response,next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const tokenDecode: TokenReturnType = await isValidToken(token);
        if (!tokenDecode.isValid) {
            return res.sendStatus(403);
        }
        req.body.username = tokenDecode.payload?.sub;
        next();
    } else {
        res.sendStatus(401);
    }
}

export async function issueToken(req: Request, res: Response) {
    const { username, password, deviceUUID } = req.body;
    log.info("issuing token for device ID:", JSON.stringify(deviceUUID));
    let response = {
        dbServerAvailable: true,
        loginSuccessful: false,
        email: "",
        fullname: "",
        loginRoles: [],
        refreshJWT: "",
        accessJWT: "",
        couchdbUrl: couchdbUrl,
        couchdbDatabase: couchDatabase
    }
    let loginResponse = await couchLogin(username,password);
    if (!loginResponse.dbServerAvailable) {
        log.info("Could not contact Database Server. Auth failed:",deviceUUID," user:",username);
        response.dbServerAvailable = false;
        return (response);
    }
    if (!loginResponse.loginSuccessful) {
         log.info("Authentication failed for device: ",deviceUUID, " user: ",username);
         return (response);
        }     
    let userDoc: UserResponse = await getUserDoc(username);
    if (userDoc == null || userDoc.fullDoc == null ) return response;
    if (loginResponse.loginSuccessful && !(userDoc.error)) {
         response.loginSuccessful = loginResponse.loginSuccessful;
         response.loginRoles = loginResponse.loginRoles;
         response.email = userDoc.email;
         response.fullname = userDoc.fullname;
         response.refreshJWT = await generateJWT({username: username, deviceUUID: deviceUUID, includeRoles:false, timeString: refreshTokenExpires});
         response.accessJWT = await generateJWT({username: username, deviceUUID: deviceUUID, includeRoles:true, timeString: accessTokenExpires});
     }
     if (!userDoc.fullDoc?.hasOwnProperty('refreshJWTs')) {
        userDoc.fullDoc.refreshJWTs = {};
     }
     (userDoc.fullDoc.refreshJWTs as any)[deviceUUID] = response.refreshJWT;
     try {let userUpd = usersDBAsAdmin.insert(userDoc.fullDoc);}
     catch(err) {log.error("Could not update user: ",username,":",err); response.loginSuccessful=false;}
    return(response);

}

export async function refreshToken(req: Request, res: Response) : Promise<{status: number, response: RefreshTokenResponse}> {
    const { refreshJWT, deviceUUID } = req.body;
    log.info("Refreshing token for deviceUUID:",deviceUUID);
    // validate incoming refresh token
    //      valid by signature and expiration date
    //      matches most recent in user DB
    // if valid then:
    //       generate new access and refresh JWT
    //       update userDB with current JWT
    //       return access and refresh JWT
    let status = 200;
    let response = {
        valid : false,
        dbError: false,
        refreshJWT: "",
        accessJWT: ""
    }
    const tokenDecode: TokenReturnType = await isValidToken(refreshJWT);
    if (!tokenDecode.isValid || tokenDecode.payload == null) {
        status = 403;
        return({status, response});
    }
    if (tokenDecode.payload.deviceUUID !== deviceUUID) {
        log.debug("Token Payload device id: ",tokenDecode.payload.deviceUUID);
        log.debug("device UUID from body of request: ",deviceUUID);
        log.warn("SECURITY: Attempt to use refresh token with mis-matched device UUIDs. Invalidating all JWTs for ",tokenDecode.payload.sub);
        invalidateToken(String(tokenDecode.payload.sub),deviceUUID,true)
        status = 403;
        return({status, response});
    }
    if (! (await JWTMatchesUserDB(refreshJWT,deviceUUID, String(tokenDecode.payload.sub)))) {
        log.warn("SECURITY: Login for user ",tokenDecode.payload.sub,"  didn't match stored database JWT. Invalidating this device.");
        status = 403;
        await invalidateToken(String(tokenDecode.payload.sub), deviceUUID, false);
        return ({status, response});
    }
    response.valid = true;
    response.refreshJWT = await generateJWT({username: String(tokenDecode.payload.sub), deviceUUID: deviceUUID, includeRoles: false, timeString: refreshTokenExpires});
    response.accessJWT = await generateJWT({username: String(tokenDecode.payload.sub), deviceUUID: deviceUUID, includeRoles: true, timeString: accessTokenExpires});
    let userResponse: UserResponse = await getUserDoc(String(tokenDecode.payload.sub));
    if (userResponse == null || userResponse.fullDoc == null || userResponse.error) {
        if (userResponse.error) { response.dbError = true};
        response.valid = false; return {status, response};
    }
    (userResponse.fullDoc.refreshJWTs as any)[deviceUUID] = response.refreshJWT;
    try {let update = await usersDBAsAdmin.insert(userResponse.fullDoc);}
    catch(err) {log.error("ERROR: Could not update user(refresh token):",err); response.dbError = true; response.valid=false;}
    return ({status, response});
}

export async function logout(req: Request, res: Response) {
    const { refreshJWT, deviceUUID, username } = req.body;
    log.info("Logging out user: ", username, " for device: ",deviceUUID);
    let userResponse: UserResponse = await getUserDoc(username);
    if (userResponse == null || userResponse.fullDoc == null) {
        res.sendStatus(404);
        return;
    }
    (userResponse.fullDoc.refreshJWTs as any)[deviceUUID] = ""; 
    let update = null;
    try { update = await usersDBAsAdmin.insert(userResponse.fullDoc); res.sendStatus(200);}
    catch(err) { log.error("Problem logging out user: ",err); res.sendStatus(404); }
}

export async function registerNewUser(req: CustomRequest<NewUserReqBody>, res: Response) {
    const {username, password, email, fullname, deviceUUID} = req.body;
    log.info("Registering New User: ",username);
    const registerResponse = {
        invalidData: false,
        userAlreadyExists: false,
        createdSuccessfully: false,
        creationDisabled: false,
        idCreated: "",
        refreshJWT: "",
        accessJWT: "",
        couchdbUrl: couchdbUrl,
        couchdbDatabase: couchDatabase,
        email: email,
        fullname: fullname
    }

    if (disableAccountCreation) {
        registerResponse.creationDisabled=true;
        log.warn("Trying to register user "+username+ " but account creation disabled");
        return (registerResponse)
    }
    if (isNothing(username) || isNothing(password) || isNothing(email) || isNothing(fullname)) {
        registerResponse.invalidData = true;
        return (registerResponse);
    }
    let userDoc = await getUserDoc(username);
    if (!userDoc.error) {
        registerResponse.userAlreadyExists = true;
    } 
    log.debug("user already exists:",registerResponse.userAlreadyExists);
    if (!registerResponse.userAlreadyExists)  {
        let createResponse = await createNewUser({username: username, password: password, email: email, fullname: fullname}, deviceUUID);
        registerResponse.createdSuccessfully = !createResponse.error;
        registerResponse.idCreated = createResponse.idCreated;
        registerResponse.refreshJWT = String(createResponse.refreshJWT);
        registerResponse.accessJWT = String(createResponse.accessJWT);
        let updateFriendResponse = await updateUnregisteredFriends(req,email)
    }
    return (registerResponse);
}

export type GetUsersInfoResponse = {
    error: boolean,
    users: { name: string, email: string, fullname: string} []
}

export async function getUsersInfo (req: Request, res: Response) : Promise<GetUsersInfoResponse>  {
    // input - json list of userIDs : userIDs: ["username1","username2"] -- should be _users ids 
    //        without the org.couchdb.user prefix
    // return - json array of objects:
    //        [ {userID: "username1", email: "username1@gmail.com", fullName: "User 1"},
    //          {userID: "username2", email: "username2@yahoo.com", fullName: "User 2"}]

    const getResponse: GetUsersInfoResponse = {
        error: false,
        users: []
    }
    if (isNothing(req.body?.userIDs)) {getResponse.error=true; return (getResponse)}
    const requestData: { keys: string[], include_docs: boolean} = { keys: [], include_docs: true }
    req.body.userIDs.forEach((uid: string) => { requestData.keys.push(String(couchUserPrefix)+":"+String(uid)) });
    let userRes: DocumentListResponse<UserDoc> | null = null;
    try { userRes = (await usersDBAsAdmin.list(requestData) as DocumentListResponse<UserDoc>);}
    catch(err) { log.error("Problem retrieving users: ",err); getResponse.error= true }
    if (!getResponse.error && !(userRes == null)) {
        userRes.rows.forEach(el => {
            getResponse.users.push({name: String(el.doc?.name), email: String(el.doc?.email), fullname: String(el.doc?.fullname)})
        });
    }
    return(getResponse);
}

type UpdateUserInfoResponse = {
    success: boolean
}
export async function updateUserInfo(req: Request, res: Response): Promise<UpdateUserInfoResponse> {
    let userResp: UpdateUserInfoResponse = {success: false};
    if (isEmpty(req.body?.name) || isEmpty(req.body?.fullname) || isEmpty(req.body?.email)) {
        return userResp;
    }
    if (req.body?.name !== req.body?.username) {return userResp;}
    let userDoc = await getUserDoc(req.body.name);
    if (userDoc.error || userDoc.fullDoc === null) {return userResp}
    userDoc.fullDoc.email = req.body.email;
    userDoc.fullDoc.fullname = req.body.fullname;
    let updateSuccessful = true;
    try { await usersDBAsAdmin.insert(userDoc.fullDoc); }
    catch(e) {updateSuccessful = false;log.error("Could not update user info:",e);}
    userResp.success = updateSuccessful;
    return userResp;
}

export async function createAccountUIGet(req: Request, res: Response) {
    // input - query parameter - uuid
    // creates a form pre-filled with email address (cannot change), username,full name, and password
    // on submit (to different endpoint?),
    // check if username or email already exists, if so, error out,
    // otherwise reqister new user

    let respObj = {
        uuid: req.query.uuid,
        email: "testemail",
        fullname: "",
        username: "",
        password: "",
        passwordverify: "",
        formError: "",
        disableSubmit: false,
        createdSuccessfully: false
    }
    const uuidq = {
        selector: { type: { "$eq": "friend" }, inviteUUID: { "$eq": req.query.uuid}},
        fields: [ "friendID1","friendID2","inviteUUID","inviteEmail","friendStatus"],
        limit: await totalDocCount(groceriesDBAsAdmin)
    }
    let foundFriendDocs: MangoResponse<FriendDoc> | null = null;
    try {foundFriendDocs =  (await groceriesDBAsAdmin.find(uuidq) as MangoResponse<FriendDoc>);}
    catch(err) {log.error("Could not find friend documents:",err);
                respObj.formError="Database Error Encountered";
                return respObj;}
    let foundFriendDoc;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    else {
        respObj.formError = "Registration ID not found. Cannot complete registration process."
        respObj.disableSubmit = true;
        return (respObj);
    };
    respObj.email = foundFriendDoc.inviteEmail;

    if (foundFriendDoc.friendStatus != "WAITREGISTER") {
        respObj.formError = "Registration already completed. Please login to the app directly."
        respObj.disableSubmit = true;
        return (respObj);
    }

    return(respObj);

}


export async function createAccountUIPost(req: Request,res: Response) {

    let respObj = {
        uuid: req.body.uuid,
        email: req.body.email,
        username: (req.body.username == undefined) ? "" : req.body.username,
        fullname: (req.body.fullname == undefined) ? "" : req.body.fullname,
        password: (req.body.password == undefined) ? "" : req.body.password,
        passwordverify: (req.body.passwordverify == undefined) ? "" : req.body.passwordverify,
        refreshjwt: "",
        formError: "",
        disableSubmit: false,
        createdSuccessfully: false
    }

    if (disableAccountCreation) {
        respObj.formError = "Account Creation is Disabled For this Service. Contact Administrator."
        return (respObj);
    }
    if (req.body.fullname.length < 2 ) {
        respObj.formError = "Please enter a full name 3 characters or longer";
        return (respObj);} 
    if (!fullnamePatternValidation(req.body.fullname)) {
        respObj.formError = "Please enter a valid full name";
        return (respObj);}
    if (req.body.username.length < 5 ) {
        respObj.formError = "Please enter a username 5 characters or longer";
        return (respObj); } 
    if (!usernamePatternValidation(req.body.username)) {
        respObj.formError = "Please enter a valid username";
        return (respObj); }
    if (req.body.password.length < 5 ) {
        respObj.formError = "Please enter a password 5 characters or longer";
        return (respObj);} 
    if (req.body.password != req.body.passwordverify) {
        respObj.formError = "Passwords do not match";
        return (respObj);}
    let foundUserDoc; let userAlreadyExists=true;
    try {
        foundUserDoc =  await usersDBAsAdmin.get(couchUserPrefix+":"+req.body.username);}
    catch(e) { userAlreadyExists=false;}    
    if (userAlreadyExists) {
        respObj.formError = "Username already exists, plase choose a new one";
        return(respObj);
    }

    // create user doc
    const userObj = {
        username: req.body.username,
        fullname: req.body.fullname,
        email: req.body.email,
        password: req.body.password
    }

    let userIDRes: CreateResponseType = await createNewUser(userObj,"");
    if (userIDRes == null || userIDRes?.error) { respObj.formError = "Could Not Create User"; return respObj}
    respObj.refreshjwt = String(userIDRes.refreshJWT);

    // change friend doc to registered
    let foundFriendDoc = await getFriendDocByUUID(req.body.uuid);
    if (foundFriendDoc!=null) {
        foundFriendDoc.friendID2 = req.body.username;
        foundFriendDoc.friendStatus = "PENDFROM1";
        foundFriendDoc.updatedAt = (new Date()).toISOString();
        let updateSuccessful = true;
        try { await groceriesDBAsAdmin.insert(foundFriendDoc); }
        catch(e) {updateSuccessful = false;}
    }

    const emailq = {
        selector: { type: { "$eq": "friend" }, inviteEmail: { "$eq": req.body.email},
                    limit: totalDocCount(groceriesDBAsAdmin)}
    }
    let foundFriendDocs : MangoResponse<FriendDoc>;
    try {foundFriendDocs =  (await groceriesDBAsAdmin.find(emailq) as MangoResponse<FriendDoc>);}
    catch(err) {log.error("Could not find friend by email:",err); 
                respObj.formError="Database error finding friend by email";
                return respObj;}
    foundFriendDoc = null;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    foundFriendDocs.docs.forEach(async (doc) => {
        if ((doc.inviteUUID != req.body.uuid) && (doc.friendStatus == "WAITREGISTER")) {
            doc.friendID2 = req.body.username;
            doc.friendStatus = "PENDFROM1";
            doc.updatedAt = (new Date()).toISOString();
            let update2Success=true;
            try { await groceriesDBAsAdmin.insert(doc);} 
            catch(e) {update2Success = false;}
        }
    });

    respObj.createdSuccessfully = true;
    return(respObj);
}

export async function triggerRegEmail(req: Request, res: Response) {
    const triggerResponse = {
        emailSent : false
    }
    const {uuid} = req.body;
    if (isNothing(uuid)) {return (triggerResponse);}
    let foundFriendDoc = await getFriendDocByUUID(req.body.uuid);
    if (foundFriendDoc == undefined) {return triggerResponse;};
    let userDoc = await getUserDoc(foundFriendDoc.friendID1);
    if (userDoc.error) {return triggerResponse};
    
    let transport = nodemailer.createTransport(smtpOptions);
    transport.verify(function (error,success) {
        if (error) {return triggerResponse}
    })

    let confURL = groceryAPIUrl + "/createaccountui?uuid="+foundFriendDoc.inviteUUID;

    const message = {
        from: smtpFrom,
        to: foundFriendDoc.inviteEmail,
        subject: "User Creation request from Groceries",
        text: userDoc.fullname+" has requested to share lists with you on the Groceries App. Please use the link to register for an account: "+confURL+ " . Once registered, visit "+groceryUrl+" to use the app."
    }

    transport.sendMail(message, function (error, success) {
        if (!error) {return triggerResponse}
    });
    triggerResponse.emailSent = true;

    return (triggerResponse);
}

export async function resetPassword(req: Request, res: Response) {
    const resetResponse = {
        emailSent : false
    }
    const {username} = req.body;

    let userDoc = await getUserDoc(username);
    if (userDoc.error) {return resetResponse};

    let transport = nodemailer.createTransport(smtpOptions);
    transport.verify(function (error,success) {
        if (error) {return resetResponse}
    })

    let resetURL = groceryAPIUrl + "/resetpasswordui?username="+encodeURIComponent(username);
    const message = {
        from: smtpFrom,
        to: userDoc.email,
        subject: "Password Reset Request from Groceries",
        text: userDoc.fullname+" has requested to reset their password. If you did not request this reset, please validate the security of this account. Please use the link to reset your password: "+resetURL+ " . Once reset, visit "+groceryUrl+" to use the app or login on your mobile device.."
    }

    transport.sendMail(message, function (error, success) {
        if (!error) {return resetResponse}
    });
    resetResponse.emailSent = true;
    return resetResponse;
}    

export async function resetPasswordUIGet(req: Request, res: Response) {
    let respObj = {
        email: "",
        username: String(req.query.username),
        password: "",
        passwordverify: "",
        formError: "",
        disableSubmit: false,
        resetSuccessfully: false
    }
    
    let userDoc = await getUserDoc(String(req.query.username));
    if (userDoc.error) {
        respObj.formError = "Cannot locate user name "+req.query.username;
        respObj.disableSubmit = true;
        return respObj
    }
    respObj.email = userDoc.email;
    return respObj;
}

export async function resetPasswordUIPost(req: Request, res: Response) {
    let respObj = {
        username: req.body.username,
        password: (req.body.password == undefined) ? "" : req.body.password,
        passwordverify: (req.body.passwordverify == undefined) ? "" : req.body.passwordverify,
        email: (req.body.email),
        formError: "",
        disableSubmit: false,
        resetSuccessfully: false
    }
    if (req.body.password.length < 5 ) {
        respObj.formError = "Please enter a password 5 characters or longer";
        return (respObj);
    } 
    if (req.body.password != req.body.passwordverify) {
        respObj.formError = "Passwords do not match";
        return (respObj);
    }

    let userResponse: UserResponse = await getUserDoc(req.body.username);
    if (userResponse == null || userResponse.fullDoc == null) {
        respObj.resetSuccessfully = false;
        return respObj;
    }
    if (!userResponse.error) {
        let newDoc: UserDoc =cloneDeep(userResponse.fullDoc);
        newDoc.password=req.body.password;
        let newDocFiltered = _.pick(newDoc,['_id','_rev','name','email','fullname','roles','type','password','refreshJWTs']);
        try {let docupdate = await usersDBAsAdmin.insert(newDocFiltered);}
        catch(err) {log.error("Couldn't update user/reset password:",err);
                    respObj.formError="Database error resetting password";
                    respObj.resetSuccessfully=false;
                    return respObj;}
    }
    respObj.resetSuccessfully = true;
    return(respObj);
}

export async function isAvailable(req: Request, res: Response) {
    let respObj = {
        apiServerAvailable: true,
        dbServerAvailable : await checkDBAvailable(groceriesDBAsAdmin),
        apiServerAppVersion: appVersion
    };
    log.debug("Server checking availability:",respObj);
    return(respObj);
}

export async function resolveConflicts(): Promise<boolean> {
    let conflicts;
    try {conflicts = await groceriesDBAsAdmin.view(conflictsViewID,conflictsViewName);}
    catch(err) {log.error("Couldn't access conflicts view:",err); return false;}
    log.info("Resolving all conflicts started...");
    let resolveFailure=false;
    if (conflicts.rows?.length <= 0) {log.info("No conflicts found"); return true;};
    outerloop: for (let i = 0; i < conflicts.rows.length; i++) {
        const conflict = conflicts.rows[i];
        let curWinner: any;
        try { curWinner = await groceriesDBAsAdmin.get(conflict.id, {conflicts: true});}
        catch(err) { log.error("Error resolving conflicts:",err); resolveFailure = true; return false;}
        if (curWinner == undefined || curWinner == null) { resolveFailure = true;}
        if (resolveFailure) {continue};
        let latestDocTime = curWinner.updatedAt; 
        let latestIsCurrentWinner = true;
        let latestDoc = curWinner;
        let bulkObj: { docs: [{_id: string, _rev: string, _deleted: boolean}?]} = { docs:[] };
        let logObj: ConflictDoc = { type: "conflictlog",
                docType: curWinner.type, impactedUsers: [], winner: {}, losers: [], updatedAt: ""};
        for (let j = 0; j < curWinner._conflicts.length; j++) {
            const losingRev = curWinner._conflicts[j];
            let curLoser: any;
            try { curLoser = await groceriesDBAsAdmin.get(conflict.id,{ rev: losingRev})}
            catch(err) {log.error("Error resolving conflicts:",err); resolveFailure=true; return false;}
            if ( curLoser == null || curLoser == undefined) { resolveFailure = true;}
            if (resolveFailure) {continue outerloop};
            if (curLoser.updatedAt >= latestDocTime) {
                latestIsCurrentWinner = false;
                latestDocTime = curLoser.updatedAt;
                latestDoc = curLoser;
            } else {
                bulkObj.docs.push({_id: curLoser._id, _rev: losingRev ,_deleted: true})
                logObj.losers.push(curLoser);
            }
        }
        let resolvedTime = (new Date()).toISOString();
        latestDoc.updatedAt = resolvedTime;
        logObj.updatedAt = resolvedTime;
        bulkObj.docs.push(latestDoc);
        logObj.winner = latestDoc;
        if (!latestIsCurrentWinner) {
            bulkObj.docs.push({_id: curWinner._id, _rev: curWinner._rev, _deleted: true});
            logObj.losers.push(curWinner);
        }
        let bulkResult;
        try { bulkResult = await groceriesDBAsAdmin.bulk(bulkObj) }
        catch(err) {log.error("Error updating bulk docs on conflict resolve"); resolveFailure=true; return false;}
        log.info("Bulk Update to resolve doc id : ",conflict.id, " succeeded");
        let impactedUsersSet = await getImpactedUsers(logObj.winner);
        for (const loser of logObj.losers) {
            let loserUsers = await getImpactedUsers(loser);
            impactedUsersSet = new Set([...impactedUsersSet,...loserUsers])
        }
        logObj.impactedUsers = Array.from(impactedUsersSet);
        let logResult;
        try { logResult = await groceriesDBAsAdmin.insert(logObj as MaybeDocument)}
        catch(err) { log.error("ERROR: creating conflict log document failed: ",err); return false;};        
    }
    return true;
}

export async function triggerResolveConflicts(req: Request,res: Response) {
    let respObj = {
        triggered: true
    };
    resolveConflicts()
    return respObj;
}

async function compactDB() {
    groceriesNanoAsAdmin.db.compact(couchDatabase);
}

export async function triggerDBCompact(req: Request,res: Response) {
    let respObj = {
        triggered: true
    };
    compactDB();
    return respObj;
}

