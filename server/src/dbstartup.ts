import { todosNanoAsAdmin, usersNanoAsAdmin, couchDatabase, couchAdminPassword, couchAdminUser, couchdbUrl, couchdbInternalUrl, couchStandardRole,
couchAdminRole, conflictsViewID, conflictsViewName, utilitiesViewID, refreshTokenExpires, accessTokenExpires,
enableScheduling, resolveConflictsFrequencyMinutes,expireJWTFrequencyMinutes, disableAccountCreation, logLevel, couchKey } from "./apicalls";
import { resolveConflicts } from "./apicalls";
import { expireJWTs, generateJWT } from './jwt'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cloneDeep, isEqual, omit } from "lodash";
import { v4 as uuidv4} from 'uuid';
import { uomContent, categories, globalItems, totalDocCount } from "./utilities";
import { DocumentScope, MangoResponse, MangoQuery } from "nano";
import { CategoryDoc, GlobalItemDoc, ItemDoc, ListDoc, ListGroupDoc, UUIDDoc, UomDoc, UserDoc, appVersion, maxAppSupportedSchemaVersion } from "./DBSchema";
import log, { LogLevelDesc } from "loglevel";
import prefix from "loglevel-plugin-prefix";


let uomContentVersion = 0;
const targetUomContentVersion = 5;
let categoriesVersion = 0;
const targetCategoriesVersion = 2;
let globalItemVersion = 0;
const targetGlobalItemVersion = 2;
let schemaVersion = 0;
const targetSchemaVersion = 3;


export let todosDBAsAdmin: DocumentScope<unknown>;
export let usersDBAsAdmin: DocumentScope<unknown>;

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
    catch(err) {loginResponse.loginSuccessful = false;
                loginResponse.dbServerAvailable = false;
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

export async function doesDBExist() {
    let retrieveError = false;
    let res = null;
    try { res = await todosNanoAsAdmin.db.get(couchDatabase)}
    catch(err) { retrieveError = true }
    if (retrieveError || res == null) {
        log.error("could not retrieve database info.");
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
    log.info("Initiatialization, Database "+couchDatabase+" created.");
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
        url: couchdbInternalUrl+"/"+couchDatabase+"/_security",
        auth: {username: String(couchAdminUser), password: String(couchAdminPassword)},
        responseType: 'json'
    }
    let res: AxiosResponse | null = null;
    try { res = await axios(config)}
    catch(err) { log.error("Setting security:",err); errorSettingSecurity= true }
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
        log.info("Security roles set correctly");
        return (true);
    }
    let configSec: any = {
        method: 'put',
        url: couchdbInternalUrl+"/"+couchDatabase+"/_security",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json',
        data: newSecurity
    }
    errorSettingSecurity = false;
    try { res = await axios(configSec)}
    catch(err) { log.error("Setting security:", err); errorSettingSecurity = true }
    if (errorSettingSecurity) {
        log.error("Problem setting database security")
    } else {
        log.error("STATUS: Database security roles added");
    }
    return (!errorSettingSecurity);
}

async function getLatestDBUUIDDoc(): Promise<UUIDDoc | null> {
    const dbidq = {
        selector: { type: { "$eq": "dbuuid" }}
    }
    let foundIDDocs: MangoResponse<unknown> | null = null;
    try {foundIDDocs =  await todosDBAsAdmin.find(dbidq);}
    catch(err) {log.error("ERROR: could not read dbUUID record"); return null;}
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
    catch(err) {log.error("ERROR: could not update dbUUID record:",JSON.stringify(err)); return null;}
    return dbResp;
}

