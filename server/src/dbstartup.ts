import { groceriesNanoAsAdmin, usersNanoAsAdmin, couchDatabase, couchAdminPassword, couchAdminUser, couchdbUrl, couchdbInternalUrl, couchStandardRole,
couchAdminRole, conflictsViewID, conflictsViewName, utilitiesViewID, refreshTokenExpires, accessTokenExpires,
enableScheduling, resolveConflictsFrequencyMinutes,expireJWTFrequencyMinutes, disableAccountCreation, logLevel, couchKey } from "./apicalls";
import { resolveConflicts } from "./apicalls";
import { expireJWTs, generateJWT } from './jwt'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cloneDeep, isEmpty, isEqual, omit } from "lodash";
import { v4 as uuidv4} from 'uuid';
import { uomContent, categories, globalItems, totalDocCount } from "./utilities";
import { DocumentScope, MangoResponse, MangoQuery, DocumentGetResponse, MaybeDocument, DatabaseGetResponse, DocumentInsertResponse } from "nano";
import { CategoryDoc, CategoryDocs, GlobalItemDoc, ImageDoc, ImageDocInit, InitSettingsDoc, ItemDoc, ItemDocs, ListDoc, ListGroupDoc, ListGroupDocInit, ListGroupDocs, RecipeDoc, SettingsDoc, UUIDDoc, UomDoc, UserDoc, appVersion, maxAppSupportedSchemaVersion, minimumAccessRefreshSeconds } from "./schema/DBSchema";
import log, { LogLevelDesc } from "loglevel";
import prefix from "loglevel-plugin-prefix";
import { timeSpan } from "./timeutils";
import i18next from 'i18next';
import { en_translations } from './locales/en/translation';
import { de_translations } from './locales/de/translation';
import { es_translations } from './locales/es/translation';

let uomContentVersion = 0;
const targetUomContentVersion = 5;
let categoriesVersion = 0;
const targetCategoriesVersion = 2;
let globalItemVersion = 0;
const targetGlobalItemVersion = 2;
let schemaVersion = 0;
const targetSchemaVersion = 5;


export let groceriesDBAsAdmin: DocumentScope<unknown>;
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
    catch(err: any) { log.debug("auth error for _session:",err.response.status);
                loginResponse.loginSuccessful = false;
                let httpResponseExists = (err && err.response && err.response.status && isInteger(err.response.status));
                if (!httpResponseExists) {
                    loginResponse.dbServerAvailable = false
                } else {
                    let httpResponse = Number(err.response.status);
                    if (httpResponse >= 500 && httpResponse <= 599) {
                        loginResponse.dbServerAvailable = false
                    }
                }
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
    try { res = await groceriesNanoAsAdmin.db.get(couchDatabase)}
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
    try { await groceriesNanoAsAdmin.db.create(couchDatabase)}
    catch(err) {  createError = true }
    if (createError) return (false);
    log.info("Initiatialization, Database "+couchDatabase+" created.");
    return (createError);
}

async function createDBIfNotExists() {
    let dbCreated=false
    if (!(await doesDBExist())) {
        log.info("Database does not exist... Creating....");
        dbCreated=await createDB()
        if (!dbCreated) {log.error("Could not create new database");}
    } else {dbCreated = true;}
    log.info("Database existence checked/created.");
    return (dbCreated)
}

function getNested(obj: any, ...args: any) {
    return args.reduce((obj: any, level: any) => obj && obj[level], obj)
  }

async function setDBSecurity() {
    log.info("Checking Database security settings");
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
    if (errorSettingSecurity || res == null) {
        log.error("Retrieving database security current settings");
        return false;
    }
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
        return true;
    }
    log.info("Security database settings need to be created/updated...");
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
    try {foundIDDocs =  await groceriesDBAsAdmin.find(dbidq);}
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
    try {dbResp = await groceriesDBAsAdmin.insert(dbuuidDoc);}
    catch(err) {log.error("ERROR: could not update dbUUID record:",JSON.stringify(err)); return null;}
    return dbResp;
}

async function addDBIdentifier(): Promise<boolean> {
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
            "categoriesFixed": true,
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
            if (dbResp == null) { log.error("Updating UUID record with uomContentVersion"); return false; } 
            else { log.info("Updated UOM Content Version, was missing.") }
        } else {
            uomContentVersion = foundIDDoc.uomContentVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};
        if (!foundIDDoc.hasOwnProperty("categoriesVersion")) {
            foundIDDoc.categoriesVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with categoriesVersion: ",dbResp); return false;  } 
            else { log.info("Updated Categories Content Version, was missing.") }
        } else {
            categoriesVersion = foundIDDoc.categoriesVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};        
        if (!foundIDDoc.hasOwnProperty("globalItemVersion")) {
            foundIDDoc.globalItemVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with globalItemVersion"); return false; } 
            else { log.info("Updated global Item Content Version, was missing."); }
        } else {
            globalItemVersion = foundIDDoc.globalItemVersion;
        }
        foundIDDoc = await getLatestDBUUIDDoc();
        if (foundIDDoc == null) { return false};
        if (!foundIDDoc.hasOwnProperty("schemaVersion")) {
            foundIDDoc.schemaVersion = 0;
            let dbResp = await updateDBUUIDDoc(foundIDDoc);
            if (dbResp == null) { log.error("Updating UUID record with schemaVersion"); return false; } 
            else { log.info("Updated Categories Content Version, was missing.");  }
        } else {
            schemaVersion = foundIDDoc.schemaVersion;
        }
    }
    return true;
}

async function createUOMContent(): Promise<boolean> {
    let contentSuccess = true;
    const dbuomq = {
        selector: { type: { "$eq": "uom" }, listGroupID: "system"},
        limit: await totalDocCount(groceriesDBAsAdmin)
    }
    let foundUOMDocs: MangoResponse<UomDoc> =  (await groceriesDBAsAdmin.find(dbuomq) as MangoResponse<UomDoc>);
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
                    thisDoc.updatedAt = (new Date().toISOString());
                    thisDoc.listGroupID = "system";
                    if (uom.hasOwnProperty("alternates")) {
                        thisDoc.alternates = cloneDeep(uom.alternates)
                    }
                    log.info("UOM ",uom.name," exists but needs updating...");
                    let dbResp = null;
                    try { dbResp = await groceriesDBAsAdmin.insert(thisDoc)}
                    catch(err) {log.error("updating existing UOM", err); return false;}
                }
            } else {
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.destroy(thisDoc._id!,thisDoc._rev!)}
                catch(err) {log.error("Deleting / replacing existing UOM: ", err); return false;}
            }
        }
        if (needsAdded) {
            log.info("Adding uom ",uom.name, " ", uom.description);
            uom.listGroupID = "system";
            uom.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(uom);}
            catch(err) { log.error("Adding uom ",uom.name, " error: ",err); return false;}
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
        if (dbResp == null) { log.error("Couldn't update UOM target version."); return false;}
        else { log.info("Updated UOM Target Version successfully."); }
    }
    return contentSuccess;
}

async function createCategoriesContent(): Promise<boolean> {
    let contentSuccess=true;
    const dbcatq = {
        selector: { type: { "$eq": "category" }, listGroupID: "system"},
        limit: await totalDocCount(groceriesDBAsAdmin)
    }
    let foundCategoryDocs: MangoResponse<CategoryDoc> =  (await groceriesDBAsAdmin.find(dbcatq) as MangoResponse<CategoryDoc>);
    for (let i = 0; i < categories.length; i++) {
        let category: CategoryDoc = categories[i];
        category.type = "category";
        category.listGroupID = "system";
        const docIdx=foundCategoryDocs.docs.findIndex((el) => (el.name.toUpperCase() === category.name.toUpperCase() || el._id === category._id));
        let needsAdded = true;
        if (docIdx !== -1) {
            let thisDoc = foundCategoryDocs.docs[docIdx]
            if (thisDoc._id === category._id) {
                log.info("Category ",category.name," already exists...skipping");
                needsAdded=false;
            } else {
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.destroy(thisDoc._id,thisDoc._rev)}
                catch(err) { log.error("Deleting category for replacement:", err); return false;}
            }
        }
        if (needsAdded) {
            log.info("Adding category ",category.name);
            category.listGroupID = "system",
            category.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(category);}
            catch(err) { log.error("Adding category ",category.name, " error: ",err); return false;}
        } 
    };
    log.info("Finished adding categories, updating to category Version:",targetCategoriesVersion);
    let foundIDDoc = await getLatestDBUUIDDoc();
    if (foundIDDoc == undefined) {
        log.error("Couldn't update database content version record.");
    } else {
        foundIDDoc.categoriesVersion = targetCategoriesVersion;
        foundIDDoc.updatedAt = (new Date().toISOString());
        let dbResp = null;
        try { dbResp = await groceriesDBAsAdmin.insert(foundIDDoc)}
        catch(err) { log.error("Couldn't update Categories target version."); return false;};
        log.info("Updated Categories Target Version successfully.");
    }
    return contentSuccess;
}

