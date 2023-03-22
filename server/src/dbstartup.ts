import { todosNanoAsAdmin, usersNanoAsAdmin, couchDatabase, couchAdminPassword, couchAdminUser, couchdbUrl, couchStandardRole,
couchAdminRole, conflictsViewID, refreshTokenExpires, accessTokenExpires,
enableScheduling, resolveConflictsFrequencyMinutes,expireJWTFrequencyMinutes } from "./apicalls";
import { resolveConflicts } from "./apicalls";
import { expireJWTs } from './jwt'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cloneDeep } from "lodash";
import { v4 as uuidv4} from 'uuid';
import { uomContent, categories, globalItems, totalDocCount } from "./utilities";
import { ServerScope, DocumentScope, MangoResponse, MangoQuery, MaybeDocument, ViewDocument } from "nano";
import { CategoryDoc, GlobalItemDoc, ItemDoc, ListDoc, ListGroupDoc, UUIDDoc, UomDoc, UserDoc } from "./DBSchema";


let uomContentVersion = 0;
const targetUomContentVersion = 3;
let categoriesVersion = 0;
const targetCategoriesVersion = 1;
let globalItemVersion = 0;
const targetGlobalItemVersion = 1;
let schemaVersion = 0;
const targetSchemaVersion = 3;


export let todosDBAsAdmin: DocumentScope<unknown>;
export let usersDBAsAdmin: DocumentScope<unknown>;

