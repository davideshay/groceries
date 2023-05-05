import { GlobalItemDoc, GlobalSettings, InitGlobalItem, ItemDoc, ItemDocInit, ListDoc, ListGroupDoc,
     SettingsDoc, UserDoc } from "./DBSchema";
import { todosDBAsAdmin, usersDBAsAdmin } from "./dbstartup";
import { DocumentGetResponse, DocumentScope, MangoResponse } from "nano";
import axios, {AxiosResponse} from 'axios';
import { cloneDeep, isEmpty } from 'lodash';
import { Directive, Slot, er } from "ask-sdk-model";
import { SlotInfo , SlotType, CouchUserInfo, CouchUserInit, SimpleListGroups, SimpleListGroup, SimpleLists, SimpleList, SettingsResponse, SettingsResponseInit, SimpleItems, SimpleItem, RequestAttributes} from "./datatypes";
import { ItemList } from "./DBSchema";
import { AddListOptions } from "./DBSchema";
import { getSlotValue } from "ask-sdk-core";

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

export async function getEntityInfo(link: string, accessToken: string) {
    let response:{success: boolean, data: any} = {success:false, data: null}
    const options = {
        "method": "GET",
        "url": link,
        "headers": {
            "Authorization": "Bearer "+accessToken,
            "Accept-Language": "en-US",
            "Accept": "application/ld+json"
        }
    }
    let req: AxiosResponse<any,any> 
    try { req = await axios.request(options) }
    catch(err) {console.log("Error getting user info",err); return response}
    response.data = req.data;
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

export async function getDynamicIntentDirective(listGroups: SimpleListGroups, lists: SimpleLists) : Promise<Directive|null> {
    let directive: Directive | null = null;

    if (isEmpty(listGroups) || isEmpty(lists)) {return directive}
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
                "name": "AMAZON.Food",
                "values": simpleItemValues    
                }
             ] 
    }
    return directive;
}

async function getItemByID(id: string) : Promise<ItemDoc | GlobalItemDoc | null> {
    let foundDoc: DocumentGetResponse | null = null;
    try {foundDoc = await todosDBAsAdmin.get(id)}
    catch(err) {console.log("ERROR: could not get item "+id); return null}
    if (foundDoc == undefined || foundDoc == null) {return null};
    if (id.startsWith("sys:item")) {return (foundDoc as GlobalItemDoc)} else {
        return foundDoc as ItemDoc
    }
}

async function checkItemByNameOnList(itemName: string, listID: string, listGroupID: string, listMode: string) {
    let alreadyExists = false;
    const itemq = {
        selector: { type: "item",
                    listGroupID: listGroupID},
        update: true,
        stable: false,            
        limit: await totalDocCount(todosDBAsAdmin)
    }
    let foundItemDocs: MangoResponse<ItemDoc> | null = null;
    try {foundItemDocs = (await todosDBAsAdmin.find(itemq) as MangoResponse<ItemDoc>);}
    catch(err) {console.log("ERROR: Could not find item documents",err);
                return alreadyExists};
    foundItemDocs.docs.every(i => {
        if (i.name.toLocaleUpperCase() === itemName.toLocaleUpperCase() ||
            i.pluralName !== undefined && i.pluralName.toLocaleUpperCase() === itemName.toLocaleUpperCase()) {
                alreadyExists = true;
                return false;
            } else {
                return true;
            }
    })            
    return alreadyExists;
}

