import { useCallback, useState, useEffect, useContext, useRef } from 'react'
import { usePouch, useFind } from 'use-pouchdb'
import { cloneDeep, isEqual, union, pull } from 'lodash';
import { RemoteDBStateContext, SyncStatus } from './RemoteDBState';
import { FriendStatus, FriendRow, ResolvedFriendStatus, ListRow, PouchResponse, PouchResponseInit, initUserInfo, ListCombinedRow, RowType, ListGroupDoc, ListDoc, ListDocs, ListGroupDocs, ListDocInit } from './DataTypes';
import { GlobalStateContext } from './GlobalState';
import { getUsersInfo } from './Utilities';
import ListGroup from '../pages/ListGroup';

export function useGetOneDoc(docID: string) {
  const db = usePouch();
  const changesRef = useRef<any>();
  const [doc,setDoc] = useState<any>(null);
  const loadingRef = useRef(true);

  async function getDoc(id: string) {
      loadingRef.current = true;
      changesRef.current = db.changes({since: 'now', live: true, include_docs: true, doc_ids: [id]})
      .on('change', function(change) { setDoc(change.doc); })
      let success=true; 
      let docRet = null;
      try  {docRet = await db.get(id);}
      catch(err) {success=false;}
      loadingRef.current = false;
      if (success) {setDoc(docRet)};
    }
    
  useEffect( () => {
      getDoc(docID)
      return ( () => { if (changesRef.current) {changesRef.current.cancel()};})  
  },[docID])  

  return {loading: loadingRef.current, doc};
}

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

/* export function useUpdateCompleted() {
  const db = usePouch();

  return useCallback(
    async (updateInfo: any) => {
      let response: PouchResponse = cloneDeep(PouchResponseInit);
      const newItemDoc = cloneDeep(updateInfo.itemDoc);
      let baseList=updateInfo.listRows.find((el: ListRow) => (updateInfo.listID === el.listDoc._id));
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
 */


