import { useCallback, useState, useEffect, useContext } from 'react'
import { usePouch, useFind } from 'use-pouchdb'
import { cloneDeep } from 'lodash';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { GlobalStateContext } from '../components/GlobalState';
import { FriendStatus, FriendRow, ResolvedFriendStatus, PouchResponse } from './DataTypes';


export function useUpdateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
          let response: PouchResponse ={
            pouchData: {},
            successful: true,
            errorCode: 0,
            errorText: "",
            fullError: undefined
          }
          try { response.pouchData = await db.put(updatedDoc); console.log(response.pouchData);}
          catch(err) { response.successful = false; response.fullError = err;}
          if (!response.pouchData.ok) { response.successful = false;}
          console.log(response);
      return response
    },[db])
}

export function useCreateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
          let response: PouchResponse ={
            pouchData: {},
            successful: true,
            errorCode: 0,
            errorText: "",
            fullError: undefined
          }
          try { response.pouchData = await db.post(updatedDoc); console.log(response.pouchData);}
          catch(err) { response.successful = false; response.fullError = err;}
          if (!response.pouchData.ok) { response.successful = false;}
          console.log(response);
      return response
    },[db])
}

export function useUpdateItem() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useUpdateCompleted() {
  const db = usePouch();

  return useCallback(
    async (updateInfo: any) => {
      const newItemDoc = cloneDeep(updateInfo.itemDoc);
      for (let i = 0; i < newItemDoc.lists.length; i++) {
        if (updateInfo.updateAll) {
          newItemDoc.lists[i].completed = updateInfo.newStatus;
          if (updateInfo.newStatus) {newItemDoc.lists[i].boughtCount++};
        } else {
          if (newItemDoc.lists[i].listID === updateInfo.listID) {
            newItemDoc.lists[i].completed = updateInfo.newStatus;
            if (updateInfo.newStatus) {newItemDoc.lists[i].boughtCount++};
          }
        }   
      }
      const result = await db.put(newItemDoc);
      return result
    },
    [db]
  )
}

export function useUpdateItemInList() {
  const db = usePouch()

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useFriends(username: string) : {friendsLoading: boolean, friendRowsLoading: boolean, friendRows: FriendRow[]} {
  const [friendRows,setFriendRows] = useState<FriendRow[]>([]);
  const { globalState} = useContext(GlobalStateContext);

  const { docs: friendDocs, loading: friendsLoading, error: friendsError } = useFind({
    index: { fields: ["type","friendID1","friendID2"]},
    selector: { "$and": [ {
        "type": "friend",
        "friendID1": { "$exists": true },
        "friendID2": { "$exists" : true} }, 
        { "$or" : [{"friendID1": username},{"friendID2": username}]}
    ]  
    },
    sort: [ "type", "friendID1", "friendID2" ],
//    fields: [ "type", "friendID1", "friendID2", "friendStatus"]
    })

  let friendRowsLoading = false;

    useEffect( () => {
      console.log("UseEffect in usefriend executing:",{friendsLoading,friendRowsLoading,friendDocs})
      if (friendsLoading || friendRowsLoading) { return };
      let response: HttpResponse | undefined;

      let userIDList : { userIDs: string[]} = { userIDs: []};
      friendDocs.forEach((element: any) => {
        if (element.friendStatus !== FriendStatus.Deleted) {
          console.log({userIDList,element});
          if(username == element.friendID1) {userIDList.userIDs.push(element.friendID2)}
          else {userIDList.userIDs.push(element.friendID1)}
        }
      });
      console.log("built the userID list:",{userIDList});
      const getUsers = async () => {
        console.log("inside getUsers");
        const options = {
          url: String(globalState.dbCreds?.apiServerURL+"/getusersinfo"),
          data: userIDList,
          method: "POST",
          headers: { 'Content-Type': 'application/json',
                     'Accept': 'application/json' }
        };
        console.log("about to execute httpget with options: ", {options})
        response = await CapacitorHttp.post(options);
        console.log("got httpget response: ",{response});
        console.log("clearing friend rows");
        setFriendRows(prevState => ([]));
        if (response && response.data) {
          friendDocs.forEach((friendDoc: any) => {
            console.log({friendDoc});
            let friendRow : any = {};
            friendRow.friendDoc=cloneDeep(friendDoc);
            if (friendRow.friendDoc.friendID1 == globalState.dbCreds?.dbUsername)
              { friendRow.targetUserName = friendRow.friendDoc.friendID2}
            else { friendRow.targetUserName = friendRow.friendDoc.friendID1}
            console.log(friendRow.targetUserName);
            let user=response?.data?.users?.find((el: any) => el?.name == friendRow.targetUserName)
            if (user == undefined) {user = {email:"",fullname:""}};
            if (friendDoc.friendStatus == FriendStatus.WaitingToRegister) {
              friendRow.targetEmail = friendDoc.inviteEmail
            } else {
              friendRow.targetEmail = user.email;
            }
            friendRow.targetFullName = user.fullname;
            if (friendDoc.friendStatus == FriendStatus.PendingFrom1 || friendDoc.friendStatus == FriendStatus.PendingFrom2) {
              if ((globalState.dbCreds?.dbUsername == friendDoc.friendID1 && friendDoc.friendStatus == FriendStatus.PendingFrom2) || 
                  (globalState.dbCreds?.dbUsername == friendDoc.friendID2 && friendDoc.friendStatus == FriendStatus.PendingFrom1))
              {
                friendRow.friendStatusText = "Confirm?"
                friendRow.resolvedStatus = ResolvedFriendStatus.PendingConfirmation;
              } else {
                friendRow.friendStatusText = "Requested";
                friendRow.resolvedStatus = ResolvedFriendStatus.Requested;
              }
            } else if (friendDoc.friendStatus == FriendStatus.Confirmed) {
              friendRow.friendStatusText = "Confirmed";
              friendRow.resolvedStatus = ResolvedFriendStatus.Confirmed;
            } else if (friendDoc.friendStatus == FriendStatus.WaitingToRegister) {
              friendRow.friendStatusText = "Needs to Register";
              friendRow.resolvedStatus = ResolvedFriendStatus.WaitingToRegister
            }
            console.log("adding friend row to array",{friendRow});
            setFriendRows(prevArray => [...prevArray, friendRow])
          })
          
        }
        console.log("exiting getUsers");
      }
      console.log("anything else happen?");
      if ( !friendsLoading && !friendRowsLoading)  {
        console.log("got a change in usehook");
        console.log("set friends loading to true");
        friendRowsLoading = true;
        console.log("called getusers");
        getUsers();
        console.log("setting friendsrowloading to false");
        friendRowsLoading = false;
      }
    },[friendsLoading,friendDocs]);

    if (friendsLoading || friendRowsLoading) { return({friendsLoading: true,friendRowsLoading: true,friendRows: []})}
    return({friendsLoading, friendRowsLoading,friendRows});

}