async function getLocalItems(listGroupIDs: string[]): Promise<SimpleItems> {
    const itemq = {
        selector: { type: "item",
                    listGroupID: {"$in": listGroupIDs}},
        update: true,
        stable: false,            
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
            if (li.pluralName !== undefined && li.pluralName !== "") {nameMap[li.pluralName!] = li._id}
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

type PotentialAnswer = {
    id: string | null,
    name: string,
    originalIndex: Number,
    slotType: SlotType,
    exactMatch: boolean,
    levenDistance: Number
}

function checkGlobalItemMatch(name: string) {

}

async function isExactMatch(slotType: SlotType,id: string,name: string, slotValue: string, t: any) {
    // if its a global item id, compare singular and plural in translated and untranslated
    // if its a list id, compare the singular and plural in translated and untranslated
    if (slotType === SlotType.Static) {
        let globalItem: GlobalItemDoc | null = await getItemByID(id) as GlobalItemDoc | null;
        if (globalItem == null) return false;
        let globalKey="system:item";
        let tkey=globalItem.name.substring(globalKey.length+1)
        return (
            globalItem.name.toLocaleUpperCase() === slotValue.toLocaleUpperCase() ||
            name.toLocaleUpperCase() === slotValue.toLocaleUpperCase() ||
            t('globalitem.'+tkey,{count: 1}).toLocaleUpperCase() === slotValue.toLocaleUpperCase() ||
            t('globalitem.'+tkey,{count: 2}).toLocaleUpperCase() === slotValue.toLocaleUpperCase()
        )
    } else if (slotType === SlotType.Dynamic) {
        let item: ItemDoc | null = await getItemByID(id) as ItemDoc | null;
        if (item === null) return false;
        return (
            item.name.toLocaleUpperCase() === slotValue.toLocaleUpperCase() ||
            (item.pluralName !== undefined && item.pluralName.toLocaleUpperCase() === slotValue.toLocaleUpperCase())
        )
    } else if (slotType === SlotType.Alexa) {
        return (
            name.toLocaleUpperCase() === slotValue.toLocaleUpperCase()
        )
    }
    return false;
}


function levenDistance(name: string, slotValue: string) {
    return 1;
}

export async function getSelectedItemSlotInfo(slot: Slot, slotValue: string,t : any) : Promise<[SlotType,SlotInfo]>{
    let slotInfo: SlotInfo = {id: null, name: ""};
    if (slot === null) {return [SlotType.None,slotInfo]};
    if (isEmpty(slot.resolutions?.resolutionsPerAuthority)) {
         return [SlotType.None,slotInfo]
    };
    let potentialAnswers: PotentialAnswer[] = [];
    // add slotvalue itself first?
    if (!(slot && slot.resolutions && slot.resolutions.resolutionsPerAuthority)) {
        return [SlotType.None,slotInfo]
    }
    for (let i = 0; i < slot.resolutions.resolutionsPerAuthority.length; i++) {
        const auth = slot.resolutions.resolutionsPerAuthority[i];
        if (auth.status.code === "ER_SUCCESS_MATCH") {
            let slotType: SlotType;
            if (auth.authority.includes("dynamic")) {
                slotType = SlotType.Dynamic
            } else if (auth.authority.includes("AlexaEntities")) {
                slotType = SlotType.Alexa
            } else {
                slotType = SlotType.Static
            }
            for (let i = 0; i < auth.values.length; i++) {
                const val = auth.values[i];
                let potentialAnswer: PotentialAnswer = {
                    id: val.value.id,
                    name: val.value.name,
                    originalIndex: i,
                    slotType: slotType,
                    exactMatch: await isExactMatch(slotType,val.value.id,val.value.name,slotValue,t),
                    levenDistance: levenDistance(val.value.name,slotValue)
                } 
                potentialAnswers.push(potentialAnswer);
            }
        }
    }
    if (potentialAnswers.length === 0) {return [SlotType.None,slotInfo]}
    console.log("Potential Answers:",JSON.stringify(potentialAnswers,null,2))
    potentialAnswers.sort((a,b) => (
        Number(b.exactMatch) - Number(a.exactMatch) ||
        Number(a.originalIndex) - Number(b.originalIndex) ||
        Number(a.slotType) - Number(b.slotType)
    ))
    console.log("Sorted Potential Answers:",JSON.stringify(potentialAnswers,null,4))
    let slotType = potentialAnswers[0].slotType;
    slotInfo = {id: potentialAnswers[0].id, name: potentialAnswers[0].name};
    return [slotType,slotInfo]
}

export function getCommonKey(itemDoc: ItemDoc, key: string) {
    let freqObj: any = {};
    let maxKey = null; let maxCnt=0;
    let lists=cloneDeep(itemDoc.lists);
    lists.sort((a,b) => (a.listID.toUpperCase().localeCompare(b.listID.toUpperCase())))
    lists.forEach( (list: ItemList) => {
      let value=(list as any)[key]
      if (freqObj.hasOwnProperty(value)) {
        freqObj[value]=freqObj[value]+1;
        if (freqObj[value] > maxCnt) {maxCnt = freqObj[value]; maxKey=value;} 
      } else {
        freqObj[value]=1
      }
    });
    if (maxCnt === 0 && lists.length > 0 ) {maxKey = (lists[0] as any)[key]}
    return maxKey;
  }

function getListGroupForList(listID: string, lists: SimpleLists): string | null {
    let foundList = lists.find(l => (l._id == listID));
    if (foundList !== undefined) {return foundList.listGroupID}
    else { return null; }
}

function getListNameForList(listID: string, lists: SimpleLists): string {
    let foundList = lists.find(l => (l._id === listID));
    if (foundList !== undefined) {return foundList.name} 
    else { return "" }
}

function getListGroupName(listGroupID: string, listGroups: SimpleListGroups) : string {
    let foundListGroup = listGroups.find(lg => (lg._id === listGroupID))
    if (foundListGroup !== undefined) { return foundListGroup.name}
    else { return "" }
}

type HandlerResponse = {success: boolean, message: string}
const HandlerResponseInit = {success: false, message: ""};
type DefaultItemData = {globalItemID: string | null, name: string, categoryID: string|null, uomName: string|null}

export async function addItemToList({ requestAttributes, itemSlot, itemSlotValue, listSlot, listGroupSlot, defaultListGroupID, defaultListID,
        listMode, lists, listGroups, settings, accessToken} :
        {requestAttributes: RequestAttributes,itemSlot: Slot, itemSlotValue: string, listSlot: Slot, listGroupSlot: Slot, defaultListGroupID: string, defaultListID: string,
        listMode: string, lists: SimpleLists, listGroups: SimpleListGroups, settings: GlobalSettings, accessToken: string}) {
    let addItemResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
//    let [itemSlotType,selectedItem] = getSelectedSlotInfo(itemSlot);
    let [itemSlotType,selectedItem] = await getSelectedItemSlotInfo(itemSlot,itemSlotValue,requestAttributes.t)
    console.log("returned itemSlotType",itemSlotType,"selected item:",selectedItem);
    let [listSlotType,selectedList] = getSelectedSlotInfo(listSlot);
    let [listGroupSlotType,selectedListGroup] = getSelectedSlotInfo(listGroupSlot);
    console.log("item:",itemSlotType,selectedItem,"list:",listSlotType,selectedList,"group:",listGroupSlotType,selectedListGroup);
    let listID : string|null = defaultListID;
    let listSpecified = false;
    if (listSlotType===SlotType.Dynamic && selectedList!==null && selectedList.id !==null) {
        listID = selectedList.id;
        listMode = "L";
        listSpecified = true;
        let newListGroupID = getListGroupForList(listID,lists);
        if (newListGroupID !== null) {defaultListGroupID = newListGroupID}
    }
    let listGroupID : string|null = defaultListGroupID;
    let listGroupSpecified = false;
    if (listGroupSlotType===SlotType.Dynamic && selectedListGroup!==null && selectedListGroup.id !==null) {
        listGroupID = selectedListGroup.id;
        listMode = "G";
        listGroupSpecified = true;
    }
    console.log("Resolved list:",listID,getListNameForList(listID,lists),"group:",listGroupID,getListGroupName(listGroupID,listGroups),"list mode:",listMode);
    if ((itemSlotType == SlotType.None && isEmpty(itemSlotValue)) || 
        (itemSlotType !== SlotType.None && selectedItem.id === null)) {
        addItemResponse.message="No item found to add to list";
        console.log("ERROR: No slot type or no id");
        return addItemResponse;
    }
    if (itemSlotType === SlotType.Static) {
       addItemResponse = await addGlobalItemToList(String(selectedItem.id),listGroupID,listID,listMode,lists,listGroups,listSpecified,listGroupSpecified,settings);
    } else if (itemSlotType === SlotType.Dynamic) {
        addItemResponse = await addDynamicItemToList(String(selectedItem.id),listGroupID,listID,listMode,lists,listGroups,listSpecified,listGroupSpecified,settings);
    } else if (itemSlotType === SlotType.Alexa) {
        addItemResponse = await addAlexaItemToList(String(selectedItem.id),selectedItem.name,listGroupID,listID,listMode,lists,listGroups,listSpecified,listGroupSpecified,settings, accessToken);
    } else if (itemSlotType === SlotType.None) {
        addItemResponse = await addNoSlotItemToList(itemSlotValue, listGroupID, listID, listMode, lists, listGroups, listSpecified, listGroupSpecified, settings);
    }
    return addItemResponse;
}

async function getItem(itemID: string) : Promise<{exists: boolean, itemDoc:ItemDoc | null}> {
    let itemResponse: {exists: boolean, itemDoc: ItemDoc|null}= {exists: false, itemDoc: null};
    let itemDoc: ItemDoc|null = null;
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

async function updateItemInList(itemDoc: ItemDoc,listMode: string, lists: SimpleLists, listGroups: SimpleListGroups, listID: string|null,
     listGroupID: string | null, listSpecified: boolean, listGroupSpecified: boolean, settings: GlobalSettings) : Promise<HandlerResponse> {
    let updateResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let newItem: ItemDoc = cloneDeep(itemDoc);
    let changed=false;
    newItem.lists.forEach(l => {
        let setActive=true;
        if ((settings.addListOption === AddListOptions.addToAllListsAutomatically || listMode === "G")) {
            setActive = true
        } else if (l.listID !== listID && listMode === "L") {
            setActive = false;
        }
        if (!l.stockedAt) {setActive=false;}
        if (setActive && (!l.active || l.completed)) {
            l.active = true;
            l.boughtCount = l.boughtCount+1;
            l.completed = false;
            changed=true;
        }
    })
    newItem.updatedAt = (new Date()).toISOString();
    try {let dbResp = await todosDBAsAdmin.insert(newItem); updateResponse.success=true;}
    catch(err) {updateResponse.message="Error updating item in the list"; updateResponse.success = false; console.log("ERROR updating item in the list:",err)}
    if (updateResponse.success) {
        if (changed) {
            updateResponse.message="Added "+itemDoc.name+" to the ";
        } else {
            updateResponse.message=itemDoc.name + " was already on the ";
        }
        if (listMode === "L") {
            if (listSpecified) {
                let listName = getListNameForList(String(listID),lists);
                updateResponse.message=updateResponse.message+listName+" list";
                
            } else {
                updateResponse.message=updateResponse.message+ "current list";
            }
        } else { // ListMode = "G"
            if (listGroupSpecified) {
                let listGroupName = getListGroupName(String(listGroupID),listGroups);
                updateResponse.message=updateResponse.message+listGroupName+" list group";
                
            } else {
                updateResponse.message=updateResponse.message+ "current list group";
            }

        }
    }
    return updateResponse;
}

async function getGlobalItem(id: string) : Promise<GlobalItemDoc | null> {
    let globalItem : GlobalItemDoc|null = null;
    try { let gi = await todosDBAsAdmin.get(id) as GlobalItemDoc;
          if (gi !== null && gi !== undefined) {globalItem = gi}}
    catch(err) {console.log("ERROR retrieving global",err);}      
    return globalItem;
}

async function addNewItemToList(item: DefaultItemData,listGroupID: string,listID: string|null,lists: SimpleLists, listGroups: SimpleListGroups,
    listMode: string, listSpecified: boolean,listGroupSpecified: boolean, settings: GlobalSettings) : Promise<HandlerResponse>{
    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let newItem: ItemDoc = cloneDeep(ItemDocInit);
    newItem.name=item.name;
    newItem.pluralName=item.name;
    newItem.globalItemID=item.globalItemID;
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
                active: setActive, 
                completed: false, 
                stockedAt: true,
                boughtCount: 0,
                note: "",
                quantity: 1,
                categoryID: item.categoryID,
                uomName: item.uomName
            }
            newItemLists.push(itemList);
        }
    })
    newItem.lists = newItemLists;
    newItem.updatedAt = (new Date()).toISOString();
    console.log("trying to add to list:",JSON.stringify(newItem,null,4));
    try {let dbResp = await todosDBAsAdmin.insert(newItem); addResponse.success = true; console.log(JSON.stringify(dbResp,null,4));}
    catch(err) {addResponse.message="Error adding item to the list"; addResponse.success = false; console.log("ERROR adding to the list:",err)}
    if (addResponse.success) {
        addResponse.message="Added "+item.name+" to the ";
        if (listMode === "L") {
            if (listSpecified) {
                let listName=getListNameForList(String(listID),lists);
                addResponse.message=addResponse.message+listName+" list";
            } else {
                addResponse.message=addResponse.message+" current list";
            }
        } else { // ListMode = "G" 
            if (listGroupSpecified) {
                let listGroupName=getListGroupName(String(listGroupID), listGroups);
                addResponse.message=addResponse.message+listGroupName+" list group";
            } else {
                addResponse.message=addResponse.message+"current list group";
            }
        }
    }
    return addResponse;
}

