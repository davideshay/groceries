import { GlobalItemDoc, GlobalSettings, InitSettingsDoc, ItemDoc, ItemDocInit, ListDoc, ListDocs, ListGroupDoc, ListGroupDocs, SettingsDoc, UserDoc } from "./DBSchema";
import { dbStartup, todosDBAsAdmin, usersDBAsAdmin } from "./dbstartup";
import { DocumentScope, MangoResponse } from "nano";
import axios, {AxiosResponse} from 'axios';
import { cloneDeep, isEmpty } from 'lodash';
import { Directive, SimpleSlotValue, Slot, er } from "ask-sdk-model";
import { SlotInfo , CouchUserInfo, CouchUserInit, SimpleListGroups, SimpleListGroup, SimpleLists, SimpleList, SettingsResponse, SettingsResponseInit, SimpleItems, SimpleItem} from "./datatypes";
import { ExecOptionsWithStringEncoding } from "child_process";
import { ItemList } from "./DBSchema";
import { AddListOptions } from "./DBSchema";
import e from "express";

const MaxDynamicEntitites = 100;

export async function totalDocCount(db: DocumentScope<unknown>) {
    const info = await db.info();
    return info.doc_count;
}

export async function getUserInfo(accessToken: string) {
    let response = {
        userID: "",
        name: "",
        email: "",
        error: "",
        success: false
    }
    const options = {
        "method": "GET",
        "url": "https://api.amazon.com/user/profile",
        "headers": {
            "Authorization": `Bearer ${accessToken}`
        }
    };
    let req: AxiosResponse<any,any> 
    try { req = await axios.request(options) }
    catch(err) {console.log("Error getting user info",err); response.error="API call failed"; return response}
    response.success=true;
    response.userID = req.data.user_id;
    response.email = req.data.email;
    response.name = req.data.name;
    return response;
}

export async function getCouchUserInfo(email: string) {
    let response: CouchUserInfo = cloneDeep(CouchUserInit);
    let userq = {
        selector: { type: "user", email: email},
        limit: await totalDocCount(usersDBAsAdmin)
    }
    let userResponseDocs: MangoResponse<UserDoc> | null = null;
    response.success = true;
    try {userResponseDocs =  (await usersDBAsAdmin.find(userq) as MangoResponse<UserDoc>);}
    catch(err) {console.log("ERROR: Could not find user documents:",err);
                response.success = false;};
    if (response.success && userResponseDocs !== undefined && userResponseDocs !== null && userResponseDocs.docs.length > 0) {
        response.userName = userResponseDocs.docs[0].name
    } else {response.success = false}
    return response;
}