export async function couchLogin(username: string, password: string) {
    const loginResponse = {
        loginSuccessful: true,
        loginRoles: []
    }
    const config: AxiosRequestConfig = {
        method: 'get',
        url: couchdbUrl+"/_session",
        auth: { username: username, password: password},
        responseType: 'json'
    }
    let res: AxiosResponse| null;
    try  {res = await axios(config)}
    catch(err) {loginResponse.loginSuccessful = false; return loginResponse};
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

export async function doesDBExist() {
    let retrieveError = false;
    let res = null;
    try { res = await todosNanoAsAdmin.db.get(couchDatabase)}
    catch(err) { retrieveError = true }
    if (retrieveError || res == null) {
        console.log("ERROR: could not retrieve database info.");
        return (false);
    } else {
        return (true)
    }
}

async function createDB() {
    let createError = false;
    try { await todosNanoAsAdmin.db.create(couchDatabase)}
    catch(err) {  createError = true }
    if (createError) return (false);
    console.log("STATUS: Initiatialization, Database "+couchDatabase+" created.");
    return (createError);
}

async function createDBIfNotExists() {
    let dbCreated=false
    if (!(await doesDBExist())) {
        dbCreated=await createDB()
    }
    return (dbCreated)
}

function getNested(obj: any, ...args: any) {
    return args.reduce((obj: any, level: any) => obj && obj[level], obj)
  }

async function setDBSecurity() {
    let errorSettingSecurity = false;
    let config: AxiosRequestConfig = {
        method: 'get',
        url: couchdbUrl+"/"+couchDatabase+"/_security",
        auth: {username: String(couchAdminUser), password: String(couchAdminPassword)},
        responseType: 'json'
    }
    let res: AxiosResponse | null = null;
    try { res = await axios(config)}
    catch(err) { console.log("ERROR setting security:",err); errorSettingSecurity= true }
    if (errorSettingSecurity || res == null) return (false);
    let newSecurity = cloneDeep(res.data);
    let securityNeedsUpdated = false;
    if ((getNested(res.data.members.roles.length) == 0) || (getNested(res.data.members.roles.length) == undefined)) {
        newSecurity.members.roles = [couchStandardRole];
        securityNeedsUpdated = true;
    } else {
        if (!res.data.members.roles.includes(couchStandardRole)) {
            newSecurity.members.roles.push(couchStandardRole);
            securityNeedsUpdated = true;
        }
    }
    if ((getNested(res.data.admins.roles.length) == 0) || (getNested(res.data.admins.roles.length) == undefined)) {
        newSecurity.admins.roles = [couchAdminRole];
        securityNeedsUpdated = true;
    } else {
        if (!res.data.admins.roles.includes(couchAdminRole)) {
            newSecurity.admins.roles.push(couchAdminRole);
            securityNeedsUpdated = true;
        }
    }
    if (!securityNeedsUpdated) {
        console.log("STATUS: Security roles set correctly");
        return (true);
    }
    let configSec: any = {
        method: 'put',
        url: couchdbUrl+"/"+couchDatabase+"/_security",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json',
        data: newSecurity
    }
    errorSettingSecurity = false;
    try { res = await axios(configSec)}
    catch(err) { console.log("ERROR setting security:", err); errorSettingSecurity = true }
    if (errorSettingSecurity) {
        console.log("ERROR: Problem setting database security")
    } else {
        console.log("STATUS: Database security roles added");
    }
    return (!errorSettingSecurity);
}

async function getLatestDBUUIDDoc(): Promise<UUIDDoc | null> {
    const dbidq = {
        selector: { type: { "$eq": "dbuuid" }}
    }
    let foundIDDocs: MangoResponse<unknown> | null = null;
    try {foundIDDocs =  await todosDBAsAdmin.find(dbidq);}
    catch(err) {console.log("ERROR: could not read dbUUID record"); return null;}
    let foundIDDoc: UUIDDoc | null = null;
    if (foundIDDocs && foundIDDocs.hasOwnProperty('docs')) {
        if (foundIDDocs.docs.length > 0) {foundIDDoc = (foundIDDocs.docs[0] as UUIDDoc)}
    }   
    return foundIDDoc;
}

async function updateDBUUIDDoc(dbuuidDoc: UUIDDoc) {
    dbuuidDoc.updatedAt = (new Date()).toISOString();
    let dbResp = null;
    try {dbResp = await todosDBAsAdmin.insert(dbuuidDoc);}
    catch(err) {console.log("ERROR: could not update dbUUID record:",JSON.stringify(err)); return null;}
    return dbResp;
}

async function addDBIdentifier() {
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        const newDoc: UUIDDoc = {
            _id: "",
            _rev: "",
            type: "dbuuid",
            name: "Database UUID",
            "uuid": uuidv4(),
            "uomContentVersion": 0,
            "categoriesVersion": 0,
            "globalItemVersion": 0,
            "schemaVersion": 0,
            updatedAt: (new Date()).toISOString()
        }
        let dbResp=await updateDBUUIDDoc(newDoc);
        if (dbResp != null) {console.log("STATUS: UUID created in DB: ", newDoc.uuid)}  
    } else {
        if (!foundIDDoc.hasOwnProperty("uuid")) {
            console.log("ERROR: Database UUID doc exists without uuid. Please correct and restart.");
            return false;
        }
        if (!foundIDDoc.hasOwnProperty("uomContentVersion")) {
            foundIDDoc.uomContentVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { console.log("ERROR: updating UUID record with uomContentVersion");  } 
            else { console.log("STATUS: Updated UOM Content Version, was missing.") }
        } else {
            uomContentVersion = foundIDDoc.uomContentVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};
        if (!foundIDDoc.hasOwnProperty("categoriesVersion")) {
            foundIDDoc.categoriesVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { console.log("ERROR: updating UUID record with categoriesVersion: ",dbResp);  } 
            else { console.log("STATUS: Updated Categories Content Version, was missing.") }
        } else {
            categoriesVersion = foundIDDoc.categoriesVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};        
        if (!foundIDDoc.hasOwnProperty("globalItemVersion")) {
            foundIDDoc.globalItemVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { console.log("ERROR: updating UUID record with globalItemVersion");  } 
            else { console.log("STATUS: Updated global Item Content Version, was missing."); }
        } else {
            globalItemVersion = foundIDDoc.globalItemVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};
        if (!foundIDDoc.hasOwnProperty("schemaVersion")) {
            foundIDDoc.schemaVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { console.log("ERROR: updating UUID record with schemaVersion") } 
            else { console.log("STATUS: Updated Categories Content Version, was missing.");  }
        } else {
            schemaVersion = foundIDDoc.schemaVersion;
        }
    }
}

