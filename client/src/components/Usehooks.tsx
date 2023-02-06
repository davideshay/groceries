import { useCallback, useState, useEffect, useContext } from 'react'
import { usePouch, useFind } from 'use-pouchdb'
import { cloneDeep, isEqual, union, pull } from 'lodash';
import { HttpResponse } from '@capacitor/core';
import { RemoteDBStateContext } from './RemoteDBState';
import { FriendStatus, FriendRow, ResolvedFriendStatus, ListRow, PouchResponse, PouchResponseInit, initUserInfo } from './DataTypes';
import { GlobalStateContext } from './GlobalState';
import { getUsersInfo, urlPatternValidation } from './Utilities';


export function useUpdateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
          let curDateStr=(new Date()).toISOString()
          updatedDoc.updatedAt = curDateStr;
          let response: PouchResponse = cloneDeep(PouchResponseInit);
          try { response.pouchData = await db.put(updatedDoc); }
          catch(err) { response.successful = false; response.fullError = err;}
          if (!response.pouchData.ok) { response.successful = false;}
      return response
    },[db])
}

export function useCreateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
          let curDateStr=(new Date()).toISOString()
          updatedDoc.updatedAt = curDateStr;
          let response: PouchResponse = cloneDeep(PouchResponseInit);
          try { response.pouchData = await db.post(updatedDoc);}
          catch(err) { response.successful = false; response.fullError = err;}
          if (!response.pouchData.ok) { response.successful = false;}
      return response
    },[db])
}

export function useDeleteGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
          let response: PouchResponse = cloneDeep(PouchResponseInit);
          try { response.pouchData = await db.remove(updatedDoc);}
          catch(err) { response.successful = false; response.fullError = err;}
          if (!response.pouchData.ok) { response.successful = false;}
      return response
    },[db])
}

export function useUpdateCompleted() {
  const db = usePouch();

  return useCallback(
    async (updateInfo: any) => {
      let response: PouchResponse = cloneDeep(PouchResponseInit);
      const newItemDoc = cloneDeep(updateInfo.itemDoc);
      let baseList=updateInfo.listRows.find((el: ListRow) => (updateInfo.listID === el.listDoc._id));
      let baseParticipants = baseList.participants;
      for (let i = 0; i < newItemDoc.lists.length; i++) {
        let listIdx=updateInfo.listRows.findIndex((el: ListRow) => (el.listDoc._id === newItemDoc.lists[i].listID));
        if (listIdx !== -1) {
          let changeThisItem=false;
          // for checking the item complete, use this logic
          if (updateInfo.newStatus) {
            if (((newItemDoc.lists[i].listID === updateInfo.listID) || updateInfo.removeAll) && 
            (isEqual(baseParticipants,updateInfo.listRows[listIdx].participants))) {
              changeThisItem=true;
            }
          } else {
          // for unchecking the item complete, use this logic
          if (((newItemDoc.lists[i].listID === updateInfo.listID) || 
              (updateInfo.removeAll && newItemDoc.lists[i].active && newItemDoc.lists[i].completed)) && 
              (isEqual(baseParticipants,updateInfo.listRows[listIdx].participants))) {
                changeThisItem=true;
              }
          }
          if (changeThisItem) {
            newItemDoc.lists[i].completed = updateInfo.newStatus;
            if (newItemDoc.lists[i].listID === updateInfo.listID) {
              newItemDoc.lists[i].boughtCount++
            }
          }
        }  
      }
      let curDateStr=(new Date()).toISOString()
      newItemDoc.updatedAt = curDateStr;
      try { response.pouchData = await db.put(newItemDoc)}
      catch(err) { response.successful = false; response.fullError = err;}
      if (!response.pouchData.ok) { response.successful = false};
      return response;
    },
    [db])
}

