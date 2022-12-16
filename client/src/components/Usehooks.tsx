import { useCallback, useState, useEffect, useContext } from 'react'
import { usePouch, useFind } from 'use-pouchdb'
import { cloneDeep } from 'lodash';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { GlobalStateContext } from '../components/GlobalState';
import { FriendStatus, FriendRow } from './DataTypes';


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
  const [usersNeedLoading, setUsersNeedLoading ] = useState(true);
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
      console.log({friendLoading,usersNeedLoading,friendDocs})
      if (friendLoading || !usersNeedLoading ) { return };
      let response: HttpResponse | undefined;

      let userIDList : { userIDs: string[]} = { userIDs: []};
      friendDocs.forEach((element: any) => {
        if (element.friendStatus !== FriendStatus.Deleted) {
          console.log({userIDList,element});
          if(username == element.friendID1) {userIDList.userIDs.push(element.friendID2)}
          else {userIDList.userIDs.push(element.friendID1)}
        }
      });
      const getUsers = async () => {
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
        if (response && response.data) {
          friendDocs.forEach((friendDoc: any) => {
            console.log({friendDoc});
            let friendRow : any = {};
            friendRow.friendRelID = friendDoc._id;
            friendRow.friendID1 = friendDoc.friendID1;
            friendRow.friendID2 = friendDoc.friendID2;
            if (friendRow.friendID1 == globalState.dbCreds?.dbUsername)
              { friendRow.targetUserName = friendRow.friendID2}
            else { friendRow.targetUserName = friendRow.friendID1}  
            friendRow.targetEmail = friendDoc.inviteEmail;
            const user=response?.data.users.find((el: any) => el.name == friendRow.targetUserName)
            console.log({user});
            friendRow.targetEmail = user.email;
            friendRow.targetFullName = user.fullname;
            friendRow.friendStatusCode = friendDoc.friendStatus;
            friendRow.friendStatusText = "STATUS TEXT";
            setFriendRows(prevArray => [...prevArray, friendRow])
          })
          
        }
      }
      if (usersNeedLoading && !friendLoading)  {
        getUsers();
        setUsersNeedLoading(false);
      }
    },[friendLoading, usersNeedLoading]);

    return(friendRows);

}