async function addDBIdentifier() {
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        const newDoc: UUIDDoc = {
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
        if (dbResp != null) {log.info("UUID created in DB: ", newDoc.uuid)}  
    } else {
        if (!foundIDDoc.hasOwnProperty("uuid")) {
            log.error("Database UUID doc exists without uuid. Please correct and restart.");
            return false;
        }
        if (!foundIDDoc.hasOwnProperty("uomContentVersion")) {
            foundIDDoc.uomContentVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with uomContentVersion");  } 
            else { log.info("Updated UOM Content Version, was missing.") }
        } else {
            uomContentVersion = foundIDDoc.uomContentVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};
        if (!foundIDDoc.hasOwnProperty("categoriesVersion")) {
            foundIDDoc.categoriesVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with categoriesVersion: ",dbResp);  } 
            else { log.info("Updated Categories Content Version, was missing.") }
        } else {
            categoriesVersion = foundIDDoc.categoriesVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};        
        if (!foundIDDoc.hasOwnProperty("globalItemVersion")) {
            foundIDDoc.globalItemVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with globalItemVersion");  } 
            else { log.info("Updated global Item Content Version, was missing."); }
        } else {
            globalItemVersion = foundIDDoc.globalItemVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};
        if (!foundIDDoc.hasOwnProperty("schemaVersion")) {
            foundIDDoc.schemaVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with schemaVersion") } 
            else { log.info("Updated Categories Content Version, was missing.");  }
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
        let uom: UomDoc = uomContent[i];
        const docIdx=foundUOMDocs.docs.findIndex((el) => (el.name.toUpperCase() === uom.name.toUpperCase() || el._id === uom._id));
        let needsAdded=true; let needsUpdated=false;
        if (docIdx !== -1) {
            let thisDoc: UomDoc = foundUOMDocs.docs[docIdx];
            if (thisDoc._id === uom._id) {
                log.info("UOM ",uom.name," already exists...checking equality...");
                needsAdded=false;
                let filteredDoc=omit(thisDoc,["updatedAt","_rev"])
                if (!isEqual(filteredDoc,uom)) {
                    needsUpdated=true;
                    thisDoc.name = uom.name;
                    thisDoc.description = uom.description;
                    thisDoc.pluralDescription = uom.pluralDescription;
                    if (uom.hasOwnProperty("alternates")) {
                        thisDoc.alternates = cloneDeep(uom.alternates)
                    }
                    log.info("UOM ",uom.name," exists but needs updating...");
                    let dbResp = null;
                    try { dbResp = await todosDBAsAdmin.insert(thisDoc)}
                    catch(err) {log.error("updating existing UOM", "err")}
                }
            } else {
                let dbResp = null;
                try { dbResp = await todosDBAsAdmin.destroy(thisDoc._id!,thisDoc._rev!)}
                catch(err) {log.error("Deleting / replacing existing UOM: ", err);}
            }
        }
        if (needsAdded) {
            log.info("Adding uom ",uom.name, " ", uom.description);
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(uom);}
            catch(err) { log.error("Adding uom ",uom.name, " error: ",err);}
        } else if (needsUpdated) {
            log.info("UOM ",uom.name," already exists...updated with new content");
        }
    };
    log.info("Finished adding units of measure, updating to UOM Content Version:",targetUomContentVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        log.error("Couldn't update database content version record.");
    } else {
        foundIDDoc.uomContentVersion = targetUomContentVersion;
        let dbResp = await updateDBUUIDDoc(foundIDDoc);
        if (dbResp == null) { log.error("Couldn't update UOM target version.")}
        else { log.info("Updated UOM Target Version successfully."); }
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
                log.info("Category ",category.name," already exists...skipping");
                needsAdded=false;
            } else {
                let dbResp = null;
                try { dbResp = await todosDBAsAdmin.destroy(thisDoc._id,thisDoc._rev)}
                catch(err) { log.error("Deleting category for replacement:", err);}
            }
        }
        if (needsAdded) {
            log.info("Adding category ",category.name);
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(category);}
            catch(err) { log.error("Adding category ",category.name, " error: ",err);}
        } 
    };
    log.info("Finished adding categories, updating to category Version:",targetCategoriesVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        log.error("Couldn't update database content version record.");
    } else {
        foundIDDoc.categoriesVersion = targetCategoriesVersion;
        let dbResp = null;
        try { dbResp = await todosDBAsAdmin.insert(foundIDDoc)}
        catch(err) { log.error("Couldn't update Categories target version.")};
        log.info("Updated Categories Target Version successfully.");
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
            log.info("Adding global item ",globalItem.name);
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(globalItem);}
            catch(err) { log.error("Adding global item ",globalItem.name, " error: ",err);}
        } else {
            log.info("Global Item ",globalItem.name," already exists...comparing values...");
            let needsChanged=false;
            let compareDoc=foundGlobalItemDocs.docs[docIdx];
            if (globalItem.name !== compareDoc.name) {
                compareDoc.name = globalItem.name;
                needsChanged = true;
            }
            if (globalItem.defaultUOM !== compareDoc.defaultUOM) {
                compareDoc.defaultUOM = globalItem.defaultUOM;
                needsChanged = true;
            }
            if (globalItem.defaultCategoryID !== compareDoc.defaultCategoryID) {
                compareDoc.defaultCategoryID = globalItem.defaultCategoryID;
                needsChanged = true;
            }
            if (needsChanged) {
                log.info("Item "+globalItem.name+ " had changed values. Reverting to original...");
                let dbResp = null;
                try {dbResp = await todosDBAsAdmin.insert(compareDoc)}
                catch(err) {log.error("Error reverting values on doc "+globalItem.name,"error:",err)}
            }
        }
    };
    log.info("Finished adding global Items, updating to Global Item Version:",targetGlobalItemVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        log.error("Couldn't update database content version record.");
    } else {
        foundIDDoc.globalItemVersion = targetGlobalItemVersion;
        let dbResp = await updateDBUUIDDoc(foundIDDoc);
        if (dbResp == null) { log.error("Couldn't update Global Item target version.") }
        else {log.info("Updated Global Item Target Version successfully.");}
    }
}