export function useDeleteListFromItems() {
  const db=usePouch()

  return useCallback(
    async (listID: string) => {
      let response: PouchResponse = cloneDeep(PouchResponseInit);
      let itemResults = await db.find({
        selector: {
          type: "item",
          name: { $exists: true },
          lists: { $elemMatch: { "listID": listID } }
        }
      })
      for (let i = 0; i < itemResults.docs.length; i++) {
        const itemDoc: any = itemResults.docs[i];
        const newLists = []
        for (let j = 0; j < itemDoc.lists.length; j++) {
          if (itemDoc.lists[j].listID !== listID) {
            newLists.push(itemDoc.lists[j])
          }
        }
        itemDoc.lists = newLists;
        let updResults ;
        try {updResults = db.put(itemDoc)}
        catch(err) {response.successful = false; response.fullError = err; }
      }
    
      return response;
    
    },[db]) 
}

export function useDeleteCategoryFromItems() {
  const db=usePouch()
  return useCallback(
    async (catID: string) => {
      let response: PouchResponse = cloneDeep(PouchResponseInit);
      let itemResults;
      try {
          itemResults = await db.find({
          selector: {
            type: "item",
            name: { $exists: true },
            categoryID: catID
          }
          })
      } catch(err) {response.successful=false; response.fullError="Could not find items"; return response}
      if (itemResults != undefined && itemResults.hasOwnProperty('docs')) {
        for (let i = 0; i < itemResults.docs.length; i++) {
          const itemDoc: any = cloneDeep(itemResults.docs[i]);
          itemDoc.categoryID = null;
          let updResults ;
          try {updResults = db.put(itemDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }  
      }
      return response;
    },[db]) 
}

export function useDeleteCategoryFromLists() {
  const db=usePouch()
  return useCallback(
    async (catID: string) => {
      let response: PouchResponse = cloneDeep(PouchResponseInit);
      let listResults;
      try {
          listResults = await db.find({
          selector: {
            type: "list",
            name: { $exists: true },
            categories: { $elemMatch : { $eq: catID} }
          }
          })
      } catch(err) {response.successful=false; response.fullError="Could not find items"; return response}
      if (listResults != undefined && listResults.hasOwnProperty('docs')) {
        for (let i = 0; i < listResults.docs.length; i++) {
          const listDoc: any = cloneDeep(listResults.docs[i]);
          let newCats = cloneDeep(listDoc.categories);
          pull(newCats,catID);
          listDoc.categories = newCats;
          let updResults ;
          try {updResults = db.put(listDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }  
      }
      return response;
    },[db]) 
}

export function useLists(username: string) : {listsLoading: boolean, listDocs: any, listRowsLoading: boolean, listRowsLoaded: boolean, listRows: ListRow[]} {
  const [listRows,setListRows] = useState<ListRow[]>([]);
  const [listRowsLoaded, setListRowsLoaded] = useState(false);
  const [listRowsLoading, setListRowsLoading] = useState(false);
  const { docs: listDocs, loading: listsLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { "$and": [ 
      {  "type": "list",
         "name": { "$exists": true } },
      { "$or" : [{"listOwner": username},
                 {"sharedWith": { $elemMatch: {$eq: username}}}]
      }             
    ] },
    sort: [ "type","name"]
  });

  function buildListRows() {
    setListRows(prevState => ([]));
    listDocs.forEach((list: any) => {
      let part = union([list.listOwner],list.sharedWith).sort();
      let listRow: ListRow ={
        listDoc: list,
        participants: part
      }
      setListRows(prevArray => ([...prevArray,listRow]));
    });
  }

  useEffect( () => {
    if (listsLoading ) { setListRowsLoaded(false); return };
    if ( !listsLoading && !listRowsLoaded)  {
      setListRowsLoading(true);
      setListRowsLoaded(false);
      buildListRows();
      setListRowsLoading(false)
      setListRowsLoaded(true);
    }

  },[listsLoading,listRowsLoading,listDocs])
  return ({listsLoading, listDocs, listRowsLoading, listRowsLoaded, listRows});
}

export function useFriends(username: string) : {friendsLoading: boolean, friendRowsLoading: boolean, friendRows: FriendRow[]} {
  const [friendRows,setFriendRows] = useState<FriendRow[]>([]);
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const [friendRowsLoading,setFriendRowsLoading] = useState(false);

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

    useEffect( () => {
      if (friendsLoading || friendRowsLoading) { return };
      let response: HttpResponse | undefined;

      let userIDList : { userIDs: string[]} = { userIDs: []};
      friendDocs.forEach((element: any) => {
        if (element.friendStatus !== FriendStatus.Deleted) {
          if(username == element.friendID1) {userIDList.userIDs.push(element.friendID2)}
          else {userIDList.userIDs.push(element.friendID1)}
        }
      });
      const getUsers = async () => {
        const usersInfo = await getUsersInfo(userIDList,String(remoteDBState.dbCreds.apiServerURL));
        setFriendRows(prevState => ([]));
        if (usersInfo.length > 0) {
          friendDocs.forEach((friendDoc: any) => {
            let friendRow : any = {};
            friendRow.friendDoc=cloneDeep(friendDoc);
            if (friendRow.friendDoc.friendID1 == remoteDBState.dbCreds.dbUsername)
              { friendRow.targetUserName = friendRow.friendDoc.friendID2}
            else { friendRow.targetUserName = friendRow.friendDoc.friendID1}
            let user=usersInfo.find((el: any) => el?.name == friendRow.targetUserName)
            if (user == undefined) {user = cloneDeep(initUserInfo)};
            if (friendDoc.friendStatus == FriendStatus.WaitingToRegister) {
              friendRow.targetEmail = friendDoc.inviteEmail
            } else {
              friendRow.targetEmail = user?.email;
            }
            friendRow.targetFullName = user?.fullname;
            if (friendDoc.friendStatus == FriendStatus.PendingFrom1 || friendDoc.friendStatus == FriendStatus.PendingFrom2) {
              if ((remoteDBState.dbCreds.dbUsername == friendDoc.friendID1 && friendDoc.friendStatus == FriendStatus.PendingFrom2) || 
                  (remoteDBState.dbCreds.dbUsername == friendDoc.friendID2 && friendDoc.friendStatus == FriendStatus.PendingFrom1))
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
            setFriendRows(prevArray => [...prevArray, friendRow])
          })
        }
      }

      if ( !friendsLoading && !friendRowsLoading)  {
        setFriendRowsLoading(true);
        getUsers();
        setFriendRowsLoading(false);
      }
    },[friendsLoading,friendRowsLoading,friendDocs]);

    if (friendsLoading || friendRowsLoading) { return({friendsLoading: true,friendRowsLoading: true,friendRows: []})}
    return({friendsLoading, friendRowsLoading,friendRows});

}

export function useConflicts() : { conflictDocs: any[], conflictsLoading: boolean} {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const { globalState } = useContext(GlobalStateContext);
  const [mostRecentDate,setMostRecentDate] = useState<Date>(new Date());

  const { docs: conflictDocs, loading: conflictsLoading, error } = useFind({
    index: { fields: ["type","docType","updatedAt"]},
    selector: { type: "conflictlog", docType: { $exists: true }, updatedAt: { $gt: mostRecentDate.toISOString()} },
    sort: [ "type", "docType","updatedAt" ]
  })

  useEffect( () => {
    const oneDayOldDate=new Date();
    oneDayOldDate.setDate(oneDayOldDate.getDate()-Number(globalState.settings.daysOfConflictLog));
    const lastConflictsViewed = new Date(String(remoteDBState.dbCreds.lastConflictsViewed))
    setMostRecentDate((lastConflictsViewed > oneDayOldDate) ? lastConflictsViewed : oneDayOldDate);  
  },[remoteDBState.dbCreds.lastConflictsViewed])

  return({conflictDocs, conflictsLoading});
}