async function createGlobalItemContent(): Promise<boolean> {
    let contentSuccess = true;
    const dbglobalq = {
        selector: { type: { "$eq": "globalitem" }},
        limit: await totalDocCount(groceriesDBAsAdmin)
    }
    let foundGlobalItemDocs: MangoResponse<GlobalItemDoc>;
    try { foundGlobalItemDocs = (await groceriesDBAsAdmin.find(dbglobalq) as MangoResponse<GlobalItemDoc>) }
    catch(err) {log.error("Finding current global item docs"); return false;}
    for (let i = 0; i < globalItems.length; i++) {
        let globalItem: GlobalItemDoc = globalItems[i];
        globalItem.type = "globalitem";
        const docIdx=foundGlobalItemDocs.docs.findIndex((el) => el.name === globalItem.name );
        if (docIdx == -1) {
            log.info("Adding global item ",globalItem.name);
            globalItem.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(globalItem);}
            catch(err) { log.error("Adding global item ",globalItem.name, " error: ",err); return false;}
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
                globalItem.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try {dbResp = await groceriesDBAsAdmin.insert(compareDoc)}
                catch(err) {log.error("Error reverting values on doc "+globalItem.name,"error:",err); return false;}
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
    return contentSuccess;
}

async function checkAndCreateContent(): Promise<boolean> {
    let contentSuccess=true;
    log.info("Current UOM Content Version:",uomContentVersion," Target Version:",targetUomContentVersion);
    if (uomContentVersion === targetUomContentVersion) {
        log.info("At current version, skipping UOM Content creation");
    } else {
        log.info("Creating UOM Content...");
        contentSuccess = await createUOMContent();
    }
    if (!contentSuccess) {return false;}
    log.info("Current Category Content Version:",categoriesVersion," Target Version:", targetCategoriesVersion);
    if (categoriesVersion === targetCategoriesVersion) {
        log.info("At current category version, skipping category creation");
    } else {
        log.info("Creating category Content...");
        contentSuccess = await createCategoriesContent();
    }
    if (!contentSuccess) {return false;}
    log.info("Current Global Item Content Version:",globalItemVersion," Target Version:", targetGlobalItemVersion);
    if (globalItemVersion === targetGlobalItemVersion) {
        log.info("At current Global item version, skipping global item creation");
    } else {
        log.info("Creating Global Item Content...");
        contentSuccess = await createGlobalItemContent();
    }
    return contentSuccess;
}

async function addStockedAtIndicatorToSchema() {
    let updateSuccess = true;
    log.info("Upgrading schema to support stocked at indicators.");
    const itemq = { selector: { type: { "$eq": "item"}},
                    limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await groceriesDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}                
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
            try { dbResp = await groceriesDBAsAdmin.insert(foundItemDoc)}
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
    const delq: MangoQuery = { selector: { type : { "$in": ["list","item","category"]}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundDelDocs: MangoResponse<ListDoc | ItemDoc>;
    try { foundDelDocs = (await groceriesDBAsAdmin.find(delq) as MangoResponse<ListDoc | ItemDoc>)}
    catch(err) { log.error("Could not find items/lists/categories to delete:",err); return false;}
    log.debug("Found items/lists/categories to delete:",foundDelDocs.docs.length);
    for (let i = 0; i < foundDelDocs.docs.length; i++) {
        let dbResp=null;
        try { dbResp=await groceriesDBAsAdmin.destroy(foundDelDocs.docs[i]._id,foundDelDocs.docs[i]._rev)}
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
                             limit: await totalDocCount(groceriesDBAsAdmin)};
        let foundListGroupDocs = await groceriesDBAsAdmin.find(listgroupq);
        if (foundListGroupDocs.docs.length == 0) {
            log.info("No default listgroup found for :",foundUserDoc.name," ... creating...");
            let newCurDateStr = (new Date()).toISOString()
            const newListGroupDoc: ListGroupDoc = {
                type: "listgroup", name: (foundUserDoc.name + " (default)"),
                default: true, recipe: false, alexaDefault: false, listGroupOwner: foundUserDoc.name, sharedWith: [], updatedAt: newCurDateStr
            }
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(newListGroupDoc)}
            catch(err) { log.error("Couldn't create new list group:",newListGroupDoc.name, "err:",JSON.stringify(err))
                         updateSuccess = false;}
        } else {
            log.info("Default List Group already exists for : ", foundUserDoc.name);
        }
    }
    return updateSuccess;
}    

async function updateSystemCategory(catDoc: CategoryDoc): Promise<boolean> {
    let success = true;
    catDoc.listGroupID = "system";
    catDoc.updatedAt = (new Date().toISOString());
    let dbResp = null;
    try { dbResp = await groceriesDBAsAdmin.insert(catDoc)}
    catch(err) { log.error("Couldn't update system category with list group system.");
                 success = false;}
    if (success) { log.info("Updated category ",catDoc.name," to system list group.");}
    return success;             
}

async function updateCustomCategory(catDoc: CategoryDoc, itemDocs: ItemDocs): Promise<boolean> {
    let success = true;
    let listGroups = new Set<string>();
    for (let i = 0; i < itemDocs.length; i++) {
        const item = itemDocs[i];
        if (item.lists.filter(il => (il.categoryID === catDoc._id)).length > 0) {
            listGroups.add(String(item.listGroupID))
        }
    }
    log.info("Updating custom category ",catDoc.name," List groups to process:",listGroups);
    if (listGroups.size === 0) {
        let newCatDoc: CategoryDoc = cloneDeep(catDoc);
        newCatDoc.listGroupID = null;
        newCatDoc.updatedAt = (new Date().toISOString());
        let dbResp = null;
        try { dbResp = await groceriesDBAsAdmin.insert(newCatDoc)}
        catch(err) { log.error("Couldn't set category ",catDoc.name," to an unused list group");
            success = false;}
        if (success) { log.info("Assigned unused by item category ",catDoc.name, " to the unused list group ");}   
    }
    else {
        let firstOneUpdated = false;
        for (const lg of listGroups) {
            if (firstOneUpdated) {
                let newCatDoc = cloneDeep(catDoc);
                newCatDoc._id = undefined;
                newCatDoc._rev = undefined;
                newCatDoc.listGroupID = lg;
                newCatDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.insert(newCatDoc)}
                catch(err) { log.error("Couldn't add category ",catDoc.name," with list group ",lg);
                    success = false;}
                if (success) { log.info("Created new category ",catDoc.name, " in list group ",lg)}   
            } else {
                let newCatDoc = cloneDeep(catDoc);
                newCatDoc.listGroupID = lg;
                newCatDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.insert(newCatDoc)}
                catch(err) { log.error("Couldn't update category ",catDoc.name," with list group ",lg);
                    success = false;}
                if (success) { log.info("Updated category ",catDoc.name," with list group ",lg)}
                firstOneUpdated = true;    
            }
        }
    }
    if (success) {log.info("Updated custom category / created new : ",catDoc.name)}
    return success;
}

async function updateSystemUOM(uomDoc: UomDoc): Promise<boolean> {
    let success = true;
    let updatedUOMDoc = cloneDeep(uomDoc);
    updatedUOMDoc.listGroupID = "system";
    updatedUOMDoc.updatedAt = (new Date().toISOString());
    let dbResp = null;
    try { dbResp = await groceriesDBAsAdmin.insert(updatedUOMDoc)}
    catch(err) { log.error("Couldn't update system UOM with list group system.");
                 success = false;}
    if (success) { log.info("Updated UOM ",uomDoc.description," to system list group.");}
    return success;             
}