async function addGlobalItemToList(itemID: string,listGroupID: string,listID: string | null,listMode: string, 
        lists: SimpleLists, listGroups: SimpleListGroups, listSpecified: boolean, listGroupSpecified: boolean, settings: GlobalSettings) : Promise<HandlerResponse> {
    // check if item exists at all in the selected list group
    // if it exists:
    //      update lists to active based on settings and selected list mode and stocked at
    // if it doesn't exist:
    //      add to list, copying the global item's name, id->globalitemid, category, and UOM
    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let itemResponse = await globalItemInListGroup(itemID,listGroupID);
    if (itemResponse.exists && itemResponse.itemDoc !== null) {
        addResponse= await updateItemInList(itemResponse.itemDoc,listMode,lists,listGroups,listID,listGroupID,listSpecified,listGroupSpecified,settings)
    } else if (!itemResponse.exists || itemResponse.itemDoc === null) {
        let globalItem= await getGlobalItem(itemID)
        if (globalItem !== null) {
            let defaultItem: DefaultItemData = {
                globalItemID: String(globalItem._id),
                name: globalItem.name,
                categoryID: globalItem.defaultCategoryID,
                uomName: globalItem.defaultUOM

            }
            addResponse = await addNewItemToList(defaultItem,listGroupID,listID,lists,listGroups,listMode,listSpecified,listGroupSpecified,settings)
        }    
    }
    return addResponse;
}

