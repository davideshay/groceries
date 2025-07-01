import { couchUserPrefix, couchStandardRole, accessTokenExpires, refreshTokenExpires } from "./apicalls";
import { usersDBAsAdmin, groceriesDBAsAdmin } from './dbstartup';
import { generateJWT } from "./jwt";
import { UserDoc, FriendDoc, FriendDocs, ListGroupDocs, ListGroupDoc} from './schema/DBSchema'
import nano, { DatabaseGetResponse, DocumentScope, MangoQuery, MangoResponse, MaybeDocument } from "nano";
import { cloneDeep } from "lodash";
import { NewUserReqBody, UserObj } from "./datatypes";
import log from 'loglevel';

export const uomContent = require("../data/uomContent.json")
export const globalItems = require("../data/globalItems.json");
export const categories = require("../data/categories.json");

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

export async function totalDocCount(db: DocumentScope<unknown>) {
    let info: DatabaseGetResponse;
    let records = 0;
    try { info = await db.info();}
    catch(err) {log.error("No returned info from database:",err); return records;}
    return info.doc_count;
}

export async function checkDBAvailable(db: DocumentScope<unknown>) {
    try {await db.info();}
    catch(err) {log.error("No returned info from database",err); return false};
    return true;
}

export type UserResponse = {
    error: boolean,
    username: string,
    fullname: string,
    email: string,
    fullDoc: UserDoc | null
}

const UserResponseInit: UserResponse = {
    error: false,
    username: "",
    fullname: "",
    email: "",
    fullDoc: null
}

export async function getUserDoc(username: string) {
    const userResponse = cloneDeep(UserResponseInit)
    let res: UserDoc | null = null;
    try { res = (await usersDBAsAdmin.get(couchUserPrefix+":"+username) as UserDoc | null)}
    catch(err) { userResponse.error= true; log.warn("Couldn't retrieve user doc:"+username) }
    if (!userResponse.error) {
        userResponse.email = String(res?.email);
        userResponse.fullname = String(res?.fullname);
        userResponse.fullDoc = res;
    }
    return (userResponse);
}

export async function getUserByEmailDoc(email: string) {
    const userResponse  = cloneDeep(UserResponseInit);
    const query: MangoQuery={selector: {"email": {"$eq": email}}, limit: await totalDocCount(usersDBAsAdmin)};
    let res: MangoResponse<unknown> | null = null;
    try { res = (await usersDBAsAdmin.find(query) );}
    catch(err) { log.error("ERROR getting user by email:"); userResponse.error= true }
    if (!userResponse.error) {
        if (res != null && res.hasOwnProperty("docs")) {
            if (res.docs.length > 0) {
                let resDoc: UserDoc = res.docs[0] as UserDoc;
                userResponse.username = String(resDoc.name);
                userResponse.email = String(resDoc.email);
                userResponse.fullname = String(resDoc.fullname);
            } else {
                userResponse.error = true;
            }
        } else { userResponse.error = true}
    }
    return (userResponse);
}

export async function getUserByResetUUIDDoc(uuid: string) {
    const userResponse  = cloneDeep(UserResponseInit);
    const query: MangoQuery={selector: {"reset_password_uuid": {"$eq": uuid}}, limit: await totalDocCount(usersDBAsAdmin)};
    let res: MangoResponse<unknown> | null = null;
    try { res = (await usersDBAsAdmin.find(query) );}
    catch(err) { log.error("ERROR getting user by email:"); userResponse.error= true }
    if (!userResponse.error) {
        if (res != null && res.hasOwnProperty("docs")) {
            if (res.docs.length = 1) {
                let resDoc: UserDoc = res.docs[0] as UserDoc;
                userResponse.username = String(resDoc.name);
                userResponse.email = String(resDoc.email);
                userResponse.fullname = String(resDoc.fullname);
                userResponse.fullDoc = res.docs[0] as UserDoc;
            } else {
                userResponse.error = true;
            }
        } else { userResponse.error = true}
    }
    return (userResponse);
}

export type CreateResponseType = {
    error: boolean,
    idCreated: string,
    refreshJWT: string | null,
    accessJWT: string | null
}