async function updateCustomUOM(uomDoc: UomDoc, itemDocs: ItemDocs, recipeDocs: RecipeDoc[], listGroupDocs: ListGroupDocs): Promise<boolean> {
    let success = true;
    let listGroups = new Set<string>();
    let recipeListGroups = listGroupDocs.filter(lgd => (lgd.recipe));
    for (let i = 0; i < itemDocs.length; i++) {
        const item = itemDocs[i];
        if (item.lists.filter(il => (il.uomName === uomDoc.name)).length > 0) {
            listGroups.add(String(item.listGroupID))
        }
    }
    log.info("Updating custom UOM ",uomDoc.description," List groups to process:",listGroups);
    if (listGroups.size === 0) {
        let usedRecipeCount = 0;
        for (let i = 0; i < recipeDocs.length; i++) {
            usedRecipeCount = usedRecipeCount + recipeDocs[i].items.filter(ri => (ri.recipeUOMName === uomDoc.name || ri.shoppingUOMName === uomDoc.name)).length
        }
        if (usedRecipeCount = 0) {
            let newUOMDoc: UomDoc = cloneDeep(uomDoc);
            newUOMDoc.listGroupID = null;
            newUOMDoc.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(newUOMDoc)}
            catch(err) { log.error("Couldn't set UOM ",uomDoc.description," to an unused list group");
                success = false;}
            if (success) { log.info("Assigned unused by item UOM",uomDoc.description, " to the unused list group ");}   
        } else {
            // custom uom, used in a recipe but not by any items ==> add to every recipe listgroup
            for (const recipeLG of recipeListGroups) {
                let newUOMDoc: UomDoc = cloneDeep(uomDoc);
                delete newUOMDoc._id;
                delete newUOMDoc._rev;
                newUOMDoc.listGroupID = String(recipeLG._id);
                newUOMDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.insert(newUOMDoc)}
                catch(err) { log.error("Couldn't set UOM ",uomDoc.description," to recipe list group ",recipeLG.name, err);
                    success = false;}
                if (success) { log.info("Assigned UOM used in ",usedRecipeCount," recipes:",uomDoc.description, " to the recipe list group ",recipeLG.name);}       
            }
        }
    }
    else {
        let firstOneUpdated = false;
        for (const lg of listGroups) {
            if (firstOneUpdated) {
                let newUomDoc = cloneDeep(uomDoc);
                newUomDoc._id = undefined;
                newUomDoc._rev = undefined;
                newUomDoc.listGroupID = lg;
                newUomDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.insert(newUomDoc)}
                catch(err) { log.error("Couldn't add UOM ",uomDoc.description," with list group ",lg);
                    success = false;}
                if (success) { log.info("Created new UOM ",uomDoc.description, " in list group ",lg)}   
            } else {
                let newUomDoc = cloneDeep(uomDoc);
                newUomDoc.listGroupID = lg;
                newUomDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await groceriesDBAsAdmin.insert(newUomDoc)}
                catch(err) { log.error("Couldn't update UOM ",uomDoc.description," with list group ",lg);
                    success = false;}
                if (success) { log.info("Updated UOM ",uomDoc.description," with list group ",lg)}
                firstOneUpdated = true;    
            }
        }
    }
    if (success) {log.info("Updated custom UOM / created new : ",uomDoc.name)}
    return success;
}


function isUserInListGroup(username: string, listGroupID: string, listGroupDocs: ListGroupDocs): boolean {
    let findIndex = listGroupDocs.findIndex(lg => ((lg._id === listGroupID && (lg.listGroupOwner === username || lg.sharedWith.includes(username)))));
    return (findIndex !== -1);
}

async function generateUserColors(catDocs: CategoryDocs, userDocs: UserDoc[], settingsDocs: SettingsDoc[], listGroupDocs: ListGroupDocs): Promise<boolean> {
    let success = true;
    log.info("Generating user-specific colors for every category");
    for (let i = 0; i < userDocs.length; i++) {
        const user = cloneDeep(userDocs[i]);
        log.info("Updating settings for user ",user.name," to have colors");
        let foundSetting = settingsDocs.find(sd => (sd.username === user.name));
        log.debug("Found setting doc to update:",foundSetting?.username)
        let newCategoryColors : { [key: string]: string }= {};
        for (let j = 0; j < catDocs.length; j++) {
            const cat = catDocs[j];
            let includeCat = false;
            if (cat.listGroupID === "system") {
                includeCat = true;
            } else {
                if (cat.listGroupID === null || cat.listGroupID === undefined) {
                    includeCat = false
                } else {
                    includeCat = isUserInListGroup(user.name,cat.listGroupID,listGroupDocs)
                }
            }
            if (includeCat) {
                let id = cat._id;
                if (id !== undefined && id !== null && cat.color && !isEmpty(cat.color)) {
                    newCategoryColors[id] = cat.color;
                }    
            }
        }
        if (foundSetting === undefined) {
            let newSettingDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingDoc.username = user.name;
            newSettingDoc.categoryColors = newCategoryColors;
            newSettingDoc.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(newSettingDoc)}
            catch(err) { log.error("Couldn't create user setting ",user.name," with category colors ");
                success = false;}
            if (success) {log.info("User setting doc created for ",user.name," didn't previously exist")};    
        } else {
            // update setting doc for user, add key
            foundSetting.categoryColors = newCategoryColors;
            foundSetting.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(foundSetting)}
            catch(err) { log.error("Couldn't update user setting ",user.name," with category colors ");
                success = false;}
            if (success) {log.info("User setting doc updated for user ",user.name)}    
        }
    }
    return success;
}

