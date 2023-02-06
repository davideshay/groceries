import { RemoteDBState } from "./RemoteDBState";
import { CapacitorHttp, HttpResponse } from '@capacitor/core';

export async function navigateToFirstListID(db: any,phistory: any,remoteDBState: RemoteDBState) {
    let listResults = await db.find({
        selector: { "$and": [ 
          {  "type": "list",
              "name": { "$exists": true } },
          { "$or" : [{"listOwner": remoteDBState.dbCreds.dbUsername},
                      {"sharedWith": { $elemMatch: {$eq: remoteDBState.dbCreds.dbUsername}}}]
          }] },
        sort: [ "type","name"]})
    let firstListID = null;
    if (listResults.docs.length > 0) {
      firstListID = listResults.docs[0]._id;
    }
    if (firstListID == null) {
        phistory.push("/lists");
    } else {
        phistory.push("/items/"+firstListID)
    }  
  }

export async function createNewUser(remoteDBState: RemoteDBState,password: string) {
    let response: HttpResponse | undefined;
    const options = {
        url: String(remoteDBState.dbCreds.apiServerURL+"/registernewuser"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteDBState.dbCreds.JWT },
        data: {
            username: remoteDBState.dbCreds.dbUsername,
            password: password,
            email: remoteDBState.dbCreds.email,
            fullname: remoteDBState.dbCreds.fullName
        }           
    };
    console.log("about to execute createnewuser httpget with options: ", {options})
    response = await CapacitorHttp.post(options);
    console.log("got httpget response: ",{response});
    return response;
}