async function checkAndCreateContent() {
    log.info("Current UOM Content Version:",uomContentVersion," Target Version:",targetUomContentVersion);
    if (uomContentVersion === targetUomContentVersion) {
        log.info("At current version, skipping UOM Content creation");
    } else {
        log.info("Creating UOM Content...");
        await createUOMContent();
    }
    log.info("Current Category Content Version:",categoriesVersion," Target Version:", targetCategoriesVersion);
    if (categoriesVersion === targetCategoriesVersion) {
        log.info("At current category version, skipping category creation");
    } else {
        log.info("Creating category Content...");
        await createCategoriesContent();
    }
    log.info("Current Global Item Content Version:",globalItemVersion," Target Version:", targetGlobalItemVersion);
    if (globalItemVersion === targetGlobalItemVersion) {
        log.info("At current Global item version, skipping global item creation");
    } else {
        log.info("Creating Global Item Content...");
        await createGlobalItemContent();
    }
}

async function addStockedAtIndicatorToSchema() {
    let updateSuccess = true;
    log.info("Upgrading schema to support stocked at indicators.");
    const itemq = { selector: { type: { "$eq": "item"}},
                    limit: await totalDocCount(todosDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await todosDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}                
    catch(err) {log.error("Could not find item docs to update during schema update"); return false;}
    log.info("Found items to update :", foundItemDocs.docs.length)
    for (let i = 0; i < foundItemDocs.docs.length; i++) {
        const foundItemDoc = foundItemDocs.docs[i];
        log.debug("Processing item: ", foundItemDoc.name);
        let docChanged = false;
        if (foundItemDoc.hasOwnProperty("lists")) {
            for (let j = 0; j < foundItemDoc.lists.length; j++) {
                log.debug("list: ",JSON.stringify(foundItemDoc.lists[j]));
                if (!foundItemDoc.lists[j].hasOwnProperty("stockedAt")) {
                    log.debug("Didn't have stockedAt property, adding...");
                    foundItemDoc.lists[j].stockedAt = true;
                    docChanged = true;
                }
            }
        }
        if (docChanged) {
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(foundItemDoc)}
            catch(err) { log.error("Couldn't update item with stocked indicator.");
                         updateSuccess = false;}
        }
    }
    return updateSuccess;
}