async function createUOMContent() {
    const dbuomq = {
        selector: { type: { "$eq": "uom" }},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundUOMDocs: MangoResponse<UomDoc> =  (await todosDBAsAdmin.find(dbuomq) as MangoResponse<UomDoc>);
    for (let i = 0; i < uomContent.length; i++) {
        let uom: any = uomContent[i];
        const docIdx=foundUOMDocs.docs.findIndex((el) => (el.name.toUpperCase() === uom.name.toUpperCase() || el._id === uom._id));
        let needsAdded=true;
        if (docIdx !== -1) {
            let thisDoc = foundUOMDocs.docs[docIdx];
            if (thisDoc._id === uom._id) {
                console.log("STATUS: UOM ",uom.name," already exists...skipping...");
                needsAdded=false;
            } else {
                let dbResp = null;
                try { dbResp = await todosDBAsAdmin.destroy(thisDoc._id,thisDoc._rev)}
                catch(err) {console.log("ERROR deleting / replacing existing UOM: ", err);}
            }
        }
        if (needsAdded) {
            console.log("STATUS: Adding uom ",uom.name, " ", uom.description);
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(uom);}
            catch(err) { console.log("ERROR: adding uom ",uom.uom, " error: ",err);}
        } else {
            console.log("STATUS: UOM ",uom.name," already exists...skipping");
        }
    };
    console.log("STATUS: Finished adding units of measure, updating to UOM Content Version:",targetUomContentVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        console.log("ERROR: Couldn't update database content version record.");
    } else {
        foundIDDoc.uomContentVersion = targetUomContentVersion;
        let dbResp = await updateDBUUIDDoc(foundIDDoc);
        if (dbResp == null) { console.log("ERROR Couldn't update UOM target version.")}
        else { console.log("STATUS: Updated UOM Target Version successfully."); }
    }
}

async function createCategoriesContent() {
    const dbcatq = {
        selector: { type: { "$eq": "category" }},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundCategoryDocs: MangoResponse<CategoryDoc> =  (await todosDBAsAdmin.find(dbcatq) as MangoResponse<CategoryDoc>);
    for (let i = 0; i < categories.length; i++) {
        let category = categories[i];
        category.type = "category";
        category.color = "#ffffff";
        foundCategoryDocs.docs
        const docIdx=foundCategoryDocs.docs.findIndex((el) => (el.name.toUpperCase() === category.name.toUpperCase() || el._id === category._id));
        let needsAdded = true;
        if (docIdx !== -1) {
            let thisDoc = foundCategoryDocs.docs[docIdx]
            if (thisDoc._id === category._id) {
                console.log("STATUS: Category ",category.name," already exists...skipping");
                needsAdded=false;
            } else {
                let dbResp = null;
                try { dbResp = await todosDBAsAdmin.destroy(thisDoc._id,thisDoc._rev)}
                catch(err) { console.log("ERROR: deleting category for replacement:", err);}
            }
        }
        if (needsAdded) {
            console.log("STATUS: Adding category ",category.name);
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(category);}
            catch(err) { console.log("ERROR: adding category ",category.name, " error: ",err);}
        } 
    };
    console.log("STATUS: Finished adding categories, updating to category Version:",targetCategoriesVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        console.log("ERROR: Couldn't update database content version record.");
    } else {
        foundIDDoc.categoriesVersion = targetCategoriesVersion;
        let dbResp = null;
        try { dbResp = await todosDBAsAdmin.insert(foundIDDoc)}
        catch(err) { console.log("ERROR: Couldn't update Categories target version.")};
        console.log("STATUS: Updated Categories Target Version successfully.");
    }
}

async function createGlobalItemContent() {
    const dbglobalq = {
        selector: { type: { "$eq": "globalitem" }},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundGlobalItemDocs: MangoResponse<GlobalItemDoc> =  (await todosDBAsAdmin.find(dbglobalq) as MangoResponse<GlobalItemDoc>);
    for (let i = 0; i < globalItems.length; i++) {
        let globalItem = globalItems[i];
        globalItem.type = "globalitem";
        const docIdx=foundGlobalItemDocs.docs.findIndex((el) => el.name === globalItem.name );
        if (docIdx == -1) {
            console.log("STATUS: Adding global item ",globalItem.name);
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(globalItem);}
            catch(err) { console.log("ERROR: adding global item ",globalItem.name, " error: ",err);}
        } else {
            console.log("STATUS: Global Item ",globalItem.name," already exists...skipping");
        }
    };
    console.log("STATUS: Finished adding global Items, updating to Global Item Version:",targetGlobalItemVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        console.log("ERROR: Couldn't update database content version record.");
    } else {
        foundIDDoc.globalItemVersion = targetGlobalItemVersion;
        let dbResp = await updateDBUUIDDoc(foundIDDoc);
        if (dbResp == null) { console.log("ERROR: Couldn't update Global Item target version.") }
        else {console.log("STATUS: Updated Global Item Target Version successfully.");}
    }
}