async function getLatestUOMDocs(): Promise<[boolean,UomDoc[]]> {
    const uomq: MangoQuery = { selector: { type: "uom", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundUOMDocs: MangoResponse<UomDoc>;
    try {foundUOMDocs = (await groceriesDBAsAdmin.find(uomq) as MangoResponse<UomDoc>);}
    catch(err) {log.error("Could not find Units of Measure during schema update:",err); return [false,[]];}
    return [true,foundUOMDocs.docs];
}

async function getLatestCategoryDocs(): Promise<[boolean,CategoryDocs]> {
    const catq: MangoQuery = { selector: { type: "category", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundCatDocs: MangoResponse<CategoryDoc>;
    try {foundCatDocs = (await groceriesDBAsAdmin.find(catq) as MangoResponse<CategoryDoc>);}
    catch(err) {log.error("Could not find Categories during schema update::",err); return [false,[]];}
    return [true,foundCatDocs.docs];
}

async function getLatestListGroupDocs(): Promise<[boolean,ListGroupDocs]> {
    const lgq: MangoQuery = { selector: { type: "listgroup", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundListGroupDocs: MangoResponse<ListGroupDoc>;
    try {foundListGroupDocs = (await groceriesDBAsAdmin.find(lgq) as MangoResponse<ListGroupDoc>);}
    catch(err) {log.error("Could not find List Groups during schema update::",err); return [false,[]];}
    return [true,foundListGroupDocs.docs];
}

async function getLatestListDocs(): Promise<[boolean,ListDoc[]]> {
    const lq: MangoQuery = { selector: { type: "list", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundListDocs: MangoResponse<ListDoc>;
    try {foundListDocs = (await groceriesDBAsAdmin.find(lq) as MangoResponse<ListDoc>);}
    catch(err) {log.error("Could not find List Groups during schema update::",err); return [false,[]];}
    return [true,foundListDocs.docs];
}

async function getLatestItemDocs(): Promise<[boolean,ItemDocs]> {
    const itemq: MangoQuery = { selector: { type: "item", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await groceriesDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {log.error("Could not find Items during schema update::",err); return [false,[]];}
    return [true,foundItemDocs.docs];
}

async function getLatestGlobalItemDocs(): Promise<[boolean,GlobalItemDoc[]]> {
    const itemq: MangoQuery = { selector: { type: "globalitem", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundGlobalItemDocs: MangoResponse<GlobalItemDoc>;
    try {foundGlobalItemDocs = (await groceriesDBAsAdmin.find(itemq) as MangoResponse<GlobalItemDoc>);}
    catch(err) {log.error("Could not find Global Items during schema update::",err); return [false,[]];}
    return [true,foundGlobalItemDocs.docs];
}

async function getLatestRecipeDocs(): Promise<[boolean,RecipeDoc[]]> {
    const recipeq: MangoQuery = { selector: { type: "recipe", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundRecipeDocs: MangoResponse<RecipeDoc>;
    try {foundRecipeDocs = (await groceriesDBAsAdmin.find(recipeq) as MangoResponse<RecipeDoc>);}
    catch(err) {log.error("Could not find Recipes during schema update::",err); return [false,[]];}
    return [true,foundRecipeDocs.docs];
}

async function checkAndCreateNewUOMForRecipeItem(uomName: string): Promise<boolean> {
    let success = true;
    let [getSuccess,curUOMDocs] = await getLatestUOMDocs();
    if (!getSuccess) {return false};
    let alreadyInRecipeUOMs = (curUOMDocs.filter(uom => (uom.name === uomName && uom.listGroupID === "recipe")).length > 0);
    if (!alreadyInRecipeUOMs) {
        let uomDoc = curUOMDocs.find(uom => (uom.name === uomName));
        if (uomDoc === undefined) {
            log.error("Could not find UOM to update for recipe:",uomName);
            success = false;
        } else {
            let newUOMDoc = cloneDeep(uomDoc);
            newUOMDoc._id = undefined;
            newUOMDoc._rev = undefined;
            newUOMDoc.listGroupID = "recipe";
            newUOMDoc.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await groceriesDBAsAdmin.insert(newUOMDoc)}
            catch(err) { log.error("Couldn't create new UOM for recipe:",uomName);
                success = false;}
            if (success) {log.info("Created new UOM ",uomName, " and assigned to recipe group");}    
        }
    }
    return success;
}

async function generateRecipeUOMs(recipeDocs: RecipeDoc[]): Promise<boolean> {
    let success = true;
    let [getSuccess,baseUOMDocs] = await getLatestUOMDocs();
    if (!getSuccess) {return false;}
    for (let i = 0; i < recipeDocs.length; i++) {
        const recipe = recipeDocs[i];
        for (let j = 0; j < recipe.items.length; j++) {
            const item = recipe.items[j];
            log.debug("Processing recipe ",recipe.name, " item: ",item.name);
            if (item.recipeUOMName !== undefined && item.recipeUOMName !== null && item.recipeUOMName !== "") {
                let foundUOM = baseUOMDocs.findIndex(uom => (uom._id?.startsWith("system:uom:") && uom.name === item.recipeUOMName))
                if (foundUOM === -1) {
                    let ok = await checkAndCreateNewUOMForRecipeItem(item.recipeUOMName);
                    if (!ok) {success=false;break};
                }
            }
            if (item.shoppingUOMName !== undefined && item.shoppingUOMName !== null && item.shoppingUOMName !== "") {
                let foundUOM = baseUOMDocs.findIndex(uom => (uom._id?.startsWith("system:uom:") && uom.name === item.shoppingUOMName))
                if (foundUOM === -1) {
                    let ok = await checkAndCreateNewUOMForRecipeItem(item.shoppingUOMName);
                    if (!ok) {success=false;break};
                }
            }
        }
        if (!success) {break};
    }
    return success;
}

async function deleteColorFieldFromCategories(): Promise<boolean> {
    let success = true;
    let [getSuccess,categoryDocs] = await getLatestCategoryDocs();
    if (!getSuccess) {return false;}
    for (const cat of categoryDocs) {
        let newCatDoc = cloneDeep(cat);
        delete newCatDoc.color;
        newCatDoc.updatedAt = (new Date().toISOString());
        let dbResp = null;
        try { dbResp = await groceriesDBAsAdmin.insert(newCatDoc)}
        catch(err) { log.error("Couldn't delete color from category:",newCatDoc.name);
            success = false;}
        if (success) {log.info("Deleted color field from category ",newCatDoc.name);}    
    }
    return success;
}

async function removeDefaultFieldFromListgroups() {
    let success = true;
    let [getSuccess,listGroupDocs] = await getLatestListGroupDocs();
    if (!getSuccess) {return false;}
    log.info("Removing default flag from list groups:",listGroupDocs.length, " found to process");
    for (const lgd of listGroupDocs) {
        let newListGroupDoc = cloneDeep(lgd);
        delete newListGroupDoc.default;
        newListGroupDoc.updatedAt = (new Date().toISOString());
        let dbResp = null;
        let changeSuccess = true;
        try { dbResp = await groceriesDBAsAdmin.insert(newListGroupDoc)}
        catch(err) { log.error("Couldn't delete default flag from list group:",newListGroupDoc.name);
            changeSuccess = false; success=false;}
        if (changeSuccess) {log.info("Deleted default flag from list group ",newListGroupDoc.name);}    
    }
    return success;
}

async function addRecipeListGroupsForUsers(userDocs: UserDoc[]) {
    let success = true;
    let [getSuccess,listGroupDocs] = await getLatestListGroupDocs();
    if (!getSuccess) {return false;}
    log.info("Adding recipe list group for each user:",userDocs.length, " users found to process");
    for (const user of userDocs) {
        let foundRecipeLG = listGroupDocs.find(lgd => (lgd.listGroupOwner === user.name && lgd.recipe));
        if (foundRecipeLG === undefined) {
            let newRecipeLG = cloneDeep(ListGroupDocInit);
            newRecipeLG.listGroupOwner = user.name;
            newRecipeLG.name = user.name + " (Recipes)";
            newRecipeLG.recipe = true;
            newRecipeLG.updatedAt = new Date().toISOString();
            let dbResp = null;
            let addSuccess = true;
            try { dbResp = await groceriesDBAsAdmin.insert(newRecipeLG)}
            catch(err) { log.error("Couldn't add recipe list group for user:",user.name); success = false; addSuccess = false;}
            if (addSuccess) {log.info("Created recipe list group for user:",user.name)}
        }
    }
    return success;
}

async function copyRecipesToListGroups() {
    let success = true;
    let [getSuccess,recipeDocs] = await getLatestRecipeDocs();
    if (!getSuccess) {return false;}
    let [getLGSuccess,listGroupDocs] = await getLatestListGroupDocs();
    if (!getLGSuccess) {return false;}
    let recipeListGroups = listGroupDocs.filter(lgd => (lgd.recipe));
    log.info("Adding recipe list group for each user:",recipeListGroups.length, " users found to process");
    for (const lg of recipeListGroups) {
        for (const recipe of recipeDocs) {
            let newRecipeDoc = cloneDeep(recipe);
            delete newRecipeDoc._id;
            delete newRecipeDoc._rev
            newRecipeDoc.listGroupID = String(lg._id);
            newRecipeDoc.updatedAt = new Date().toISOString();
            let dbResp = null;
            let addSuccess = true;
            try { dbResp = await groceriesDBAsAdmin.insert(newRecipeDoc)}
            catch(err) { log.error("Couldn't add new recipe in list group:",lg.name); success=false; addSuccess=false}
            if (addSuccess) {log.info("Copied recipe ",recipe.name," to list group ",lg.name)}
        }
    }
    return success;
}

async function restructureCategoriesUOMRecipesSchema() {
    let updateSuccess = true;
    log.info("Upgrading schema to link categories,UOMs, and Recipes to list Groups.");
    log.info("Loading up all current categories");
    let [getSuccess,foundCatDocs] = await getLatestCategoryDocs();
    if (!getSuccess) {return false;}
    log.info("Found categories to process: ", foundCatDocs.length);
    const itemq: MangoQuery = { selector: { type: "item", name: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await groceriesDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {log.error("Could not find items during schema update:",err); return false;}
    log.info("Found items to process: ", foundItemDocs.docs.length);
    const userq: MangoQuery = { selector: { type: "user", name: {$exists: true}}, limit: await totalDocCount(usersDBAsAdmin)};
    let foundUserDocs: MangoResponse<UserDoc>;
    try {foundUserDocs = (await usersDBAsAdmin.find(userq) as MangoResponse<UserDoc>);}
    catch(err) {log.error("Could not find user list during schema update:",err); return false;}
    log.info("Found users to create listgroups: ", foundUserDocs.docs.length);
    const settingsq: MangoQuery = { selector: { type: "settings", username: {$exists: true}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundSettingsDocs: MangoResponse<SettingsDoc>;
    try {foundSettingsDocs = (await groceriesDBAsAdmin.find(settingsq) as MangoResponse<SettingsDoc>);}
    catch(err) {log.error("Could not find settings list during schema update:",err); return false;}
    log.info("Found settings to create color specific categories: ", foundSettingsDocs.docs.length);
    let lgChangeSuccess = await removeDefaultFieldFromListgroups();
    if (!lgChangeSuccess) {log.error("Error removing default field... Stopping"); return false;}
    let lgAddRecipeSuccess = await addRecipeListGroupsForUsers(foundUserDocs.docs);
    if (!lgAddRecipeSuccess) {log.error("Error adding recipe list groups... Stopping"); return false;}
    let recipeCopySuccess = await copyRecipesToListGroups();
    if (!recipeCopySuccess) {log.error("Error copying recipes to list groups"); return false;}
    
    for (let i = 0; i < foundCatDocs.length; i++) {
        const cat = foundCatDocs[i];
        if (cat && cat._id && cat._id.startsWith("system:cat:")) {
            updateSuccess = await updateSystemCategory(cat);
        } else {
            updateSuccess = await updateCustomCategory(cat,foundItemDocs.docs);
        }
        if (!updateSuccess) {break;}
    }
    if (!updateSuccess) {return false};
    log.info("Retrieving updated categories after changes...");
    [getSuccess,foundCatDocs] = await getLatestCategoryDocs();
    if (!getSuccess) {return false};
    let [getLGSuccess,foundListGroupDocs] = await getLatestListGroupDocs();
    if (!getLGSuccess) {return false;}
    log.info("Found list groups to create color specific categories: ", foundListGroupDocs.length);
    updateSuccess = await generateUserColors(foundCatDocs,foundUserDocs.docs, foundSettingsDocs.docs, foundListGroupDocs);
    if (!updateSuccess) {return false};
    log.info("User Color settings all created/updated ");
    let [uomSuccess,foundUOMDocs] = await getLatestUOMDocs();
    if (!uomSuccess) {return false};
    log.info("About to update units of measure with listgroup data. Found: ",foundUOMDocs.length);
    let [recipeSuccess,foundRecipeDocs] = await getLatestRecipeDocs();
    if (!recipeSuccess) {return false;}
    log.info("About to create units of measure for Recipes. Found recipes: ",foundRecipeDocs.length);
    for (let i = 0; i < foundUOMDocs.length; i++) {
        const uom = foundUOMDocs[i];
        if (uom && uom._id && uom._id?.startsWith("system:uom:")) {
            updateSuccess = await updateSystemUOM(uom);
        } else {
            updateSuccess = await updateCustomUOM(uom,foundItemDocs.docs,foundRecipeDocs, foundListGroupDocs);
        }
        if (!updateSuccess) {break;}
    }
    log.info("UOMs by item classified/created");
//    updateSuccess = await generateRecipeUOMs(foundRecipeDocs);
//    if (!updateSuccess) {return false};
    log.info("Deleting color field from categories");
    updateSuccess = await deleteColorFieldFromCategories()
    return updateSuccess;
}    

async function restructureImagesListgroups() {
    log.info("Adding list group field to all images...")
    log.info("Finding all items that have an image...")
    let updateSuccess=true;
    const itemq: MangoQuery = { selector: { type: "item", name: {$exists: true}, imageID: {$ne: null}}, limit: await totalDocCount(groceriesDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await groceriesDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {log.error("Could not find items during schema update:",err); return false;}
    log.info("Found images to process: ", foundItemDocs.docs.length);
    if (foundItemDocs.docs.length === 0) {return true;}
    for (const itemDoc of foundItemDocs.docs) {
        let imageDoc : ImageDoc = ImageDocInit;
        let imageSuccess: boolean = true;
        try {imageDoc = await groceriesDBAsAdmin.get(String(itemDoc.imageID)) as ImageDoc}
        catch(err) {log.error("Could not find image doc during schema update:",err); imageSuccess=false;}
        if (imageSuccess) {
            imageDoc.listGroupID = itemDoc.listGroupID;
            try {await groceriesDBAsAdmin.insert(imageDoc)}
            catch(err) {log.error("Could not update image doc during schema update:",err); imageSuccess=false;}
        }
        if (imageSuccess) {
            log.info("Image for ",itemDoc.name," updated with list group ID");
        }
        let itemUpdateSuccess=true;
        if (!imageSuccess) {
            itemDoc.imageID=null;
            try {await groceriesDBAsAdmin.insert(itemDoc)}
            catch(err) {log.error("Could not update item ID setting image ID to null",err); itemUpdateSuccess=false;}
        }
        if (!itemUpdateSuccess) {
            updateSuccess=false;
            break;
        }
    }
    return updateSuccess;
}

async function fixDuplicateCategories() {
    let [listSuccess,currentLists] = await getLatestListDocs();
    if (!listSuccess) {
        log.error("Could not retrieve lists...");
        return false;
    }
    let [categorySuccess,currentCategories] = await getLatestCategoryDocs();
    if (!categorySuccess) {
        log.error("Could not retrieve categories...");
        return false;
    }
    let [itemSuccess,currentItems] = await getLatestItemDocs();
    if (!itemSuccess) {
        log.error("Could not retrieve items...");
        return false;
    }
    log.info("Checking for duplicate category names within list group...");
    let catDupCheck: any = {};
    for (const cat of currentCategories) {
        if (cat.listGroupID === null || cat.listGroupID === "system") {continue;}
        let concatIdx=cat.listGroupID+":"+cat.name.toUpperCase();
        if (catDupCheck.hasOwnProperty(concatIdx)) {
            log.info("Duplicate category name detected... ",cat.listGroupID,cat.name," cleaning...");
            changeCategoryOnItems(cat.listGroupID,String(cat._id),catDupCheck[concatIdx]);
            try {let dbResp = await groceriesDBAsAdmin.destroy(String(cat._id),String(cat._rev))}
            catch(err) {log.error("Could not delete category ",cat.name); return false;}
        } else {
            catDupCheck[concatIdx] = cat._id;
        }    
    }
    log.info("Finished with duplicate check...");
    return true;
}

type DupCheckCat = {
    list_id: string,
    listgroup_id: string | null,
    cat_id: string,
    cat_good: boolean,
    cat_name: string,
    is_dup: boolean,
    dup_idx: number
}

async function fixDuplicateCategoriesInAList() {
    // Check if there are duplicate categories in a list by name only (ignoring if it is in the right list group)
    // TODO -- need to check if the one we are updating to is "correct"
    let [listSuccess,currentLists] = await getLatestListDocs();
    if (!listSuccess) {return false;}
    let [categorySuccess,currentCategories] = await getLatestCategoryDocs();
    if (!categorySuccess) {return false;}
    let catDupCheck: any = {};
    let catDupCheckGoodBad : DupCheckCat[] = [];
    for (const list of currentLists) {
        for (const cat of list.categories) {
            if (cat.startsWith("system:cat:")) {continue;}
            let foundCat = currentCategories.find(curCat => curCat._id === cat);
            if (isEmpty(foundCat)) { continue;}
            let newCat : DupCheckCat = {
                list_id: String(list._id),
                listgroup_id: list.listGroupID,
                cat_id: cat,
                cat_good: foundCat.listGroupID === list.listGroupID,
                cat_name: foundCat.name.toUpperCase(),
                is_dup: false,
                dup_idx: 0
            }
            catDupCheckGoodBad.push(newCat);
        }
    }
    for (const catCheck of catDupCheckGoodBad) {
        for (const origCat of catDupCheckGoodBad) {
            if (catCheck.list_id === origCat.list_id &&
                catCheck.cat_name === origCat.cat_name && 
                catCheck.cat_id !== origCat.cat_id) {
                    origCat.is_dup = true;
                }
        }
    }
    catDupCheckGoodBad.sort( (a,b) => (
        a.list_id.localeCompare(b.list_id) ||
        a.cat_name.localeCompare(b.cat_name)
    ))
    for (const catCheck of catDupCheckGoodBad) {
        let dupIdx=0;
        for (const origCat of catDupCheckGoodBad) {
            if (catCheck.list_id === origCat.list_id &&
                catCheck.cat_name === origCat.cat_name && origCat.cat_good && origCat.is_dup) {
                    origCat.dup_idx = dupIdx;
                    dupIdx++;
                }
        }
    }
    let dupObjs = catDupCheckGoodBad.filter(catObj => catObj.is_dup && (!catObj.cat_good || catObj.dup_idx > 0));
    for (const dup of dupObjs) {
        const goodDup = catDupCheckGoodBad.find(catObj => (
            catObj.list_id === dup.list_id &&
            catObj.cat_name === dup.cat_name &&
            catObj.cat_good && catObj.dup_idx === 0
        ))
        if (isEmpty(goodDup)) {
            // bad duplicate with no matching good dup -- delete from list
            log.info("Duplicate with no matching good dup:",dup.cat_name,dup.cat_id," ... deleting from list");
            // update category on existing items...
            log.info("Changing category on items in listgroup ",dup.listgroup_id,"from",dup.cat_id,"to null.");
            let itemFixSuccess = changeCategoryOnItems(String(dup.listgroup_id),dup.cat_id,null);
            if (!itemFixSuccess) {return false;}
            // then remove category from list
            let listDoc: ListDoc;
            try {listDoc = await groceriesDBAsAdmin.get(dup.list_id) as ListDoc}
            catch(err) {log.error("Could not retrieve list doc:",dup.list_id); return false;}
            let newCategories = cloneDeep(listDoc.categories);
            let idx=newCategories.indexOf(dup.cat_id);
            newCategories.splice(idx,1);
            listDoc.categories=newCategories;
            try {await groceriesDBAsAdmin.insert(listDoc)}
            catch(err) {log.error("Could not update list doc:",dup.list_id); return false;}
        } else {
            log.debug("Duplicate with 1 matching good dup:",dup.cat_id,dup.cat_name)
            // update category on existing items...
            log.info("Changing category on items in listgroup ",dup.listgroup_id,"from",dup.cat_id,"to",goodDup.cat_id);
            let itemFixSuccess = changeCategoryOnItems(String(dup.listgroup_id),dup.cat_id,goodDup.cat_id);
            if (!itemFixSuccess) {return false;}
            // then change category in list
            let listDoc: ListDoc;
            try {listDoc = await groceriesDBAsAdmin.get(dup.list_id) as ListDoc}
            catch(err) {log.error("Could not retrieve list doc:",dup.list_id,err); return false;}
            let newCategories = cloneDeep(listDoc.categories);
            let idx=newCategories.indexOf(dup.cat_id);
            newCategories[idx]=goodDup.cat_id;
            listDoc.categories=newCategories;
            try {await groceriesDBAsAdmin.insert(listDoc)}
            catch(err) {log.error("Could not update list doc:",dup.list_id); return false;}
            log.info("Changed category on list",dup.list_id,"from",dup.cat_id,"to",goodDup.cat_id);
        }
    }
    return true;
}

async function changeCategoryOnItems(chgListGroup: string, oldCat: string, newCat: string|null) {
    let [itemSuccess,currentItems] = await getLatestItemDocs();
    if (!itemSuccess) {return false;}
    let itemsToFix = currentItems.filter(item => (item.listGroupID === chgListGroup));
    for (const itemFix of itemsToFix) {
        let itemChanged = false;
        for (const itemList of itemFix.lists) {
            if (itemList.categoryID !== oldCat) {continue;}
            itemList.categoryID = newCat;
            itemChanged = true;
        }
        if (itemChanged) {
            try {let dbResp = await groceriesDBAsAdmin.insert(itemFix)}
            catch(err) {log.error("Could not update item ",itemFix.name, err); return false}
        }
    }
}

async function fixItemCategories() {
    let [itemSuccess,currentItems] = await getLatestItemDocs();
    if (!itemSuccess) {
        log.error("Could not retrieve items...");
        return false;
    }
    let [categorySuccess,currentCategories] = await getLatestCategoryDocs();
    if (!categorySuccess) {
        log.error("Could not retrieve categories...");
        return false;
    }
    log.info("Fixing up categories in items....");
    for (const item of currentItems) {
        let itemChanged = false;
        for (const itemList of item.lists) {
            if (itemList.categoryID === null || itemList.categoryID.startsWith("system:cat:")) {continue;}
            const foundCat = currentCategories.find(curCat => curCat._id === itemList.categoryID && curCat.listGroupID === item.listGroupID);
            if (isEmpty(foundCat)) {
                log.error("Could not find category ",itemList.categoryID," in list group ",item.listGroupID);
                itemList.categoryID = null;
                itemChanged = true;
            }
        }
        if (itemChanged) {
            try {let dbResp = await groceriesDBAsAdmin.insert(item)}
            catch(err) {log.error("Could not update item to remove bad category."); return false;}
        }
    }
    return true;
}

async function updateListRecord(updList: ListDoc) {
    let dbDoc: DocumentGetResponse|null = null;
    try {dbDoc = await groceriesDBAsAdmin.get(String(updList._id))}
    catch(err) {log.error("Error updating list record:",updList.name); return false;}
    let updDoc: ListDoc = cloneDeep(dbDoc) as ListDoc;
    updDoc.categories = updList.categories;
    updDoc.updatedAt = (new Date()).toISOString();
    try {let dbResp = await groceriesDBAsAdmin.insert(updDoc);}
    catch(err) {log.error("Could not update List Record...",updList.name); return false;}
    return true;
}

async function fixCategories() {
    const foundIDDoc = await getLatestDBUUIDDoc();
    if (isEmpty(foundIDDoc)) {
        log.error("No DBUUID record found")
        return false;
    }
    let catsFixed = false;
    if (foundIDDoc.hasOwnProperty("categoriesFixed") && foundIDDoc.categoriesFixed !== undefined) {
        catsFixed = foundIDDoc.categoriesFixed;
    }
    if (catsFixed) {return true};
    const dupCatListSuccess = await fixDuplicateCategoriesInAList();
    if (!dupCatListSuccess) {
        log.error("Error fixing duplicate categories in a list");
        return false;
    }
    const dupSuccess= await fixDuplicateCategories();
    if (!dupSuccess) {
        log.error("Error fixing duplicate categories...");
        return false;
    }
    log.info("Checking for invalid lists/categories");
    let [listSuccess,currentLists] = await getLatestListDocs();
    if (!listSuccess) {
        log.error("Could not retrieve lists...");
        return false;
    }
    let [categorySuccess,currentCategories] = await getLatestCategoryDocs();
    if (!categorySuccess) {
        log.error("Could not retrieve categories...");
        return false;
    }
    log.info("Checking lists to validate categories...");
    for (const list of currentLists) {
        log.info("Checking list: ",list.name);
        for (const cat of list.categories) {
            if (cat.startsWith("system:cat:")) {
                continue;
            }
            let foundCat = currentCategories.find(curCat => cat === curCat._id);
            if (foundCat === undefined) {
                log.error("Category ",cat," does not exist at all... removing from list");
                let newCategories=cloneDeep(list.categories);
                let idx=newCategories.indexOf(cat);
                newCategories.splice(idx,1);
                list.categories=newCategories;
                const updSuccess=await updateListRecord(list);
                if (!updSuccess) {return false;}
            } else {
                if (foundCat.listGroupID === list.listGroupID) {
                    continue;
                } else {
                    log.error("Category ",cat,"(",foundCat.name,") on list ",list._id,"is not in matching list group ",list.listGroupID,'...cleaning...');
                    log.info("Checking for category with same name in correct list group...")
                    const goodCat: CategoryDoc[] = currentCategories.filter(curCat => curCat.listGroupID === list.listGroupID && curCat.name.toUpperCase() === foundCat?.name.toUpperCase());
                    if (goodCat.length === 1) {
                        log.info("Found matching category by name in list group:",goodCat[0]._id);
                        let newCategories=cloneDeep(list.categories);
                        let idx=newCategories.indexOf(cat);
                        newCategories[idx]=String(goodCat[0]._id);
                        list.categories=newCategories;
                        const updSuccess = await updateListRecord(list);
                        if (!updSuccess) {return false;}
                        log.info("Updated list record ",list.name," with revised categories");
                        let itemFixSuccess = changeCategoryOnItems(String(list.listGroupID),cat,String(goodCat[0]._id));
                        if (!itemFixSuccess) {return false;}
                    } else  if (goodCat.length > 1) {
                        log.info("Found multiple matching categories with same name...");
                        log.error("Shouldn't have happened since duplicates should have been fixed already...");
                    } else if (goodCat.length === 0) {
                        log.info("Did not find matching category by name, must create new category in list group...");
                        let newCatDoc: CategoryDoc = {
                            type: "category",
                            listGroupID: list.listGroupID,
                            name: foundCat.name,
                            color: "#ffffff",
                            updatedAt: (new Date()).toISOString()
                        };
                        let newCatCreate: DocumentInsertResponse;
                        try {newCatCreate = await groceriesDBAsAdmin.insert(newCatDoc);}
                        catch(err) {log.error("Error creating category",err); return false;}
                        log.debug("created new category:",newCatDoc," with id:",newCatCreate.id);
                        [categorySuccess,currentCategories] = await getLatestCategoryDocs();
                        if (!categorySuccess) {
                            log.error("Could not retrieve categories...");
                            return false;
                        }                    
                        let newCategories=cloneDeep(list.categories);
                        let idx=newCategories.indexOf(cat);
                        newCategories[idx]=String(newCatCreate.id);
                        list.categories=newCategories;
                        const updSuccess = await updateListRecord(list);
                        if (!updSuccess) {return false;}
                        log.info("Updated list record",list.name,"with correct categories...");
                        let itemFixSuccess = changeCategoryOnItems(String(list.listGroupID),cat,newCatCreate.id);
                        if (!itemFixSuccess) {return false}
                    }
                }
            }
        }
    }
    let itemFixSuccess = await fixItemCategories();
    if (!itemFixSuccess) {return false;}
    foundIDDoc.categoriesFixed = true;
    try { let dbResp = await groceriesDBAsAdmin.insert(foundIDDoc) }
    catch(err) {log.error("Error updating DBUUID for fixing of categories:",err); return false;}
    return true;
}

async function fixItemNames(): Promise<boolean> {
    const foundIDDoc = await getLatestDBUUIDDoc();
    if (isEmpty(foundIDDoc)) {
        log.error("No DBUUID record found")
        return false;
    }
    let itemNamesFixed = false;
    if (foundIDDoc.hasOwnProperty("itemNamesFixed") && foundIDDoc.itemNamesFixed !== undefined) {
        itemNamesFixed = foundIDDoc.itemNamesFixed;
    }
    if (itemNamesFixed) {return true};
    let [globalItemSuccess,globalItems] = await getLatestGlobalItemDocs();
    if (!globalItemSuccess) {return false;}
    let [itemSuccess,items] = await getLatestItemDocs();
    if (!itemSuccess) {return false;}
    for (const item of items) {
        let itemUpdated = false;
        if (item.globalItemID === null) {
            if (item.pluralName === undefined) {
                item.pluralName = item.name;
                itemUpdated = true;
            }
        } else {
            const globalItem = globalItems.find(gi => gi._id === item.globalItemID);
            if (globalItem === undefined || globalItem._id === undefined) {
                log.info("Item ",item.name," had global ID:",item.globalItemID,"which was not found. Unlinking from global item...");
                item.globalItemID = null;
                itemUpdated = true;
            } else {
                const transKey = "globalitem."+globalItem._id.substring("system:item".length+1)
                const correctName=i18next.t(transKey,{count:1});
                const correctPluralName=i18next.t(transKey,{count:2});
                if (item.name !== correctName || item.pluralName !== correctPluralName) {
                    log.info("Item name/plural did not match global item...changing...",item.name);
                    item.name = correctName;
                    item.pluralName = correctPluralName;
                    itemUpdated = true;
                }
            }
        }
        if (itemUpdated) {
            try {let dbResp = await groceriesDBAsAdmin.insert(item)}
            catch(err){ log.error("Could not update item",err); return false;}
        }
    }
    foundIDDoc.itemNamesFixed = true;
    try { let dbResp = await groceriesDBAsAdmin.insert(foundIDDoc) }
    catch(err) {log.error("Error updating DBUUID for fixing of item names:",err); return false;}
    return true;
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
    let schemaUpgradeSuccess = true;
    if (schemaVersion === targetSchemaVersion) {
        log.info("At current schema version, skipping schema update");
    } else {
        if (schemaVersion < 2) {
            log.info("Updating schema to rev. 2: Changes for 'stocked at' indicator on item/list.");
            schemaUpgradeSuccess = await addStockedAtIndicatorToSchema();
            if (schemaUpgradeSuccess) { schemaVersion = 2; await setSchemaVersion(schemaVersion);}
        }
        if (schemaVersion < 3) {
            log.info("Updating schema to rev. 3: Changes for restructuring/listgroups ");
            schemaUpgradeSuccess = await restructureListGroupSchema();
            if (schemaUpgradeSuccess) { schemaVersion = 3; await setSchemaVersion(schemaVersion);}
        }
        if (schemaVersion < 4) {
            log.info("Updating schema to rev. 4: Make Categories/UOMs listgroup specific ");
            schemaUpgradeSuccess = await restructureCategoriesUOMRecipesSchema();
            if (schemaUpgradeSuccess) { schemaVersion = 4; await setSchemaVersion(schemaVersion);}
        }
        if (schemaVersion < 5) {
            log.info("Updating schema to rev 5: Make Images for items listgroup specific ");
            schemaUpgradeSuccess = await restructureImagesListgroups();
            if (schemaUpgradeSuccess) { schemaVersion = 5; await setSchemaVersion(schemaVersion);}
        }    
    }
    let fixCatSuccess = await fixCategories();
    if (!fixCatSuccess) {return false;}
    let fixItemNamesSuccess = await fixItemNames();
    if (!fixItemNamesSuccess) {return false;}
    return schemaUpgradeSuccess;
}

async function createConflictsView(): Promise<boolean> {
    let createdOK=true;
    let viewFound=true;
    let existingView: any;
    log.info("Checking/Creating conflicts view...");
    try {existingView = await groceriesDBAsAdmin.get("_design/"+conflictsViewID)}
    catch(err) {viewFound = false;}
    if (!viewFound) {
        let viewDoc = {
            "type": "view",
            "views": { "conflicts_view" : {
                "map": "function(doc) { if (doc._conflicts) { emit (doc._conflicts, null)}}"
        }}}
        try {
            await groceriesDBAsAdmin.insert(viewDoc as any,"_design/"+conflictsViewID)
        }
        catch(err) {log.error("View not created:",{err}); createdOK=false;}
        log.info("View created/ updated");
    } else {
        if (existingView && existingView.hasOwnProperty('type')) {
            log.info("Conflicts View existed with correct content");
        } else {
            existingView.type = "view";
            try {await groceriesDBAsAdmin.insert(existingView)}
            catch(err) {log.error("Could not update view with type",err); createdOK=false;}
        }
    }
    return createdOK;
}

type CouchIndex = {
    name: string,
    fields: string[];
}

async function checkAndCreateIndex(index: CouchIndex): Promise<boolean> {
    log.info("Checking/Creating index ",index.name);
    let docID = "_design/"+index.name;
    let success = true;
    let dbResp : any = null;
    let indexExists=true;
    let currentType=undefined;
    let currentIdxDoc: any = undefined;
    try {dbResp= await groceriesDBAsAdmin.get(docID)}
    catch(err) {log.info("Could not retrieve index "+index.name+ "... Creating..."); indexExists=false;}
    if (indexExists) {
        log.info("Index "+index.name+" already exists... skipping...");
        currentIdxDoc=cloneDeep(dbResp);
        currentType=dbResp.type;
    } else {
        const newIndex = {index: { fields: index.fields},
            ddoc: docID,
            name: index.name};
        try {dbResp = await groceriesDBAsAdmin.createIndex(newIndex)}
        catch(err) {log.error("Error creating index ",index.name, "Error:",err); success=false}
        log.debug("Response from create index:",dbResp);
        try {dbResp = await groceriesDBAsAdmin.get(docID)}
        catch(err){ log.error("Could not read created index",err); return false;}
        currentType=undefined;
        currentIdxDoc=cloneDeep(dbResp);
    }
    if (currentType===undefined && currentIdxDoc !== null && currentIdxDoc !== undefined) {
        log.info("Adding type label to index...");
        currentIdxDoc.type="index";
        try {dbResp = await groceriesDBAsAdmin.insert(currentIdxDoc)}
        catch(err) {log.error("Could not add type label to index..."); return false}
    }
    return success;
}

async function createStandardIndexes(): Promise<boolean> {
    log.info("Creating Standard Indexes for find command")
    let indexes: CouchIndex[] = [
        {name: "stdType", fields: ["type"]},
        {name: "stdTypeName", fields: ["type","name"]},
        {name: "stdTypeUsername", fields: ["type","username"]},
        {name: "stdTypeListGroupID", fields: ["type","listGroupID"]},
        {name: "stdTypeLists", fields: ["type","lists"]},
        {name: "stdFriend", fields: ["type","friendID1","friendID2"]},
        {name: "stdConflict", fields: ["type","docType","updatedAt"]},
        {name: "stdTypeOwnerDefault", fields: ["type","listGroupOwner","default"]}
    ];
    let success = true;
    for (const index of indexes) {
        success = await checkAndCreateIndex(index);
        if (!success) {break;}
    }
    return success;
}

async function createReplicationFilter(): Promise<boolean> {
    let success=true;
    let dbresp = null;
    let filterFunc = "function(doc,req) {"+
        "if (doc._id.startsWith('_design')) {return true;};" +
         "if (!doc.hasOwnProperty('type')) {return false;};" +
         "if (doc.type === undefined || doc.type === null) {return false;};" +
         "switch (doc.type) {"+
            "case 'item':"+
            "case 'image':"+
            "case 'list':"+
            "case 'recipe':" +
                "return (req.query.listgroups.includes(doc.listGroupID));"+
                "break;" +
            "case 'listgroup':" +
                "return (req.query.listgroups.includes(doc._id));" +
                "break;" +
            "case 'settings':" +
                "return (doc.username === req.query.username);" +
                "break;" +
            "case 'friend':" +
                "return (doc.friendID1 === req.query.username || doc.friendID2 === req.query.username);" +    
            "case 'globalitem':" +
            "case 'dbuuid':" +
            "case 'trigger':" +
                "return (true);" +
                "break;" +
            "case 'category':" +
            "case 'uom':" +
                "return (req.query.listgroups.includes(doc.listGroupID) || doc.listGroupID === 'system');" +
                "break;" +
            "default:"+
                "return (false);"+
                "break;" +
         "  }"+
         "}"

    let ddoc = {
        "_id" : "_design/replfilter",
        "type" : "replfilter",
        "filters": {
            "by_user" : filterFunc
        }
    }
    let dbRecord: MaybeDocument = {};
    let filterExists = true;
    let filterNeedsUpdate = false;
    let filterRecord: DocumentGetResponse | null = null;
    try {filterRecord = await groceriesDBAsAdmin.get("_design/replfilter")}
    catch(err) {log.info("Replication Filter does not exist... Need to create...");
                filterExists=false;
                dbRecord = ddoc;
                };
    if (filterExists) {
        if (filterRecord === null) {filterExists = false}
    }
    if (filterExists && filterRecord !== null) {
        if ((filterRecord as any).filters.by_user !== filterFunc || 
            (filterRecord as any).type !== "replfilter") {
            log.info("Replication Filter exists but is outdated, Need to update...")
            filterNeedsUpdate = true;
            dbRecord = ddoc;
            dbRecord._rev = filterRecord._rev;
        }
        else {log.info("Replication filter exists and has correct content.")}
    }
    if (!filterExists || filterNeedsUpdate) {
        try {dbresp = await groceriesDBAsAdmin.insert(dbRecord);}
        catch(err) {log.debug("Could not create replication filter:",err); success=false;}
        if (success) {log.info("Replication filter created/updated successfully.")}
    }

    return success;
}


async function checkAndCreateViews(): Promise<boolean> {
    let success=false;
    success = await createConflictsView();
    if (!success) {return false};
    success = await createStandardIndexes();
    if (!success) {return false};
    success = await createReplicationFilter();
    return success;
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

async function initializei18next() {
    await i18next.init({
        lng: 'en',
        fallbackLng: 'en',
        supportedLngs: ["en","de","es"],
        interpolation: {
          escapeValue: false, // not needed for react as it escapes by default
        },
        load: "all",
        resources: {
          en: { translation: en_translations },
          de: { translation: de_translations },
          es: { translation: es_translations }
          }
    })
}

export async function dbStartup() {
    prefix.reg(log);
    prefix.apply(log);
    log.setLevel(convertLogLevel(logLevel));
    await initializei18next();
    log.info("Starting up auth server for couchdb...");
    log.info("App Version: ",appVersion);
    log.info("Database Schema Version:",maxAppSupportedSchemaVersion);
    if (couchdbUrl == "") {log.error("No environment variable for CouchDB URL"); return false;}
    if (couchdbInternalUrl == "") {log.error("No environment variable for internal CouchDB URL"); return false;}
    log.info("Database URL: ",couchdbUrl);
    log.info("Internal Database URL: ",couchdbInternalUrl);
    if (couchDatabase == "") { log.error("No CouchDatabase environment variable."); return false;}
    log.info("Using database:",couchDatabase);
    let refreshTimeSeconds: number;
    try {refreshTimeSeconds = timeSpan(refreshTokenExpires)}
    catch (err) {log.error("Invalid Refresh Token expiration environment variable (REFRESH_TOKEN_EXPIRES"); return false;}
    if (refreshTimeSeconds < (minimumAccessRefreshSeconds+60)) {
        log.error("Refresh token expiration time must be greater than minimum access refresh time ("+minimumAccessRefreshSeconds+") + 1 minute");
        return false;
    }
    let accessTimeSeconds: number;
    try {accessTimeSeconds = timeSpan(accessTokenExpires)}
    catch (err) {log.error("Invalid Access Time expiration environment variable (ACCESS_TOKEN_EXPIRES)"); return false;}
    if (accessTimeSeconds < (minimumAccessRefreshSeconds+60)) {
        log.error("Access token expiration time must be greater than minimum access refresh time ("+minimumAccessRefreshSeconds+") + 1 minute");
        return false;
    }
    log.info("Refresh token expires in ",refreshTokenExpires + "("+refreshTimeSeconds+" seconds)");
    log.info("STATUS: Access token expires in ",accessTokenExpires + "("+accessTimeSeconds+" seconds)");
    log.info("STATUS: User Account Creation is: ",disableAccountCreation ? "DISABLED" : "ENABLED");
    let createSuccess= await createDBIfNotExists();
    if (!createSuccess) {return false;}
    let securitySuccess = await setDBSecurity();
    if (!securitySuccess) {return false}
    try {groceriesDBAsAdmin = groceriesNanoAsAdmin.use(couchDatabase);}
    catch(err) {log.error("Could not open grocery database:",err); return false;}
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
    let addDBIDsuccess = await addDBIdentifier();
    if (!addDBIDsuccess) {return false;}
    let schemaSuccess=await checkAndUpdateSchema();
    if (!schemaSuccess) {return false;}
    let contentSuccess = await checkAndCreateContent();
    if (!contentSuccess) {return false;}
    let viewSuccess = await checkAndCreateViews();
    if (!viewSuccess) {return false;}
    if (enableScheduling) {
        if(isInteger(String(resolveConflictsFrequencyMinutes))) {
            setInterval(() => {resolveConflicts()},60000*Number(resolveConflictsFrequencyMinutes));
            log.info("Conflict resolution scheduled every ",resolveConflictsFrequencyMinutes, " minutes.")
            let resolveSuccess=resolveConflicts();
            if (!resolveSuccess) {return false;}
        } else {
            log.error("Invalid environment variable for scheduling conflict resolution -- not started.");
            return false;
        }
        if (isInteger(String(expireJWTFrequencyMinutes))) {
            setInterval(() => {expireJWTs()},60000*Number(expireJWTFrequencyMinutes));
            log.info("JWT expiry scheduled every ",expireJWTFrequencyMinutes," minutes.");
            let jwtSuccess=expireJWTs();
            if (!jwtSuccess) {return false;}
        } else {
            log.error("Invalid environment variable for scheduling JWT expiry -- not started");
            return false;
        }
    }
    log.info("Startup process completed")
    return true;    
}