export function useDeleteItemsInListGroup() {
  const db=usePouch()

  return useCallback(
    async (listGroupID: string) => {
      let response: PouchResponse = cloneDeep(PouchResponseInit);
      let itemResults = await db.find({
        selector: {
          type: "item",
          name: { $exists: true },
          listGroupID: listGroupID}
      })
      for (let i = 0; i < itemResults.docs.length; i++) {
        const itemDoc: any = itemResults.docs[i];
        try {db.remove(itemDoc)}
        catch(err) { response.successful= false; response.fullError = err; }
        }
      return response;
    },[db]) 
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
        try {db.put(itemDoc)}
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

export function useLists() : {listsLoading: boolean, listDocs: any, listRowsLoading: boolean, listRowsLoaded: boolean, listRows: ListRow[], listCombinedRows: ListCombinedRow[]} {
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [listRows,setListRows] = useState<ListRow[]>([]);
  const [listCombinedRows,setListCombinedRows] = useState<ListCombinedRow[]>([]);
  const [listRowsLoaded, setListRowsLoaded] = useState(false);
  const [listRowsLoading, setListRowsLoading] = useState(false);
  const { docs: listGroupDocs, loading: listGroupsLoading } = useFind({
    index: { fields: ["type","name"]},
    selector: { "$and": [
      { "type": "listgroup", "name": { "$exists": true}},
      { "$or": [{"listGroupOwner": remoteDBCreds.dbUsername},
                {"sharedWith": { $elemMatch: {$eq: remoteDBCreds.dbUsername}}}]}  ]},
    sort: [ "type", "name"]  });
  const { docs: listDocs, loading: listsLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { "$and": [ 
      {  "type": "list",
         "name": { "$exists": true } }
    ] },
    sort: [ "type","name"] });

  function buildListRows() {
//    console.log("building list Rows from: ", cloneDeep(listGroupDocs), cloneDeep(listDocs));
    let curListDocs: ListDocs = cloneDeep(listDocs);
    let newListRows: ListRow[] = [];
    curListDocs.forEach((listDoc: ListDoc) => {
//      console.log("analyzing list doc: ", cloneDeep(listDoc));
      let listGroupID=null;
      let listGroupName="";
//      let listGroupIncludesUser=false;
      let listGroupDefault=false;
      for (let i = 0; i < listGroupDocs.length; i++) {
        const lgd = (listGroupDocs[i] as ListGroupDoc);
        if ( listDoc.listGroupID == lgd._id ) {
          listGroupID=lgd._id
          listGroupName=lgd.name
          listGroupDefault=lgd.default;
        }
//        console.log("checking ",listDoc.name, " against listgroup: ",lgd.name, " with user:",username);
//        console.log("owner match: ",lgd.listGroupOwner == username)
//        if ( (lgd.listGroupOwner == username) || lgd.sharedWith.includes(username)) {
//          listGroupIncludesUser=true;
 //       }
      }
      if (listGroupID == null) { return };
//      if (listDoc.listOwner !== username && !listGroupIncludesUser ) { return };
//      if (listGroupID == null) {listGroupName="Ungrouped (ERROR)"};
      let listRow: ListRow ={
        listGroupID: listGroupID,
        listGroupName: listGroupName,
        listGroupDefault: listGroupDefault,
        listDoc: listDoc,
      }
      newListRows.push(listRow);
    });

    newListRows.sort(function (a: ListRow, b: ListRow) {
      return a.listDoc.name.toUpperCase().localeCompare(b.listDoc.name.toUpperCase());
    })

//    console.log("new list rows is: ", cloneDeep(newListRows));
    setListRows(newListRows);
    const sortedListGroups: ListGroupDocs = cloneDeep(listGroupDocs);
    sortedListGroups.sort(function (a: ListGroupDoc, b: ListGroupDoc) {
      return a.name.toUpperCase().localeCompare(b.name.toUpperCase());
    });

    let newCombinedRows: ListCombinedRow[] = [];
    sortedListGroups.forEach((listGroup: ListGroupDoc) => {
      let groupRow: ListCombinedRow = {
          rowType : RowType.listGroup,
          rowName : listGroup.name,
          rowKey: "G-"+listGroup._id,
          listOrGroupID: String(listGroup._id),
          listGroupID : listGroup._id,
          listGroupName : listGroup.name,
          listGroupDefault: listGroup.default,
          listDoc: ListDocInit
        }
      newCombinedRows.push(groupRow);
      for (let i = 0; i < newListRows.length; i++) {
        const listRow = newListRows[i];
        if (listGroup._id == listRow.listGroupID) {
          let listListRow: ListCombinedRow = {
            rowType: RowType.list,
            rowName: listRow.listDoc.name,
            rowKey: "L-"+listRow.listDoc._id,
            listOrGroupID: listRow.listDoc._id,
            listGroupID: listRow.listGroupID,
            listGroupName: listRow.listGroupName,
            listGroupDefault: false,
            listDoc: listRow.listDoc
          }
          newCombinedRows.push(listListRow);    
        } 
      }  
    });
//    console.log("new combined rows before adding ungrouped:",cloneDeep(newCombinedRows));
    // now add any ungrouped (error) lists:
    let testRow = newListRows.find(el => (el.listGroupID == null))
    if (testRow != undefined) {
      let groupRow: ListCombinedRow = {
        rowType : RowType.listGroup, rowName : testRow.listGroupName,
        rowKey: "G-null", listOrGroupID: null, listGroupID : null,
        listGroupName : testRow.listGroupName, listGroupDefault: false,
        listDoc: ListDocInit
      }
      newCombinedRows.push(groupRow);
      newListRows.forEach(newListRow => {
        if (newListRow.listGroupID == null) {
          let listlistRow: ListCombinedRow = {
            rowType: RowType.list, rowName: newListRow.listDoc.name,
            rowKey: "L-"+newListRow.listDoc._id, listOrGroupID: newListRow.listDoc._id,listGroupID: null,
            listGroupName: newListRow.listGroupName, listGroupDefault: false,
            listDoc: newListRow.listDoc
          }
          newCombinedRows.push(listlistRow);  
        }
      })
    }
    setListCombinedRows(newCombinedRows);
  }

  useEffect( () => {
    if (listsLoading || listGroupsLoading) { setListRowsLoaded(false); return };
    if ( !listsLoading && !listGroupsLoading && !listRowsLoaded)  {
      setListRowsLoading(true);
      setListRowsLoaded(false);
      buildListRows();
      setListRowsLoading(false)
      setListRowsLoaded(true);
    }
  },[listsLoading,listRowsLoading,listDocs, listGroupDocs, listGroupsLoading])

  return ({listsLoading, listDocs, listRowsLoading, listRowsLoaded, listRows, listCombinedRows});
}

