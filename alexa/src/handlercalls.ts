import { ListDoc, ListGroupDoc, UserDoc } from "./DBSchema";
import { todosDBAsAdmin, usersDBAsAdmin } from "./dbstartup";
import { DocumentScope, MangoResponse } from "nano";
import axios, {AxiosResponse} from 'axios';
import { cloneDeep } from 'lodash';
import { Directive } from "ask-sdk-model";

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

export type CouchUserInfo = {
    success: boolean
    userName: string
}

export const CouchUserInit = {
    success: false,
    userName: ""
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

export async function getDynamicIntentDirective(username: string) : Promise<Directive> {
    let directive: Directive;
    directive = {
        
            type: "Dialog.UpdateDynamicEntities",
             updateBehavior: "REPLACE",
             types:[
                { 
                "name": "listgroup",
                "values": [
                    { id: 'sys:list:acme', name: { value: "Acme"}},
                    { id: 'sys:list:gianteagle', name: { value: "Giant Eagle"}},
                    { id: 'sys:list:sams', name: { value: "Sam's Club"}},
                ]
                }
             ] 
        
    }

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
                return "Database Error Encountered"};
    let listGroupStrings: string[] = [];            
    foundListGroupDocs.docs.forEach(lg => {
        listGroupStrings.push(lg.name);
    });

    console.log("LGS: ListGroupStrings",listGroupStrings);            
    let results =  addCommasAndAnd(listGroupStrings);
    console.log(results);
    return results;
}

export async function getLists(username: string) {
    const lgq = {
        selector: { type: "listgroup", 
            "$or": [{"listGroupOwner": username}, {"sharedWith": {$elemMatch: {"$eq": username}} }]},
        limit: await totalDocCount(todosDBAsAdmin)
    }

    let foundListGroupDocs: MangoResponse<ListGroupDoc> | null = null;
    try {foundListGroupDocs =  (await todosDBAsAdmin.find(lgq) as MangoResponse<ListGroupDoc>);}
    catch(err) {console.log("ERROR: Could not find listgroup documents:",err);
                return "Database Error Encountered"};
    let listGroupStrings: string[] = []; 
    let listGroupIDs: string[] = [];           
    foundListGroupDocs.docs.forEach(lg => {
        listGroupStrings.push(lg.name);
        listGroupIDs.push(lg._id);
    });
    console.log("looking at listgroups:",listGroupStrings);
    const lq = {
        selector: { type: "list",
                    listGroupID: {"$in": listGroupIDs}},
        limit: await totalDocCount(todosDBAsAdmin)
    }

    let foundListDocs: MangoResponse<ListDoc> | null = null;
    try {foundListDocs = (await todosDBAsAdmin.find(lq) as MangoResponse<ListDoc>);}
    catch(err) {console.log("ERROR: Could not find list documents",err);
                return "Database Error Encountered"};
    let lists: string[] = [];
    foundListDocs.docs.forEach(l => {
        lists.push(l.name);
    });
    console.log("lists:",lists)
    let results = addCommasAndAnd(lists);
    return results;

}