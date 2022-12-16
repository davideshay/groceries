import { useCallback, useState, useEffect, useContext } from 'react'
import { usePouch, useFind } from 'use-pouchdb'
import { cloneDeep } from 'lodash';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { GlobalStateContext } from '../components/GlobalState';
import { FriendStatus, FriendRow, ResolvedFriendStatus } from './DataTypes';


export function useUpdateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },[db])
}

export function useCreateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.post(updatedDoc)
      return result
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

export function useUpdateCategory() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useUpdateListWhole() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.put(updatedDoc)
      return result
    },
    [db]
  )
}

export function useCreateList() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.post(updatedDoc)
      return result
    },
    [db]
  )
}

export function useCreateCategory() {
  const db = usePouch();

  return useCallback(
    async (updatedDoc: any) => {
      const result = await db.post(updatedDoc)
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

export function useFriends(username: string) {
  const [friendRows,setFriendRows] = useState<FriendRow[]>([]);
  const [usersLoading, setUsersLoading ] = useState(false);
  const { globalState, setGlobalState, setStateInfo} = useContext(GlobalStateContext);

  const { docs: friendDocs, loading: friendLoading, error: friendError } = useFind({
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

    useEffect( () => {
      console.log("UseEffect in usefriend executing:",{friendLoading,usersLoading,friendDocs})
      if (friendLoading || usersLoading) { return };
      setUsersLoading(true);
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
            friendRow.friendRelID = friendDoc._id;
            friendRow.friendRev = friendDoc._rev;
            friendRow.friendID1 = friendDoc.friendID1;
            friendRow.friendID2 = friendDoc.friendID2;
            if (friendRow.friendID1 == globalState.dbCreds?.dbUsername)
              { friendRow.targetUserName = friendRow.friendID2}
            else { friendRow.targetUserName = friendRow.friendID1}
            console.log(friendRow.targetUserName);
            const user=response?.data.users.find((el: any) => el.name == friendRow.targetUserName)
            console.log({user});
            if (friendDoc.friendStatus == FriendStatus.WaitingToRegister) {
              friendRow.targetEmail = friendDoc.inviteEmail
            } else {
              friendRow.targetEmail = user.email;
            }
            friendRow.targetFullName = user.fullname;
            friendRow.friendStatusCode = friendDoc.friendStatus;
            if (friendRow.friendStatusCode == FriendStatus.PendingFrom1 || friendRow.friendStatusCode == FriendStatus.PendingFrom2) {
              if ((globalState.dbCreds?.dbUsername == friendRow.friendID1 && friendRow.friendStatusCode == FriendStatus.PendingFrom2) || 
                  (globalState.dbCreds?.dbUsername == friendRow.friendID2 && friendRow.friendStatusCode == FriendStatus.PendingFrom1))
              {
                friendRow.friendStatusText = "Confirm?"
                friendRow.resolvedStatus = ResolvedFriendStatus.PendingConfirmation;
              } else {
                friendRow.friendStatusText = "Requested";
                friendRow.resolvedStatus = ResolvedFriendStatus.Requested;
              }
            } else if (friendRow.friendStatusCode == FriendStatus.Confirmed) {
              friendRow.friendStatusText = "Confirmed";
              friendRow.resolvedStatus = ResolvedFriendStatus.Confirmed;
            } else if (friendRow.friendStatusCode == FriendStatus.WaitingToRegister) {
              friendRow.friendStatusText = "Needs to Register";
              friendRow.resolvedStatus = ResolvedFriendStatus.WaitingToRegister
            }
            console.log("adding friend row to array",{friendRow});
            setFriendRows(prevArray => [...prevArray, friendRow])
          })
          
        }
      }
      console.log("anything else happen?");
      if ( !friendLoading)  {
        console.log("got a change in usehook");
        getUsers();
        setUsersLoading(false);
      }
    },[friendLoading,friendDocs, usersLoading]);

    if (friendLoading || usersLoading) { return([])}
    return(friendRows);

}
