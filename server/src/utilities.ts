import { couchUserPrefix, couchStandardRole, accessTokenExpires, refreshTokenExpires } from "./apicalls";
import { usersDBAsAdmin, todosDBAsAdmin } from './dbstartup';
import { generateJWT } from "./jwt";

export const uomContent = [
    {_id: "system:uom:EA", type: "uom", name: "EA", description: "Each", pluralDescription: "Eaches"},
    {_id: "system:uom:X2", type: "uom", name: "X2", description: "Bunch", pluralDescription: "Bunches"},
    {_id: "system:uom:OZ", type: "uom", name: "OZ", description: "Ounce", pluralDescription: "Ounces"},
    {_id: "system:uom:FO", type: "uom", name: "FO", description: "Fluid Ounce", pluralDescription: "Fluid Ounces"},
    {_id: "system:uom:LB", type: "uom", name: "LB", description: "Pound", pluralDescription: "Pounds"},
    {_id: "system:uom:GA", type: "uom", name: "GA", description: "Gallon", pluralDescription: "Gallons"},
    {_id: "system:uom:GH", type: "uom", name: "GH", description: "Half Gallon", pluralDescription: "Half Gallons"},
    {_id: "system:uom:QT", type: "uom", name: "QT", description: "Quart", pluralDescription: "Quarts"},
    {_id: "system:uom:LT", type: "uom", name: "LT", description: "Liter", pluralDescription: "Liters"},
    {_id: "system:uom:ML", type: "uom", name: "ML", description: "Milliliter", pluralDescription: "Milliliters"},
    {_id: "system:uom:KG", type: "uom", name: "KG", description: "Kilogram", pluralDescription: "Kilograms"},
    {_id: "system:uom:GR", type: "uom", name: "GR", description: "Gram", pluralDescription: "Grams"},
    {_id: "system:uom:BX", type: "uom", name: "BX", description: "Box", pluralDescription: "Boxes"},
    {_id: "system:uom:BG", type: "uom", name: "BG", description: "Bag", pluralDescription: "Bags"},
    {_id: "system:uom:BO", type: "uom", name: "BO", description: "Bottle", pluralDescription: "Bottles"},
    {_id: "system:uom:CA", type: "uom", name: "CA", description: "Case", pluralDescription: "Cases"},
    {_id: "system:uom:CN", type: "uom", name: "CN", description: "Can", pluralDescription: "Cans"},
    {_id: "system:uom:CU", type: "uom", name: "CU", description: "Cup", pluralDescription: "Cups"},
    {_id: "system:uom:CT", type: "uom", name: "CT", description: "Carton", pluralDescription: "Cartons"},
    {_id: "system:uom:CH", type: "uom", name: "CH", description: "Container", pluralDescription: "Containers"},
    {_id: "system:uom:DZ", type: "uom", name: "DZ", description: "Dozen", pluralDescription: "Dozen"},
    {_id: "system:uom:JR", type: "uom", name: "JR", description: "Jar", pluralDescription: "Jars"},
    {_id: "system:uom:X8", type: "uom", name: "X8", description: "Loaf", pluralDescription: "Loaves"},
    {_id: "system:uom:Y1", type: "uom", name: "Y1", description: "Slice", pluralDescription: "Slices"},
    {_id: "system:uom:15", type: "uom", name: "15", description: "Stick", pluralDescription: "Sticks"},
    {_id: "system:uom:PC", type: "uom", name: "PC", description: "Piece", pluralDescription: "Pieces"},
    {_id: "system:uom:PK", type: "uom", name: "PK", description: "Package", pluralDescription: "Packages"},
    {_id: "system:uom:PT", type: "uom", name: "PT", description: "Pint", pluralDescription: "Pints"},
    {_id: "system:uom:RL", type: "uom", name: "RL", description: "Roll", pluralDescription: "Rolls"},
]

export const globalItems = require("../data/globalItems.json");

export const categories = require("../data/categories.json");

export function emailPatternValidation(email) {
    const emailRegex=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return emailRegex.test(email);
};

export function usernamePatternValidation(username) {
    const usernameRegex=/^[a-zA-Z0-9]*$/
    return usernameRegex.test(username);
}

export function fullnamePatternValidation(fullname) {
    const usernameRegex=/^[a-zA-Z0-9 ]*$/
    return usernameRegex.test(fullname);
}

export async function totalDocCount(db) {
    const info = await db.info();
    return info.doc_count;
}

export async function getUserDoc(username) {
    const userResponse = {
        error: false,
        fullname: "",
        email: "",
        fullDoc: {}
    }
    let res = null;
    try { res = await usersDBAsAdmin.get(couchUserPrefix+":"+username)}
    catch(err) { console.log("ERROR GETTING USER:",err); userResponse.error= true }
    if (!userResponse.error) {
        userResponse.email = res.email;
        userResponse.fullname = res.fullname;
        userResponse.fullDoc = res;
    }
    return (userResponse);
}

export async function getUserByEmailDoc(email) {
    const userResponse = {
        error: false,
        username: null,
        fullname: null,
        email: email,
    }
    const query={selector: {"email": {"$eq": email}}, limit: totalDocCount(usersDBAsAdmin)};
    let res = null;
    try { res = await usersDBAsAdmin.find(query);}
    catch(err) { console.log("ERROR getting user by email:",err); userResponse.error= true }
    if (!userResponse.error) {
        if (res.docs.length > 0) {
            userResponse.username = res.docs[0].name;
            userResponse.email = res.docs[0].email;
            userResponse.fullname = res.docs[0].fullname;
        } else {
            userResponse.error = true;
        }
    }
    return (userResponse);
}

export async function createNewUser(userObj, deviceUUID) {
    const createResponse = {
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
    try { res = await usersDBAsAdmin.insert(newDoc,couchUserPrefix+":"+userObj.username); }
    catch(err) { console.log("ERROR: problem creating user: ",err); createResponse.error= true }
    if (!createResponse.error) {
        createResponse.idCreated = res.id;
    }
    return (createResponse);
}

export async function updateUnregisteredFriends(req,email) {
    const emailq = {
        selector: { type: { "$eq": "friend" }, inviteEmail: { "$eq": email}},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundFriendDocs;
    try {foundFriendDocs =  await todosDBAsAdmin.find(emailq);}
    catch(err) {console.log("ERROR: Could not find friend documents:",err); return false;}
    let foundFriendDoc = undefined;
//    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    foundFriendDocs.docs.forEach(async (doc) => {
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

export async function getFriendDocByUUID(uuid) {
    const uuidq = {
        selector: { type: { "$eq": "friend" }, inviteUUID: { "$eq": uuid}},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundFriendDocs;
    try {foundFriendDocs =  await todosDBAsAdmin.find(uuidq);}
    catch(err) {console.log("ERROR: Could not find friend documents:", err); return null;};
    let foundFriendDoc;
    if (foundFriendDocs.docs.length > 0) {foundFriendDoc = foundFriendDocs.docs[0]}
    return(foundFriendDoc);
}

export function isNothing(obj) {
    if (obj == "" || obj == null || obj == undefined) {return (true)}
    else {return (false)};
}