async function checkAndCreateContent() {
    console.log("STATUS: Current UOM Content Version:",uomContentVersion," Target Version:",targetUomContentVersion);
    if (uomContentVersion === targetUomContentVersion) {
        console.log("STATUS: At current version, skipping UOM Content creation");
    } else {
        console.log("STATUS: Creating UOM Content...");
        await createUOMContent();
    }
    console.log("STATUS: Current Category Content Version:",categoriesVersion," Target Version:", targetCategoriesVersion);
    if (categoriesVersion === targetCategoriesVersion) {
        console.log("STATUS: At current category version, skipping category creation");
    } else {
        console.log("STATUS: Creating category Content...");
        await createCategoriesContent();
    }
    console.log("STATUS: Current Global Item Content Version:",globalItemVersion," Target Version:", targetGlobalItemVersion);
    if (globalItemVersion === targetGlobalItemVersion) {
        console.log("STATUS: At current Global item version, skipping global item creation");
    } else {
        console.log("STATUS: Creating Global Item Content...");
        await createGlobalItemContent();
    }
}

async function addStockedAtIndicatorToSchema() {
    let updateSuccess = true;
    console.log("STATUS: Upgrading schema to support stocked at indicators.");
    const itemq = { selector: { type: { "$eq": "item"}},
                    limit: await totalDocCount(todosDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await todosDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}                
    catch(err) {console.log("ERROR: Could not find item docs to update during schema update"); return false;}
    console.log("STATUS: Found items to update :", foundItemDocs.docs.length)
    for (let i = 0; i < foundItemDocs.docs.length; i++) {
        const foundItemDoc = foundItemDocs.docs[i];
        console.log("Processing item: ", foundItemDoc.name);
        let docChanged = false;
        if (foundItemDoc.hasOwnProperty("lists")) {
            for (let j = 0; j < foundItemDoc.lists.length; j++) {
                console.log("list: ",JSON.stringify(foundItemDoc.lists[j]));
                if (!foundItemDoc.lists[j].hasOwnProperty("stockedAt")) {
                    console.log("Didn't have stockedAt property, adding...");
                    foundItemDoc.lists[j].stockedAt = true;
                    docChanged = true;
                }
            }
        }
        if (docChanged) {
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(foundItemDoc)}
            catch(err) { console.log("ERROR: Couldn't update item with stocked indicator.");
                         updateSuccess = false;}
        }
    }
    return updateSuccess;
}