async function addDynamicItemToList(itemID: string,listGroupID: string,listID: string | null,listMode: string, lists: SimpleLists,
        listGroups: SimpleListGroups, listSpecified: boolean, listGroupSpecified: boolean, settings: GlobalSettings) : Promise<HandlerResponse> {
    // check if item exists at all in the selected list group
    // if it exists:
    //      update lists to active based on settings and selected list mode and stocked at
    // if it doesn't exist:
    //      add to list, copying the item's name, category, and UOM from the "common key" values of the other list item
    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let itemResponse = await getItem(itemID);
    if (!itemResponse.exists || itemResponse === null) {
        addResponse.message="Unable to find item in list";
        return addResponse;
    }
    if (itemResponse.itemDoc!.listGroupID === listGroupID) {
        addResponse= await updateItemInList(itemResponse.itemDoc!,listMode,lists,listGroups,listID,listGroupID,listSpecified,listGroupSpecified,settings)
    } else {
        let defaultItem: DefaultItemData = {
            globalItemID: null,
            name: itemResponse.itemDoc!.name,
            categoryID: getCommonKey(itemResponse.itemDoc!,"categoryID"),
            uomName: getCommonKey(itemResponse.itemDoc!,"uomName")
        };
         cloneDeep(InitGlobalItem);
        addResponse = await addNewItemToList(defaultItem,listGroupID,listID,lists,listGroups,listMode,listSpecified,listGroupSpecified,settings)
    }    
    return addResponse;
}