async function restructureListGroupSchema() {
    let updateSuccess = true;
    log.info("Upgrading schema to support listGroups. Most data will be lost in this upgrade.");
    // Delete both lists and items because of structure changes and because categories in list are most likely
    // completely replaced with new Category content/system IDs at same time
    const delq: MangoQuery = { selector: { type : { "$in": ["list","item","category"]}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundDelDocs: MangoResponse<ListDoc | ItemDoc>;
    try { foundDelDocs = (await todosDBAsAdmin.find(delq) as MangoResponse<ListDoc | ItemDoc>)}
    catch(err) { log.error("Could not find items/lists/categories to delete:",err); return false;}
    log.debug("Found items/lists/categories to delete:",foundDelDocs.docs.length);
    for (let i = 0; i < foundDelDocs.docs.length; i++) {
        let dbResp=null;
        try { dbResp=await todosDBAsAdmin.destroy(foundDelDocs.docs[i]._id,foundDelDocs.docs[i]._rev)}
        catch(err) {log.error("ERROR deleting list/item:",err);}        
    }
    log.info("Finished deleting lists, items, and categories.");
    log.info("Creating default listgroups for all users");
    const userq: MangoQuery = { selector: { type: "user", name: {$exists: true}}, limit: await totalDocCount(usersDBAsAdmin)};
    let foundUserDocs: MangoResponse<UserDoc>;
    try {foundUserDocs = (await usersDBAsAdmin.find(userq) as MangoResponse<UserDoc>);}
    catch(err) {log.error("Could not find user list during schema update:",err); return false;}
    log.info("Found users to create listgroups: ", foundUserDocs.docs.length);
    for (let i = 0; i < foundUserDocs.docs.length; i++) {
        const foundUserDoc = foundUserDocs.docs[i];
        const listgroupq = { selector: { type: "listgroup", listGroupOwner: foundUserDoc.name, default: true},
                             limit: await totalDocCount(todosDBAsAdmin)};
        let foundListGroupDocs = await todosDBAsAdmin.find(listgroupq);
        if (foundListGroupDocs.docs.length == 0) {
            log.info("No default listgroup found for :",foundUserDoc.name," ... creating...");
            let newCurDateStr = (new Date()).toISOString()
            const newListGroupDoc: ListGroupDoc = {
                type: "listgroup", name: (foundUserDoc.name + " (default)"),
                default: true, listGroupOwner: foundUserDoc.name, sharedWith: [], updatedAt: newCurDateStr
            }
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(newListGroupDoc)}
            catch(err) { log.error("Couldn't create new list group:",newListGroupDoc.name, "err:",JSON.stringify(err))
                         updateSuccess = false;}
        } else {
            log.info("Default List Group already exists for : ", foundUserDoc.name);
        }
    }
    return updateSuccess;
}    

async function setSchemaVersion(updSchemaVersion: number) {
    log.info("Finished schema updates, updating database to :",updSchemaVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        log.error("Couldn't update database schema version record.");
    } else {
        foundIDDoc.schemaVersion = updSchemaVersion;
        let dbResp = updateDBUUIDDoc(foundIDDoc);
        if (dbResp == null) {log.error("Couldn't update schema target version.")}
        else {log.info("Updated schema target version successfully.")}
    }
}

async function checkAndUpdateSchema() {
    log.info("Current Schema Version:",schemaVersion," Target Version:",targetSchemaVersion);
    if (schemaVersion === targetSchemaVersion) {
        log.info("At current schema version, skipping schema update");
        return true;
    }
    if (schemaVersion < 2) {
        log.info("Updating schema to rev. 2: Changes for 'stocked at' indicator on item/list.");
        let schemaUpgradeSuccess = await addStockedAtIndicatorToSchema();
        if (schemaUpgradeSuccess) { schemaVersion = 2; await setSchemaVersion(schemaVersion);}
    }
    if (schemaVersion < 3) {
        log.info("Updating schema to rev. 3: Changes for restructuring/listgroups ");
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
        catch(err) {log.error("View not created:",{err}); viewCreated=false;}
        log.info("View created/ updated");
    }
}

async function createUtilitiesViews() {
    let viewFound=true; let existingView;
    try {existingView = await todosDBAsAdmin.get("_design/"+utilitiesViewID)}
    catch(err) {viewFound = false;}
    if (!viewFound) {
        let viewCreated=true;
        let viewDoc = {
            "views": {
                "ucase-items" : 
                    { "map": "function(doc) { if (doc.type=='item') { emit (doc.name.toUpperCase(), doc._id)}}"},
                "ucase-globalitems" : 
                   { "map": "function(doc) { if (doc.type=='globalitem') { emit (doc.name.toUpperCase(), doc._id)}}"},
                "ucase-categories" : 
                   { "map": "function(doc) { if (doc.type=='category') { emit (doc.name.toUpperCase(), doc._id)}}"}
                }
            }
        try {
            await todosDBAsAdmin.insert(viewDoc as any,"_design/"+utilitiesViewID)
        }
        catch(err) {log.error("Utilities View not created:",{err}); viewCreated=false;}
        log.info("Utilities View created/ updated");
    }
}

async function checkAndCreateViews() {
    await createConflictsView();
    await createUtilitiesViews();
}

async function checkJWTKeys() {
    let keysOK = false;
    let testAccessJWT = await generateJWT({username:"test",deviceUUID: "test",includeRoles: true, timeString:"5m"});
    log.debug("Test JWT is : ",testAccessJWT);
    const config: AxiosRequestConfig = {
        method: 'get',
        url: couchdbInternalUrl+"/_session",
        headers: {
            "Authorization": "Bearer "+testAccessJWT
        },
        responseType: 'json'
    }
    let res: AxiosResponse| null;
    try  {res = await axios(config)}
    catch(err) {return false;}
    if (res?.status === 200 && res?.data.hasOwnProperty("ok")) {
        if (res.data.ok) {keysOK = true;}
    }
    return keysOK;
}

function encodedHMAC() {
    let base64HMAC = Buffer.from(String(couchKey)).toString("base64");
    return base64HMAC;
}

function isInteger(str: string) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

function convertLogLevel(level: string) : LogLevelDesc {
    let uLevel=level.toUpperCase();
    if (["0","TRACE","T"].includes(level)) {
        return "TRACE" 
    } else if (["1","DEBUG","D"].includes(level)) {
        return "DEBUG"
    } else if (["2","INFO","INFORMATION","I"].includes(level)) {
        return "INFO"
    } else if (["3","WARN","WARNING","W"].includes(level)) {
        return "WARN"
    } else if (["4","ERROR","E"].includes(level)) {
        return "ERROR"
    } else if (["5","SILENT","S","NONE","N"].includes(level)) {
        return "SILENT"
    }
    return "INFO"    
}

export async function dbStartup() {
    prefix.reg(log);
    prefix.apply(log);
    log.setLevel(convertLogLevel(logLevel));
    log.info("Starting up auth server for couchdb...");
    log.info("App Version: ",appVersion);
    log.info("Database Schema Version:",maxAppSupportedSchemaVersion);
    if (couchdbUrl == "") {log.error("No environment variable for CouchDB URL"); return false;}
    if (couchdbInternalUrl == "") {log.error("No environment variable for internal CouchDB URL"); return false;}
    log.info("Database URL: ",couchdbUrl);
    log.info("Internal Database URL: ",couchdbInternalUrl);
    if (couchDatabase == "") { log.error("No CouchDatabase environment variable."); return false;}
    log.info("Using database:",couchDatabase);
    log.info("Refresh token expires in ",refreshTokenExpires);
    log.info("STATUS: Access token expires in ",accessTokenExpires);
    log.info("STATUS: User Account Creation is: ",disableAccountCreation ? "DISABLED" : "ENABLED");
    await createDBIfNotExists();
    await setDBSecurity();
    try {todosDBAsAdmin = todosNanoAsAdmin.use(couchDatabase);}
    catch(err) {log.error("Could not open todo database:",err); return false;}
    try {usersDBAsAdmin = usersNanoAsAdmin.use("_users");}
    catch(err) {log.error("Could not open users database:", err); return false;}
    let keysOK = await checkJWTKeys();
    log.debug("JWT Encoded HMAC:",encodedHMAC());
    if (!keysOK) {
        log.error("Cannot access database with encoded JWT key. Please check HMAC entry in jwt.ini. The hmac:_default value should be: ",encodedHMAC());
        return false;
    } else {
        log.info("JWT Key verified to access database")
    }
    await addDBIdentifier();
    await checkAndUpdateSchema();
    await checkAndCreateContent();
    await checkAndCreateViews();
    if (enableScheduling) {
        if(isInteger(String(resolveConflictsFrequencyMinutes))) {
            setInterval(() => {resolveConflicts()},60000*Number(resolveConflictsFrequencyMinutes));
            log.info("Conflict resolution scheduled every ",resolveConflictsFrequencyMinutes, " minutes.")
            resolveConflicts();
        } else {
            log.error("Invalid environment variable for scheduling conflict resolution -- not started.");
        }
        if (isInteger(String(expireJWTFrequencyMinutes))) {
            setInterval(() => {expireJWTs()},60000*Number(expireJWTFrequencyMinutes));
            log.info("JWT expiry scheduled every ",expireJWTFrequencyMinutes," minutes.");
            expireJWTs();
        } else {
            log.error("Invalid environment variable for scheduling JWT expiry -- not started")
        }
    }
}

