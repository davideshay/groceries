import { todosNanoAsAdmin, usersNanoAsAdmin, couchDatabase, couchAdminPassword, couchAdminUser, couchdbUrl, couchdbInternalUrl, couchStandardRole,
couchAdminRole, conflictsViewID, conflictsViewName, utilitiesViewID, refreshTokenExpires, accessTokenExpires,
enableScheduling, resolveConflictsFrequencyMinutes,expireJWTFrequencyMinutes, disableAccountCreation, logLevel, couchKey } from "./apicalls";
import { resolveConflicts } from "./apicalls";
import { expireJWTs, generateJWT } from './jwt'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cloneDeep, isEmpty, isEqual, omit } from "lodash";
import { v4 as uuidv4} from 'uuid';
import { uomContent, categories, globalItems, totalDocCount } from "./utilities";
import { DocumentScope, MangoResponse, MangoQuery } from "nano";
import { CategoryDoc, CategoryDocs, GlobalItemDoc, InitSettingsDoc, ItemDoc, ItemDocs, ListDoc, ListGroupDoc, ListGroupDocs, RecipeDoc, SettingsDoc, UUIDDoc, UomDoc, UserDoc, appVersion, maxAppSupportedSchemaVersion, minimumAccessRefreshSeconds } from "./DBSchema";
import log, { LogLevelDesc } from "loglevel";
import prefix from "loglevel-plugin-prefix";
import { timeSpan } from "./timeutils";


let uomContentVersion = 0;
const targetUomContentVersion = 5;
let categoriesVersion = 0;
const targetCategoriesVersion = 2;
let globalItemVersion = 0;
const targetGlobalItemVersion = 2;
let schemaVersion = 0;
const targetSchemaVersion = 4;


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
        selector: { type: { "$eq": "uom" }, listGroupID: "system"},
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
                    thisDoc.updatedAt = (new Date().toISOString());
                    thisDoc.listGroupID = "system";
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
            uom.listGroupID = "system";
            uom.updatedAt = (new Date().toISOString());
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
        selector: { type: { "$eq": "category" }, listGroupID: "system"},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundCategoryDocs: MangoResponse<CategoryDoc> =  (await todosDBAsAdmin.find(dbcatq) as MangoResponse<CategoryDoc>);
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
                try { dbResp = await todosDBAsAdmin.destroy(thisDoc._id,thisDoc._rev)}
                catch(err) { log.error("Deleting category for replacement:", err);}
            }
        }
        if (needsAdded) {
            log.info("Adding category ",category.name);
            category.listGroupID = "system",
            category.updatedAt = (new Date().toISOString());
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
        foundIDDoc.updatedAt = (new Date().toISOString());
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
        let globalItem: GlobalItemDoc = globalItems[i];
        globalItem.type = "globalitem";
        const docIdx=foundGlobalItemDocs.docs.findIndex((el) => el.name === globalItem.name );
        if (docIdx == -1) {
            log.info("Adding global item ",globalItem.name);
            globalItem.updatedAt = (new Date().toISOString());
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
                globalItem.updatedAt = (new Date().toISOString());
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

async function updateSystemCategory(catDoc: CategoryDoc): Promise<boolean> {
    let success = true;
    catDoc.listGroupID = "system";
    catDoc.updatedAt = (new Date().toISOString());
    let dbResp = null;
    try { dbResp = await todosDBAsAdmin.insert(catDoc)}
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
        try { dbResp = await todosDBAsAdmin.insert(newCatDoc)}
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
                try { dbResp = await todosDBAsAdmin.insert(newCatDoc)}
                catch(err) { log.error("Couldn't add category ",catDoc.name," with list group ",lg);
                    success = false;}
                if (success) { log.info("Created new category ",catDoc.name, " in list group ",lg)}   
            } else {
                let newCatDoc = cloneDeep(catDoc);
                newCatDoc.listGroupID = lg;
                newCatDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await todosDBAsAdmin.insert(newCatDoc)}
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
    uomDoc.listGroupID = "system";
    uomDoc.updatedAt = (new Date().toISOString());
    let dbResp = null;
    try { dbResp = await todosDBAsAdmin.insert(uomDoc)}
    catch(err) { log.error("Couldn't update system UOM with list group system.");
                 success = false;}
    if (success) { log.info("Updated UOM ",uomDoc.description," to system list group.");}
    return success;             
}

async function updateCustomUOM(uomDoc: UomDoc, itemDocs: ItemDocs, recipeDocs: RecipeDoc[]): Promise<boolean> {
    let success = true;
    let listGroups = new Set<string>();
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
            try { dbResp = await todosDBAsAdmin.insert(newUOMDoc)}
            catch(err) { log.error("Couldn't set UOM ",uomDoc.description," to an unused list group");
                success = false;}
            if (success) { log.info("Assigned unused by item UOM",uomDoc.description, " to the unused list group ");}   
        } else {
            let newUOMDoc: UomDoc = cloneDeep(uomDoc);
            newUOMDoc.listGroupID = "recipe";
            newUOMDoc.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(newUOMDoc)}
            catch(err) { log.error("Couldn't set UOM ",uomDoc.description," to recipe list group");
                success = false;}
            if (success) { log.info("Assigned unused by item UOM",uomDoc.description, " to the recipe list group ");}   
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
                try { dbResp = await todosDBAsAdmin.insert(newUomDoc)}
                catch(err) { log.error("Couldn't add UOM ",uomDoc.description," with list group ",lg);
                    success = false;}
                if (success) { log.info("Created new UOM ",uomDoc.description, " in list group ",lg)}   
            } else {
                let newUomDoc = cloneDeep(uomDoc);
                newUomDoc.listGroupID = lg;
                newUomDoc.updatedAt = (new Date().toISOString());
                let dbResp = null;
                try { dbResp = await todosDBAsAdmin.insert(newUomDoc)}
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
            try { dbResp = await todosDBAsAdmin.insert(newSettingDoc)}
            catch(err) { log.error("Couldn't create user setting ",user.name," with category colors ");
                success = false;}
            if (success) {log.info("User setting doc created for ",user.name," didn't previously exist")};    
        } else {
            // update setting doc for user, add key
            foundSetting.categoryColors = newCategoryColors;
            foundSetting.updatedAt = (new Date().toISOString());
            let dbResp = null;
            try { dbResp = await todosDBAsAdmin.insert(foundSetting)}
            catch(err) { log.error("Couldn't update user setting ",user.name," with category colors ");
                success = false;}
            if (success) {log.info("User setting doc updated for user ",user.name)}    
        }
    }
    return success;
}