export async function createNewUser(userObj: UserObj, deviceUUID: string) {
    const createResponse: CreateResponseType = {
        error: false,
        idCreated: "",
        refreshJWT: null,
        accessJWT: null
    }
    log.debug("Creating new user :"+userObj.username+" with device ID:",deviceUUID);
    let refreshJWTs: any = {};
    if (deviceUUID !== "") {
        let newJWT = await generateJWT({username: userObj.username,deviceUUID: deviceUUID,includeRoles: false, timeString: refreshTokenExpires});
        log.debug("Generated new JWT:",newJWT);
        refreshJWTs[deviceUUID] = newJWT;
//        refreshJWTs = {deviceUUID: newJWT}
        createResponse.refreshJWT = newJWT;
    }
    const newDoc = {
        name: userObj.username,
        password: userObj.password,
        email: userObj.email,
        fullname: userObj.fullname,
        roles: [couchStandardRole],
        refreshJWTs: refreshJWTs,
        type: "user"
    }
    if (deviceUUID !== "") {
        createResponse.accessJWT = await generateJWT({username: userObj.username,deviceUUID: deviceUUID, includeRoles: true, timeString: accessTokenExpires});
    }    
    let res = null;
    try { res = await usersDBAsAdmin.insert(newDoc as MaybeDocument,couchUserPrefix+":"+userObj.username); }
    catch(err) { log.error("Problem creating user: ",err); createResponse.error= true }
    if (!createResponse.error && res != null) {
        createResponse.idCreated = res.id;
    }
    return (createResponse);
}

export async function updateUserDoc(userDoc: UserDoc): Promise<boolean> {
    let res: nano.DocumentInsertResponse | null = null;
    try {
        res = await usersDBAsAdmin.insert(userDoc,String(userDoc._id));
        if (res === null || !res.ok) {
            return false;
        }
        return true;
    } catch(error) {
        console.error("Error updating user doc:",error);
        return false;
    }
}

export async function updateUnregisteredFriends(req: CustomRequest<NewUserReqBody>,email: string) {
    const emailq = {
        selector: { type: { "$eq": "friend" }, inviteEmail: { "$eq": email}},
        limit: await totalDocCount(groceriesDBAsAdmin)
    }
    let foundFriendDocs;
    try {foundFriendDocs =  await groceriesDBAsAdmin.find(emailq);}
    catch(err) {log.error("Could not find friend documents:",err); return false;}
    let foundFriendDoc = undefined;
//    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    (foundFriendDocs.docs as FriendDocs).forEach(async (doc) => {
        if (doc.friendStatus == "WAITREGISTER") {
            doc.friendID2 = req.body.username;
            doc.friendStatus = "PENDFROM1";
            doc.updatedAt = (new Date()).toISOString();
            let update2success=true;
            try { await groceriesDBAsAdmin.insert(doc);} 
            catch(e) {update2success = false;}
        }
    });
}

export async function getFriendDocByUUID(uuid: string): Promise<FriendDoc|null> {
    const uuidq = {
        selector: { type: { "$eq": "friend" }, inviteUUID: { "$eq": uuid}},
        limit: await totalDocCount(groceriesDBAsAdmin)
    }
    let foundFriendDocs: MangoResponse<FriendDoc>;
    try {foundFriendDocs =  (await groceriesDBAsAdmin.find(uuidq) as MangoResponse<FriendDoc>);}
    catch(err) {log.error("Could not find friend documents:", err); return null;};
    let foundFriendDoc: FriendDoc | null = null;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    return(foundFriendDoc);
}

export function isNothing(obj: any) {
    if (obj == "" || obj == null || obj == undefined) {return (true)}
    else {return (false)};
}

export async function getUsersFromListGroup(listGroupID:string): Promise<Set<string>> {
    let users: Set<string> =  new Set();
    let foundListGroupDoc: ListGroupDoc;
    try {foundListGroupDoc = (await groceriesDBAsAdmin.get(listGroupID) as ListGroupDoc)}
    catch(err) {log.error("Could not get list group ",listGroupID); return users};
    users.add(foundListGroupDoc.listGroupOwner);
    foundListGroupDoc.sharedWith.forEach( sharedUser => users.add(sharedUser))
    return users;
}


export async function getImpactedUsers(doc: any): Promise<Set<string>> {
    let impactedUsers = new Set<string>()
    // item,image,list,recipe,listgroup,settings,friend,globalitem,dbuuid,trigger,category,uom
    if (["globalitem","dbuuid","trigger"].includes(doc.type)) {
        return new Set('system');
    }
    if (doc.type === "settings") {
        impactedUsers.add(doc.username);
        return impactedUsers;
    }
    if (doc.type === "friend") {
        impactedUsers.add(doc.friendID1);
        impactedUsers.add(doc.friendID2);
        return impactedUsers;
    }
    if (["item","image","list","recipe"].includes(doc.type)) {
        impactedUsers = new Set(await getUsersFromListGroup(doc.listGroupID));
        return impactedUsers;
    }
    if (doc.type === "listgroup") {
        return new Set(await getUsersFromListGroup(doc._id));
    }
    if (["category","uom"].includes(doc.type)) {
        if (doc.listGroupID === "system") {return new Set('system');}
        return new Set(await getUsersFromListGroup(doc.listGroupID));
    }
    return impactedUsers;
}