async function restructureListGroupSchema() {
    let updateSuccess = true;
    console.log("STATUS: Upgrading schema to support listGroups. Most data will be lost in this upgrade.");
    // Delete both lists and items because of structure changes and because categories in list are most likely
    // completely replaced with new Category content/system IDs at same time
    const delq: MangoQuery = { selector: { type : { "$in": ["list","item"]}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundDelDocs: MangoResponse<ListDoc | ItemDoc>;
    try { foundDelDocs = (await todosDBAsAdmin.find(delq) as MangoResponse<ListDoc | ItemDoc>)}
    catch(err) { console.log("ERROR: Could not find items/lists to delete:",err); return false;}
    console.log("Found items/lists to delete:",foundDelDocs.docs.length);
    for (let i = 0; i < foundDelDocs.docs.length; i++) {
        let dbResp=null;
        try { dbResp=await todosDBAsAdmin.destroy(foundDelDocs.docs[i]._id,foundDelDocs.docs[i]._rev)}
        catch(err) {console.log("ERROR deleting list/item:",err);}        
    }
    console.log("STATUS: Finished deleting lists and items.");
    console.log("STATUS: Creating default listgroups for all users");
    const userq: MangoQuery = { selector: { type: "user", name: {$exists: true}}, limit: await totalDocCount(usersDBAsAdmin)};
    let foundUserDocs: MangoResponse<UserDoc>;
    try {foundUserDocs = (await usersDBAsAdmin.find(userq) as MangoResponse<UserDoc>);}
    catch(err) {console.log("ERROR: Could not find user list during schema update:",err); return false;}
    console.log("STATUS: Found users to create listgroups: ", foundUserDocs.docs.length);
    for (let i = 0; i < foundUserDocs.docs.length; i++) {
        const foundUserDoc = foundUserDocs.docs[i];
        const listgroupq = { selector: { type: "listgroup", listGroupOwner: foundUserDoc.name, default: true},
                             limit: await totalDocCount(todosDBAsAdmin)};
        let foundListGroupDocs = await todosDBAsAdmin.find(listgroupq);
        if (foundListGroupDocs.docs.length == 0) {
            console.log("STATUS: No default listgroup found for :",foundUserDoc.name," ... creating...");
            let newCurDateStr = (new Date()).toISOString()
            const newListGroupDoc: ListGroupDoc = {
                _id: "", _rev: "",
                type: "listgroup", name: (foundUserDoc.name + " (default)"),
                default: true, listGroupOwner: foundUserDoc.name, sharedWith: [], updatedAt: newCurDateStr
            }
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(newListGroupDoc)}
            catch(err) { console.log("ERROR: Couldn't create new list group:",newListGroupDoc.name)
                         updateSuccess = false;}
        } else {
            console.log("STATUS: Default List Group already exists for : ", foundUserDoc.name);
        }
    }
    return updateSuccess;
}    

async function setSchemaVersion(updSchemaVersion: number) {
    console.log("STATUS: Finished schema updates, updating database to :",updSchemaVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        console.log("ERROR: Couldn't update database schema version record.");
    } else {
        foundIDDoc.schemaVersion = updSchemaVersion;
        let dbResp = updateDBUUIDDoc(foundIDDoc);
        if (dbResp == null) {console.log("ERROR: Couldn't update schema target version.")}
        else {console.log("STATUS: Updated schema target version successfully.")}
    }
}

async function checkAndUpdateSchema() {
    console.log("STATUS: Current Schema Version:",schemaVersion," Target Version:",targetSchemaVersion);
    if (schemaVersion === targetSchemaVersion) {
        console.log("STATUS: At current schema version, skipping schema update");
        return true;
    }
    if (schemaVersion < 2) {
        console.log("STATUS: Updating schema to rev. 2: Changes for 'stocked at' indicator on item/list.");
        let schemaUpgradeSuccess = await addStockedAtIndicatorToSchema();
        if (schemaUpgradeSuccess) { schemaVersion = 2; await setSchemaVersion(schemaVersion);}
    }
    if (schemaVersion < 3) {
        console.log("STATUS: Updating schema to rev. 3: Changes for restructuring/listgroups ");
        let schemaUpgradeSuccess = await restructureListGroupSchema();
        if (schemaUpgradeSuccess) { schemaVersion = 3; await setSchemaVersion(schemaVersion);}
    }
}

async function createConflictsView() {
    let viewFound=true; let existingView;
    try {existingView = await todosDBAsAdmin.get("_design/"+conflictsViewID)}
    catch(err) {viewFound = false;}
    if (!viewFound) {
        let viewCreated=true;
        let viewDoc = {
            "views": { "conflicts_view" : {
                "map": "function(doc) { if (doc._conflicts) { emit (doc._conflicts, null)}}"
        }}}

        try {
            await todosDBAsAdmin.insert(viewDoc as any,"_design/"+conflictsViewID)
        }
        catch(err) {console.log("ERROR: View not created:",{err}); viewCreated=false;}
        console.log("STATUS: View created/ updated");
    }
}
function isInteger(str: string) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

export async function dbStartup() {
    console.log("STATUS: Starting up auth server for couchdb...");
    if (couchdbUrl == "") {console.log("ERROR: No environment variable for CouchDB URL"); return false;}
    console.log("STATUS: Database URL: ",couchdbUrl);
    if (couchDatabase == "") { console.log("ERROR: No CouchDatabase environment variable."); return false;}
    console.log("STATUS: Using database: ",couchDatabase);
    console.log("STATUS: Refresh token expires in ",refreshTokenExpires);
    console.log("STATUS: Access token expires in ",accessTokenExpires);
    await createDBIfNotExists();
    await setDBSecurity();
    try {todosDBAsAdmin = todosNanoAsAdmin.use(couchDatabase);}
    catch(err) {console.log("ERROR: Could not open todo database:",err); return false;}
    try {usersDBAsAdmin = usersNanoAsAdmin.use("_users");}
    catch(err) {console.log("ERROR: Could not open users database:", err); return false;}
    await addDBIdentifier();
    await checkAndUpdateSchema();
    await checkAndCreateContent();
    await createConflictsView();
    if (enableScheduling) {
        if(isInteger(String(resolveConflictsFrequencyMinutes))) {
            setInterval(() => {resolveConflicts()},60000*Number(resolveConflictsFrequencyMinutes));
            console.log("STATUS: Conflict resolution scheduled every ",resolveConflictsFrequencyMinutes, " minutes.")
            resolveConflicts();
        } else {
            console.log("ERROR: Invalid environment variable for scheduling conflict resolution -- not started.");
        }
        if (isInteger(String(expireJWTFrequencyMinutes))) {
            setInterval(() => {expireJWTs()},60000*Number(expireJWTFrequencyMinutes));
            console.log("STATUS: JWT expiry scheduled every ",expireJWTFrequencyMinutes," minutes.");
            expireJWTs();
        } else {
            console.log("ERROR: Invalid environment variable for scheduling JWT expiry -- not started")
        }
    }
}