async function addAlexaItemToList(itemID: string,itemName: string,listGroupID: string,listID: string | null,listMode: string, lists: SimpleLists,
    listGroups: SimpleListGroups, listSpecified: boolean, listGroupSpecified: boolean, settings: GlobalSettings, accessToken: string) : Promise<HandlerResponse> {
    // if we have an Alexa item, that means no global item or dynamic item existed.
    // should go ahead and add as new
    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
//    let dataResponse = await getEntityInfo(itemID,accessToken);
    //TODO -- check if in global items or dynamic anyway??
    let alreadyExists= await checkItemByNameOnList(itemName,String(listID),listGroupID,listMode);
    if (alreadyExists) {
        addResponse.message="Item already exists on list";
        return addResponse;
    }
    let defaultItem: DefaultItemData = {
        globalItemID: null,
        name: itemName,
        categoryID: null,
        uomName: null
    }
    addResponse = await addNewItemToList(defaultItem,listGroupID,listID,lists,listGroups,listMode,listSpecified,listGroupSpecified,settings)
    return addResponse;
}

async function addNoSlotItemToList(itemSlotValue: string, listGroupID: string, listID: string, listMode: string,
    lists: SimpleLists, listGroups: SimpleListGroups, listSpecified: boolean, listGroupSpecified: boolean, settings: GlobalSettings) : Promise<HandlerResponse> {

    let addResponse: HandlerResponse = cloneDeep(HandlerResponseInit);
    let alreadyExists = await checkItemByNameOnList(itemSlotValue, String(listID), listGroupID, listMode)
    if (alreadyExists) {
        addResponse.message="Item already exists on list";
        return addResponse
    }
    let defaultItem: DefaultItemData = {
        globalItemID: null,
        name: itemSlotValue,
        categoryID: null,
        uomName: null
    }
    addResponse = await addNewItemToList(defaultItem,listGroupID,listID,lists,listGroups,listMode,listSpecified,listGroupSpecified,settings)
    return addResponse;

    }