async function getLatestUOMDocs(): Promise<[boolean,UomDoc[]]> {
    const uomq: MangoQuery = { selector: { type: "uom", name: {$exists: true}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundUOMDocs: MangoResponse<UomDoc>;
    try {foundUOMDocs = (await todosDBAsAdmin.find(uomq) as MangoResponse<UomDoc>);}
    catch(err) {log.error("Could not find Units of Measure during schema update:",err); return [false,[]];}
    return [true,foundUOMDocs.docs];
}

async function getLatestCategoryDocs(): Promise<[boolean,CategoryDocs]> {
    const catq: MangoQuery = { selector: { type: "category", name: {$exists: true}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundCatDocs: MangoResponse<CategoryDoc>;
    try {foundCatDocs = (await todosDBAsAdmin.find(catq) as MangoResponse<CategoryDoc>);}
    catch(err) {log.error("Could not find Categories during schema update::",err); return [false,[]];}
    return [true,foundCatDocs.docs];
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
            try { dbResp = await todosDBAsAdmin.insert(newUOMDoc)}
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
        try { dbResp = await todosDBAsAdmin.insert(newCatDoc)}
        catch(err) { log.error("Couldn't delete color from category:",newCatDoc.name);
            success = false;}
        if (success) {log.info("Deleted color field from category ",newCatDoc.name);}    
    }
    return success;
}

async function restructureCategoriesUOMSchema() {
    let updateSuccess = true;
    log.info("Upgrading schema to link categories and UOMs to list Groups.");
    log.info("Loading up all current categories");
    let [getSuccess,foundCatDocs] = await getLatestCategoryDocs();
    if (!getSuccess) {return false;}
    log.info("Found categories to process: ", foundCatDocs.length);
    const itemq: MangoQuery = { selector: { type: "item", name: {$exists: true}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundItemDocs: MangoResponse<ItemDoc>;
    try {foundItemDocs = (await todosDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {log.error("Could not find items during schema update:",err); return false;}
    log.info("Found items to process: ", foundItemDocs.docs.length);
    const userq: MangoQuery = { selector: { type: "user", name: {$exists: true}}, limit: await totalDocCount(usersDBAsAdmin)};
    let foundUserDocs: MangoResponse<UserDoc>;
    try {foundUserDocs = (await usersDBAsAdmin.find(userq) as MangoResponse<UserDoc>);}
    catch(err) {log.error("Could not find user list during schema update:",err); return false;}
    log.info("Found users to create listgroups: ", foundUserDocs.docs.length);
    const settingsq: MangoQuery = { selector: { type: "settings", username: {$exists: true}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundSettingsDocs: MangoResponse<SettingsDoc>;
    try {foundSettingsDocs = (await todosDBAsAdmin.find(settingsq) as MangoResponse<SettingsDoc>);}
    catch(err) {log.error("Could not find settings list during schema update:",err); return false;}
    log.info("Found settings to create color specific categories: ", foundSettingsDocs.docs.length);
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
    const listgroupsq: MangoQuery = { selector: { type: "listgroup", name: {$exists: true}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundListGroupDocs: MangoResponse<ListGroupDoc>;
    try {foundListGroupDocs = (await todosDBAsAdmin.find(listgroupsq) as MangoResponse<ListGroupDoc>);}
    catch(err) {log.error("Could not find list groups during schema update:",err); return false;}
    log.info("Found list groups to create color specific categories: ", foundListGroupDocs.docs.length);
    updateSuccess = await generateUserColors(foundCatDocs,foundUserDocs.docs, foundSettingsDocs.docs, foundListGroupDocs.docs);
    if (!updateSuccess) {return false};
    log.info("User Color settings all crated/updated ");
    let [uomSuccess,foundUOMDocs] = await getLatestUOMDocs();
    if (!uomSuccess) {return false};
    log.info("About to update units of measure with listgroup data. Found: ",foundUOMDocs.length);
    const recipeq: MangoQuery = { selector: { type: "recipe", name: {$exists: true}}, limit: await totalDocCount(todosDBAsAdmin)};
    let foundRecipeDocs: MangoResponse<RecipeDoc>;
    try {foundRecipeDocs = (await todosDBAsAdmin.find(recipeq) as MangoResponse<RecipeDoc>);}
    catch(err) {log.error("Could not find Recipes during schema update:",err); return false;}
    log.info("About to create units of measure for Recipes. Found recipes: ",foundRecipeDocs. docs.length);
    for (let i = 0; i < foundUOMDocs.length; i++) {
        const uom = foundUOMDocs[i];
        if (uom && uom._id && uom._id?.startsWith("system:uom:")) {
            updateSuccess = await updateSystemUOM(uom);
        } else {
            updateSuccess = await updateCustomUOM(uom,foundItemDocs.docs,foundRecipeDocs.docs);
        }
        if (!updateSuccess) {break;}
    }
    log.info("UOMs by item classified/created");
    updateSuccess = await generateRecipeUOMs(foundRecipeDocs.docs);
    if (!updateSuccess) {return false};
    log.info("Deleting color field from categories");
    updateSuccess = await deleteColorFieldFromCategories()
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
    if (schemaVersion < 4) {
        log.info("Updating schema to rev. 4: Make Categories/UOMs listgroup specific ");
        let schemaUpgradeSuccess = await restructureCategoriesUOMSchema();
        if (schemaUpgradeSuccess) { schemaVersion = 4; await setSchemaVersion(schemaVersion);}
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
                    { "map": 'function(doc) { if (doc.type && doc.name) {if (doc.type==="item") { emit (doc.name.toUpperCase(), doc._id)}}}'},
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

type CouchIndex = {
    name: string,
    fields: string[];
}

async function checkAndCreateIndex(index: CouchIndex): Promise<boolean> {
    log.info("Creating index ",index.name);
    const newIndex = {index: { fields: index.fields}, name: index.name};
    let success = true;
    let dbResp = null;
    try {dbResp = await todosDBAsAdmin.createIndex(newIndex)}
    catch(err) {log.error("Error creating index ",index.name, "Error:",err); success=false}
    log.debug("Response from create index:",dbResp)
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
        {name: "stdConflict", fields: ["type","docType","updatedAt"]}
    ];
    let success = true;
    for (const index of indexes) {
        success = await checkAndCreateIndex(index);
        if (!success) {break;}
    }
    return success;
}

async function checkAndCreateViews() {
    await createConflictsView();
    await createUtilitiesViews();
    await createStandardIndexes();
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