export async function getUserSettings(username: string) {
    let response: SettingsResponse = cloneDeep(SettingsResponseInit);
    let settingsq = {
        selector: { type: "settings", "username": username},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let settingsResponseDocs: MangoResponse<SettingsDoc> | null = null;
    response.success = true;
    try {settingsResponseDocs =  (await todosDBAsAdmin.find(settingsq) as MangoResponse<SettingsDoc>);}
    catch(err) {console.log("ERROR: Could not find user setting documents:",err);
                response.success = false;};
    if (response.success && settingsResponseDocs !== undefined && settingsResponseDocs !== null && settingsResponseDocs.docs.length > 0) {
        response.settings = settingsResponseDocs.docs[0].settings;
    } else {response.success = false}
    return response;
}

export async function getDynamicIntentDirective(listGroups: SimpleListGroups, lists: SimpleLists) : Promise<Directive> {
    let directive: Directive;

    let simpleLocalItems = await getItems(listGroups);
    let listGroupValues : er.dynamic.Entity[] = [];
    listGroups.forEach(lg => {
        const value = { id: lg._id, name: { value: lg.name}};
        listGroupValues.push(value);
    })
    let listValues : er.dynamic.Entity[] = [];
    lists.forEach(l => {
        const value = { id: l._id, name: { value: l.name}};
        listValues.push(value);
    })
    let simpleItemValues: er.dynamic.Entity[] = [];
    let totalDynamicSoFar=listGroups.length+lists.length;
    let dynamicLeft = MaxDynamicEntitites - totalDynamicSoFar;
    simpleLocalItems.forEach(li => {
        if (dynamicLeft > 0) {
            let value: er.dynamic.Entity;
            if (li.pluralName === undefined) {
                value = { id: li._id, name: {value: li.name}}
                dynamicLeft--;
            } else {
                value = { id: li._id, name: {value: li.name, synonyms: [li.pluralName]}}
                dynamicLeft=dynamicLeft-2;
            }
            simpleItemValues.push(value);
        }    
    })

    directive = {  
            type: "Dialog.UpdateDynamicEntities",
             updateBehavior: "REPLACE",
             types:[
                { 
                "name": "listgroup",
                "values": listGroupValues
                },
                {
                "name": "list",
                "values": listValues
                },
                {
                "name": "item",
                "values": simpleItemValues    
                }
             ] 
    }
    return directive;
}


async function getLocalItems(listGroupIDs: string[]): Promise<SimpleItems> {
    const itemq = {
        selector: { type: "item",
                    listGroupID: {"$in": listGroupIDs}},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundItemDocs: MangoResponse<ItemDoc> | null = null;
    try {foundItemDocs = (await todosDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {console.log("ERROR: Could not find item documents",err);
                return []};
    let simpleItems: SimpleItems = [];
    foundItemDocs.docs.forEach(item => {
        if (item.globalItemID === null) {
            let simpleItem: SimpleItem = {_id: item._id, name: item.name, pluralName: item.pluralName}
            simpleItems.push(simpleItem);
        }    
    })
    return simpleItems;
}

export async function getItems(listGroups: SimpleListGroups) {
    let listGroupIDs: string[] = [];           
    listGroups.forEach(lg => {
        listGroupIDs.push(lg._id);
    });
    let simpleLocalItems = await getLocalItems(listGroupIDs);
    let nameMap: any = {};
    let simplifiedItems: SimpleItems = [];
    simpleLocalItems.forEach(li => {
        if (!nameMap.hasOwnProperty(li.name) && !nameMap.hasOwnProperty(li.pluralName)) {
            nameMap[li.name] = li._id;
            let newItem:SimpleItem = {_id: li._id, name: li.name, pluralName: li.pluralName}
            if (li.pluralName !== undefined) {nameMap[li.pluralName!] = li._id}
            simplifiedItems.push(newItem);
        }   
    })
    return simplifiedItems;
}

function addCommasAndAnd(list: string[]) {
    if (list.length < 3) { return list.join(' and '); }
    return `${list.slice(0, - 1).join(', ')}, and ${list[list.length - 1]}`;
  };

export async function getListGroups(username: string) {
    const lgq = {
        selector: { type: "listgroup", 
            "$or": [{"listGroupOwner": username}, {"sharedWith": {$elemMatch: {"$eq": username}} }]},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundListGroupDocs: MangoResponse<ListGroupDoc> | null = null;
    try {foundListGroupDocs =  (await todosDBAsAdmin.find(lgq) as MangoResponse<ListGroupDoc>);}
    catch(err) {console.log("ERROR: Could not find listgroup documents:",err);
                return []};
    let simpleListGroups: SimpleListGroups = [];
    foundListGroupDocs.docs.forEach(lg => {
        let simpleListGroup: SimpleListGroup = { _id: lg._id, name: lg.name, default: lg.default}
        simpleListGroups.push(simpleListGroup);
    })
    return simpleListGroups;
}

export async function getListGroupsText(listGroups: SimpleListGroups) {      
    let listGroupStrings: string[] = [];            
    listGroups.forEach(lg => {
        listGroupStrings.push(lg.name);
    });
    let results =  addCommasAndAnd(listGroupStrings);
    return results;
}

export async function getLists(username: string, listGroups: SimpleListGroups): Promise<[string|null,SimpleLists]> {
    let listGroupIDs: string[] = [];           
    listGroups.forEach(lg => {
        listGroupIDs.push(lg._id);
    });
    const lq = {
        selector: { type: "list",
                    listGroupID: {"$in": listGroupIDs}},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundListDocs: MangoResponse<ListDoc> | null = null;
    try {foundListDocs = (await todosDBAsAdmin.find(lq) as MangoResponse<ListDoc>);}
    catch(err) {console.log("ERROR: Could not find list documents",err);
                return [null,[]]};
    let mergedListDocs: {_id: string, name: string, listGroupID: string|null, lgName: string, lgDefault: boolean}[] = [];
    foundListDocs.docs.forEach(l => {
        let foundListGroup = listGroups.find(lg => (lg._id == l.listGroupID));
        let foundLgName = (foundListGroup == undefined) ? "" : foundListGroup.name;
        let foundLgDefault = (foundListGroup == undefined) ? false : foundListGroup.default;
        let mergedListDoc = {_id: l._id, name: l.name, listGroupID: l.listGroupID, 
                lgName: foundLgName, lgDefault: foundLgDefault};
        mergedListDocs.push(mergedListDoc);
    })
    mergedListDocs.sort((a,b) => (
        Number(b.lgDefault) - Number(a.lgDefault) ||
        a.lgName.toLocaleUpperCase().localeCompare(b.lgName.toLocaleUpperCase()) ||
        a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase())
    ))
    let simpleLists: SimpleLists = [];
    let defaultListID: string| null = null;
    let gotDefaultListID = false;
    mergedListDocs.forEach(l => {
        if (l.lgDefault && !gotDefaultListID) { defaultListID=l._id; gotDefaultListID = true;}
        let simpleList: SimpleList = {_id: l._id, name: l.name, listGroupID: l.listGroupID}
        simpleLists.push(simpleList);
    })
    return [defaultListID,simpleLists];            
}

export async function getListsText(lists: SimpleLists) {
    let listStrings: string[] = [];
    lists.forEach(l => {
        listStrings.push(l.name);
    });
    let results = addCommasAndAnd(listStrings);
    return results;
}

export function getDefaultListGroup(listGroups: SimpleListGroups) {
    if (listGroups.length === 0) {return null};
    let defaultGroup;
    listGroups.every(lg => {
        if (lg.default) {defaultGroup=lg; return false;}
        return true;
    });
    if (!defaultGroup) {defaultGroup=listGroups[0];}
    return defaultGroup;
}

export function getDefaultListID(lists: SimpleLists) {
//TODO
}

export enum SlotType {
    Alexa, Dynamic, Static, None
}

export function getSelectedSlotInfo(slot: Slot) : [ SlotType,  SlotInfo ]{
    let slotInfo: SlotInfo = {id: null, name: ""};
    if (slot === null) {return [SlotType.None,slotInfo]};
    if (isEmpty(slot.resolutions?.resolutionsPerAuthority)) {
         return [SlotType.None,slotInfo]
    };
    let dynamicAnswer: SlotInfo = {id: null, name: ""};
    let dynamicFound = false;
    let staticAnswer: SlotInfo = {id: null, name: ""};
    let staticFound = false;
    let alexaAnswer: SlotInfo = {id: null, name: ""};
    let alexaFound = false;
    slot.resolutions?.resolutionsPerAuthority?.every(auth => {
        if (auth.status.code === "ER_SUCCESS_MATCH") {
            if (auth.authority.includes("dynamic") && !dynamicFound) {
                dynamicAnswer.id = auth.values[0].value.id;
                dynamicAnswer.name = auth.values[0].value.name;
                dynamicFound = true;
                return (!(staticFound && dynamicFound && alexaFound));
            }
            if (auth.authority == "AlexaEntities" && !alexaFound) {
                alexaAnswer.id = auth.values[0].value.id;
                alexaAnswer.name = auth.values[0].value.name;
                alexaFound = true;
                return (!(staticFound && dynamicFound && alexaFound));
            }    
            if (!auth.authority.includes("dynamic") && !staticFound) {
                staticAnswer.id = auth.values[0].value.id;
                staticAnswer.name = auth.values[0].value.name;
                staticFound = true;
            }    
            return (!(staticFound && dynamicFound && alexaFound))
        } else { return true;}
    })
    if (dynamicFound) {return [SlotType.Dynamic, dynamicAnswer] };
    if (staticFound) {return [SlotType.Static, staticAnswer]};
    if (alexaFound) {return [SlotType.Alexa, alexaAnswer]};
    return [SlotType.None,slotInfo];
}

type HandlerResponse = {success: boolean, message: string}
const HandlerResponseInit = {success: false, message: ""};

export async function addItemToList(itemSlot: Slot, listSlot: Slot,defaultListGroupID: string, defaultListID: string, listMode: string, lists: SimpleLists, settings: GlobalSettings) {
    let addItemResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let [itemSlotType,selectedItem] = getSelectedSlotInfo(itemSlot);
    let [listSlotType,selectedList] = getSelectedSlotInfo(listSlot);
    console.log("in add item to list...",itemSlotType,selectedItem.id);
    if (itemSlotType == SlotType.None || selectedItem.id === null) {
        addItemResponse.message="No item to add to list";
        console.log("No slot type or no id");
        return addItemResponse;
    }
    let listID : string|null = defaultListID;
    if (listSlotType!==SlotType.None && selectedList!==null) {
        listID = selectedList.id;
    }
    if (itemSlotType === SlotType.Static) {
        console.log("slot type is stat")
       addItemResponse = await addGlobalItemToList(selectedItem.id,defaultListGroupID,listID,listMode,lists,settings);
    } else if (itemSlotType === SlotType.Dynamic) {
        console.log("adding dynamic item to list: ",selectedItem);
    } else if (itemSlotType === SlotType.Alexa) {
        console.log("adding Alexa item to the list", selectedItem);
    }
    return addItemResponse;
}

async function itemInListGroup(itemID: string, listGroupID: string) : Promise<{exists: boolean, itemDoc:ItemDoc | null}> {
    let itemResponse: {exists: boolean, itemDoc: ItemDoc|null}= {exists: false, itemDoc: null};
    let itemDoc: ItemDoc|null = null;
    //TODO -- for global items, this is passing in the global item ID and saying OK, but that isn't right
    // it will always exist, even if that global item is not in the list group
    try { itemDoc = await todosDBAsAdmin.get(itemID) as ItemDoc;}
    catch(err) {console.log("ERROR: Could not find item"); return itemResponse}
    if (itemDoc === undefined || itemDoc === null) {return itemResponse}
    itemResponse.exists = true;
    itemResponse.itemDoc = itemDoc;
    return itemResponse;
}

async function globalItemInListGroup(globalItemID: string, listGroupID: string) : Promise<{exists: boolean, itemDoc:ItemDoc | null}> {
    let itemResponse: {exists: boolean, itemDoc: ItemDoc|null}= {exists: false, itemDoc: null};
    const itemq = {
        selector: { type: "item",
                    listGroupID: listGroupID,
                    globalItemID: globalItemID},
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundItemDocs: MangoResponse<ItemDoc> | null = null;
    try {foundItemDocs = (await todosDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {console.log("ERROR: Could not find list documents",err); return itemResponse}
    if (foundItemDocs.docs.length > 0) {
        itemResponse.exists = true;
        itemResponse.itemDoc = foundItemDocs.docs[0];    
    }    
    return itemResponse;
}

async function updateItemInList(itemDoc: ItemDoc,listMode: string, settings: GlobalSettings) : Promise<HandlerResponse> {
    let updateResponse: HandlerResponse = cloneDeep(HandlerResponseInit);


    return updateResponse;
}

async function getGlobalItem(id: string) : Promise<GlobalItemDoc | null> {
    let globalItem : GlobalItemDoc|null = null;
    try { let gi = await todosDBAsAdmin.get(id) as GlobalItemDoc;
          if (gi !== null && gi !== undefined) {globalItem = gi}}
    catch(err) {console.log("ERROR retrieving global",err);}      
    return globalItem;
}

async function addNewItemToList(globalItem: GlobalItemDoc,listGroupID: string,listID: string|null,lists: SimpleLists, listMode: string, settings: GlobalSettings) : Promise<HandlerResponse>{
    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let newItem: ItemDoc = cloneDeep(ItemDocInit);
    newItem.globalItemID=globalItem._id!;
    newItem.listGroupID=listGroupID;
    let newItemLists: ItemList[] = [];
    lists.forEach(l => {
        if (l.listGroupID === listGroupID) {
            let setActive = true;
            if (settings.addListOption === AddListOptions.addToAllListsAutomatically || listMode === "G") {
                setActive = true
            } else if (l._id !== listID && listMode === "L") {
                setActive = false;
            }
            let itemList: ItemList = {
                listID: l._id,
                active: setActive, /// maybe depending on settings, mode
                completed: false, 
                stockedAt: true,
                boughtCount: 0,
                note: "",
                quantity: 1,
                categoryID: globalItem.defaultCategoryID,
                uomName: globalItem.defaultUOM
            }
            newItemLists.push(itemList);
        }
    })
    newItem.lists = newItemLists;
    newItem.updatedAt = (new Date()).toISOString();
    console.log("trying to add to list:",JSON.stringify(newItem,null,4));
    try {let dbResp = await todosDBAsAdmin.insert(newItem)}
    catch(err) {addResponse.message="Error adding item to the list"; console.log("ERROR adding to the list:",err)}
    return addResponse;
}

async function addGlobalItemToList(itemID: string,listGroupID: string,listID: string | null,listMode: string, lists: SimpleLists, settings: GlobalSettings) : Promise<HandlerResponse> {
    // check if item exists at all in the selected list group
    // if it exists:
    //      update lists to active based on settings and selected list mode and stocked at
    // if it doesn't exist:
    //      add to list, copying the global item's name, id->globalitemid, category, and UOM
    console.log("adding global item to the list...");
    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let itemResponse = await globalItemInListGroup(itemID,listGroupID);
    console.log("item is in list group:",itemResponse);
    if (itemResponse.exists && itemResponse.itemDoc !== null) {
        addResponse= await updateItemInList(itemResponse.itemDoc,listMode,settings)
    } else if (!itemResponse.exists || itemResponse.itemDoc === null) {
        let globalItem= await getGlobalItem(itemID)
        if (globalItem !== null) {
            console.log("got global Item:",globalItem," adding to list");
            addResponse = await addNewItemToList(globalItem,listGroupID,listID,lists,listMode,settings)
        }    
    }
    return addResponse;
}