export enum UseFriendState {
  init = 0,
  baseFriendsChanged = 0,
  baseFriendsLoading = 1,
  baseFriendsLoaded = 2,
  rowsLoading = 3,
  rowsLoaded = 4,
  error = 99
}

export function useFriends(username: string) : { useFriendState: UseFriendState, friendRows: FriendRow[]} {
  const [friendRows,setFriendRows] = useState<FriendRow[]>([]);
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [useFriendState,setUseFriendState] = useState(UseFriendState.init);
  const { docs: friendDocs, error: friendsError, state: friendState } = useFind({
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
      if (useFriendState == UseFriendState.baseFriendsLoaded) {
        if (remoteDBState.syncStatus == SyncStatus.active || remoteDBState.syncStatus == SyncStatus.paused) {
          setUseFriendState((prevState) => UseFriendState.rowsLoading);
          loadFriendRows();
        }  
      }
    },[useFriendState,remoteDBState.syncStatus])

    useEffect( () => {
      if (friendState == "error") {setUseFriendState((prevState) => UseFriendState.error); return};
      if (friendState == "loading") {setUseFriendState((prevState) => UseFriendState.baseFriendsLoading)};
      if (friendState == "done" && useFriendState == UseFriendState.baseFriendsLoading) {
        setUseFriendState((prevState) => UseFriendState.baseFriendsLoaded);
      } 
    },[friendState] )


    async function loadFriendRows() {
      let userIDList : { userIDs: string[]} = { userIDs: []};
      friendDocs.forEach((element: any) => {
        if (element.friendStatus !== FriendStatus.Deleted) {
          if(username == element.friendID1) {userIDList.userIDs.push(element.friendID2)}
          else {userIDList.userIDs.push(element.friendID1)}
        }
      });
      const usersInfo = await getUsersInfo(userIDList,String(remoteDBCreds.apiServerURL), String(remoteDBState.accessJWT));
      setFriendRows(prevState => ([]));
      if (usersInfo.length > 0) {
        friendDocs.forEach((friendDoc: any) => {
          let friendRow : any = {};
          friendRow.friendDoc=cloneDeep(friendDoc);
          if (friendRow.friendDoc.friendID1 == remoteDBCreds.dbUsername)
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
            if ((remoteDBCreds.dbUsername == friendDoc.friendID1 && friendDoc.friendStatus == FriendStatus.PendingFrom2) || 
                (remoteDBCreds.dbUsername == friendDoc.friendID2 && friendDoc.friendStatus == FriendStatus.PendingFrom1))
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
      setUseFriendState((prevState) => UseFriendState.rowsLoaded);
    }

    return({useFriendState: useFriendState, friendRows});
}

export function useConflicts() : { conflictDocs: any[], conflictsLoading: boolean} {
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
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
    const lastConflictsViewed = new Date(String(remoteDBCreds.lastConflictsViewed))
    setMostRecentDate((lastConflictsViewed > oneDayOldDate) ? lastConflictsViewed : oneDayOldDate);  
  },[remoteDBCreds.lastConflictsViewed])

  return({conflictDocs, conflictsLoading});
}