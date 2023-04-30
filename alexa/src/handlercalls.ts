import { GlobalItemDoc, InitSettingsDoc, ItemDoc, ListDoc, ListDocs, ListGroupDoc, ListGroupDocs, SettingsDoc, UserDoc } from "./DBSchema";
import { todosDBAsAdmin, usersDBAsAdmin } from "./dbstartup";
import { DocumentScope, MangoResponse } from "nano";
import axios, {AxiosResponse} from 'axios';
import { cloneDeep, isEmpty } from 'lodash';
import { Directive, SimpleSlotValue, Slot, er } from "ask-sdk-model";
import { SlotInfo , CouchUserInfo, CouchUserInit, SimpleListGroups, SimpleListGroup, SimpleLists, SimpleList, SettingsResponse, SettingsResponseInit, SimpleItems, SimpleItem} from "./datatypes";

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

export async function getLists(username: string, listGroups: SimpleListGroups) {
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
                return []};
    let simpleLists: SimpleLists = [];
    foundListDocs.docs.forEach(l => {
        let simpleList: SimpleList = {_id: l._id, name: l.name, listGroupID: l.listGroupID}
        simpleLists.push(simpleList);
    })

    return simpleLists;            
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

export function getSelectedSlotInfo(slot: Slot) : SlotInfo {
    let slotInfo: SlotInfo = {id: null, name: ""};
    if (slot === null) {return slotInfo};
    if (isEmpty(slot.resolutions?.resolutionsPerAuthority)) { return slotInfo};
    let dynamicAnswer: SlotInfo = {id: null, name: ""};
    let dynamicFound = false;
    let staticAnswer: SlotInfo = {id: null, name: ""};
    let staticFound = false;
    slot.resolutions?.resolutionsPerAuthority?.every(auth => {
        if (auth.status.code === "ER_SUCCESS_MATCH") {
            if (auth.authority.includes("dynamic") && !dynamicFound) {
                dynamicAnswer.id = auth.values[0].value.id;
                dynamicAnswer.name = auth.values[0].value.name;
                dynamicFound = true;
            }
            if (!auth.authority.includes("dynamic") && !staticFound) {
                staticAnswer.id = auth.values[0].value.id;
                staticAnswer.name = auth.values[0].value.name;
                staticFound = true;
            }    
            return (!(staticFound && dynamicFound))
        } else { return true;}
    })
    if (dynamicFound) {return dynamicAnswer};
    if (staticFound) {return staticAnswer};
    return slotInfo;
}