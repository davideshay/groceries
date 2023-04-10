import { couchUserPrefix, couchStandardRole, accessTokenExpires, refreshTokenExpires } from "./apicalls";
import { usersDBAsAdmin, todosDBAsAdmin } from './dbstartup';
import { generateJWT } from "./jwt";
import { UserDoc, FriendDoc, FriendDocs} from './DBSchema'
import { DocumentScope, MangoQuery, MangoResponse, MaybeDocument } from "nano";
import { cloneDeep } from "lodash";
import { NewUserReqBody, UserObj, CustomRequest } from "./datatypes";

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
    const info = await db.info();
    return info.doc_count;
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
    catch(err) { console.log("ERROR GETTING USER:",username); userResponse.error= true }
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
    catch(err) { console.log("ERROR getting user by email:",err); userResponse.error= true }
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
    let refreshJWTs = {};
    if (deviceUUID !== "") {
        let newJWT = await generateJWT({username: userObj.username,deviceUUID: deviceUUID,includeRoles: false, timeString: refreshTokenExpires});
        refreshJWTs = { deviceUUID: newJWT}
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
    catch(err) { console.log("ERROR: problem creating user: ",err); createResponse.error= true }
    if (!createResponse.error && res != null) {
        createResponse.idCreated = res.id;
    }
    return (createResponse);
}

export async function updateUnregisteredFriends(req: CustomRequest<NewUserReqBody>,email: string) {
    const emailq = {
        selector: { type: { "$eq": "friend" }, inviteEmail: { "$eq": email}},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundFriendDocs;
    try {foundFriendDocs =  await todosDBAsAdmin.find(emailq);}
    catch(err) {console.log("ERROR: Could not find friend documents:",err); return false;}
    let foundFriendDoc = undefined;
//    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    (foundFriendDocs.docs as FriendDocs).forEach(async (doc) => {
        if (doc.friendStatus == "WAITREGISTER") {
            doc.friendID2 = req.body.username;
            doc.friendStatus = "PENDFROM1";
            doc.updatedAt = (new Date()).toISOString();
            let update2success=true;
            try { await todosDBAsAdmin.insert(doc);} 
            catch(e) {update2success = false;}
        }
    });
}

export async function getFriendDocByUUID(uuid: string): Promise<FriendDoc|null> {
    const uuidq = {
        selector: { type: { "$eq": "friend" }, inviteUUID: { "$eq": uuid}},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundFriendDocs: MangoResponse<FriendDoc>;
    try {foundFriendDocs =  (await todosDBAsAdmin.find(uuidq) as MangoResponse<FriendDoc>);}
    catch(err) {console.log("ERROR: Could not find friend documents:", err); return null;};
    let foundFriendDoc: FriendDoc | null = null;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    return(foundFriendDoc);
}

export function isNothing(obj: any) {
    if (obj == "" || obj == null || obj == undefined) {return (true)}
    else {return (false)};
}
