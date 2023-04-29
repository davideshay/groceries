import { ListDoc, ListDocs, ListGroupDoc, ListGroupDocs, UserDoc } from "./DBSchema";
import { todosDBAsAdmin, usersDBAsAdmin } from "./dbstartup";
import { DocumentScope, MangoResponse } from "nano";
import axios, {AxiosResponse} from 'axios';
import { cloneDeep, isEmpty } from 'lodash';
import { Directive, SimpleSlotValue, Slot, er } from "ask-sdk-model";
import { SlotInfo , CouchUserInfo, CouchUserInit, SimpleListGroups, SimpleListGroup, SimpleLists, SimpleList} from "./datatypes";

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
    if (response.success && userResponseDocs !== undefined && userResponseDocs !== null) {
        response.userName = userResponseDocs.docs[0].name
    } else {response.success = false}
    return response;
}

export function getDynamicIntentDirective(listGroups: SimpleListGroups, lists: SimpleLists) : Directive {
    let directive: Directive;
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
                }
             ] 
        
    }

    console.log("directive:",JSON.stringify(directive,null,4))

    return directive;
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
    slot.resolutions?.resolutionsPerAuthority?.every(auth => {
        if (auth.status.code === "ER_SUCCESS_MATCH") {
            slotInfo.id = auth.values[0].value.id;
            slotInfo.name = auth.values[0].value.name;
            return false;
        } else { return true;}
    })
    return slotInfo;
}