import { useCallback, useState, useEffect, useContext, useRef } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { usePouch, useFind } from 'use-pouchdb'
import { cloneDeep, pull } from 'lodash';
import { RemoteDBStateContext } from './RemoteDBState';
import { FriendRow,InitFriendRow, ResolvedFriendStatus, PouchResponse, PouchResponseInit, initUserInfo, ListCombinedRow, RowType } from './DataTypes';
import { FriendDocs,FriendStatus, ListDoc, ListDocs, ItemDocs, ItemDoc, ItemList, ItemListInit, ConflictDocs, RecipeDoc} from './DBSchema';
import { GlobalStateContext } from './GlobalState';
import { adaptResultToBase64, getUsersInfo} from './Utilities';
import { getCommonKey } from './ItemUtilities';
import { GlobalDataContext } from './GlobalDataProvider';
import { isPlatform } from '@ionic/core';
import { fromBlob } from 'image-resize-compress';
import { useTranslation } from 'react-i18next';
import { translatedItemName } from './translationUtilities';
import log from 'loglevel';

const imageQuality = 80;
export const imageWidth = 200;
export const imageHeight = 200;
export const pictureSrcPrefix = "data:image/jpeg;base64,"

export function useGetOneDoc(docID: string | null, attachments: boolean = false) {
  const db = usePouch();
  const changesRef = useRef<PouchDB.Core.Changes<any>>();
  const [doc,setDoc] = useState<any>(null);
  const [attachBlob,setAttachBlob] = useState<Blob|null>(null);
  const [dbError, setDBError] = useState(false);
  const loadingRef = useRef(true);
  const [, forceUpdateState] = useState<{}>();
  const forceUpdate = useCallback(() => forceUpdateState({}), []);

  const getDoc = useCallback(async (id: string | null) => {
      if (id == null) { loadingRef.current = false; return};
      loadingRef.current = true;
      changesRef.current = db.changes({since: 'now', live: true, include_docs: true, attachments: attachments,doc_ids: [id]})
      .on('change', function(change) { setDoc(change.doc); })
      let success=true; setDBError(false);
      let docRet = null;
      try  {docRet = await db.get(id,{attachments: attachments});}
      catch(err) {success=false; setDBError(true);}
      let docAtt: Blob| null = null;
      let attSuccess=true;
      try {docAtt = (await db.getAttachment(id,"item.jpg") as Blob)}
      catch(err) {attSuccess=false;}
      loadingRef.current = false;
      if (success) {setDoc(docRet)};
      if (attSuccess) {setAttachBlob(docAtt as Blob);}
      forceUpdate();
  },[attachments,db,forceUpdate])
    
  useEffect( () => {
      getDoc(docID)
      return ( () => { if (changesRef.current) {changesRef.current.cancel()};})  
  },[docID,getDoc])  

  return {dbError, loading: loadingRef.current, doc, attachBlob };
}

export function useUpdateGenericDocument() {
  const db = usePouch();
  return useCallback(
    async (updatedDoc: any) => {
          let curDateStr=(new Date()).toISOString()
          updatedDoc.updatedAt = curDateStr;
          let response: PouchResponse = cloneDeep(PouchResponseInit);
          try { response.pouchData = await db.put(updatedDoc); }
          catch(err) { response.successful = false; response.fullError = err; log.error("updating doc, generic:",err);}
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
        const itemDoc: ItemDoc = (itemResults.docs[i] as ItemDoc); 
        try {await db.remove(itemDoc as PouchDB.Core.RemoveDocument)}
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
        const itemDoc: ItemDoc = itemResults.docs[i] as ItemDoc;
        const newLists = []
        for (let j = 0; j < itemDoc.lists.length; j++) {
          if (itemDoc.lists[j].listID !== listID) {
            newLists.push(itemDoc.lists[j])
          }
        }
        itemDoc.lists = newLists;
        try {await db.put(itemDoc)}
        catch(err) {response.successful = false; response.fullError = err; }
      }
      return response;
    },[db]) 
}

export function useDeleteCategoryFromItems() {
  const db=usePouch()
  const {t}=useTranslation();
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
      } catch(err) {response.successful=false; response.fullError=t("error.could_not_find_items"); return response}
      if (itemResults !== undefined && itemResults.hasOwnProperty('docs')) {
        for (let i = 0; i < itemResults.docs.length; i++) {
          const itemDoc: ItemDoc = cloneDeep(itemResults.docs[i]);
          itemDoc.lists.forEach(list => {
            list.categoryID = null;
          });
          try { await db.put(itemDoc) }
          catch(err) {response.successful = false; response.fullError = err; }
        }  
      }
      return response;
    },[db,t]) 
}

export function useDeleteCategoryFromLists() {
  const db=usePouch()
  const {t}=useTranslation();
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
      } catch(err) {response.successful=false; response.fullError=t("error.could_not_find_items"); return response}
      if (listResults !== undefined && listResults.hasOwnProperty('docs')) {
        for (let i = 0; i < listResults.docs.length; i++) {
          const listDoc: ListDoc = cloneDeep(listResults.docs[i]);
          let newCats = cloneDeep(listDoc.categories);
          pull(newCats,catID);
          listDoc.categories = newCats;
          try {await db.put(listDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }  
      }
      return response;
    },[db,t]) 
}

export function useItems({selectedListGroupID,isReady, needListGroupID, activeOnly = false, selectedListID = null, selectedListType = RowType.list,} :
                   {selectedListGroupID: string | null, isReady: boolean, needListGroupID: boolean, activeOnly: boolean, selectedListID: string | null, selectedListType: RowType})
      : {dbError: boolean, itemsLoading: boolean, itemRowsLoading: boolean, itemRowsLoaded: boolean, itemRows: ItemDocs} {
  const [itemRows,setItemRows] = useState<ItemDocs>([]);
  const [itemRowsLoaded, setItemRowsLoaded] = useState(false);
  const [itemRowsLoading, setItemRowsLoading] = useState(false);
  const [dbError, setDBError] = useState(false);
  const { listError: listDBError, listCombinedRows, listRowsLoaded, listDocs, itemsLoading, itemDocs, itemError } = useContext(GlobalDataContext)
  

  const buildItemRows = useCallback( () => {
    let curItemDocs: ItemDocs = cloneDeep(itemDocs);
    let newItemRows: ItemDocs = [];
    curItemDocs.forEach((itemDoc: ItemDoc) => {
      if (selectedListGroupID === null || itemDoc.listGroupID === selectedListGroupID) {
        let listGroupIdx=listCombinedRows.findIndex((lr: ListCombinedRow) => (itemDoc.listGroupID === lr.listGroupID && lr.rowType === RowType.listGroup))
        if (listGroupIdx !== -1) {
          let addToList = true;
          if (activeOnly) {
            if (selectedListType !== RowType.listGroup) {
              addToList=false;
              itemDoc.lists.forEach((il) => {
                if (il.listID === selectedListID && il.active) { addToList=true}
              })
            } else {
              let activeCommon = getCommonKey(itemDoc,"active",listDocs);
              if (!Boolean(activeCommon)) {
                addToList = false;
              }
            }
          }
          if (addToList) {       
            newItemRows.push(itemDoc);
          }
        }
      }
    })
    newItemRows.sort(function (a: ItemDoc, b: ItemDoc) {
      return translatedItemName(a.globalItemID,a.name,a.pluralName,2).toLocaleUpperCase().localeCompare(translatedItemName(b.globalItemID,b.name,b.pluralName,2).toLocaleUpperCase())
    });
    setItemRows(newItemRows);

  },[activeOnly,itemDocs,listCombinedRows,listDocs,selectedListGroupID,selectedListID,selectedListType])

  const checkAndBuild = useCallback( () => {
  if (itemsLoading || !listRowsLoaded || !isReady || (isReady && selectedListGroupID === null && needListGroupID)) { setItemRowsLoaded(false); return };
    if (itemError !== null || listDBError) { setDBError(true); return;}
    setDBError(false);
    if ( !itemsLoading && listRowsLoaded)  {
      setItemRowsLoading(true);
      setItemRowsLoaded(false);
      buildItemRows();
      setItemRowsLoading(false)
      setItemRowsLoaded(true);
    }
  },[isReady,itemError, listDBError,itemsLoading,listRowsLoaded, selectedListGroupID, needListGroupID,buildItemRows])

  useEffect( () => {
    checkAndBuild();
  },[checkAndBuild])

  return ({dbError, itemsLoading, itemRowsLoading, itemRowsLoaded, itemRows});
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
  const { remoteDBState, remoteDBCreds, setRemoteDBState } = useContext(RemoteDBStateContext);
  const [useFriendState,setUseFriendState] = useState(UseFriendState.init);
  const { t }= useTranslation();
  const { docs: friendDocs, state: friendState } = useFind({
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

    const loadFriendRows = useCallback( async () => {
      let userIDList : { userIDs: string[]} = { userIDs: []};
      (friendDocs as FriendDocs).forEach((element) => {
        if (element.friendStatus !== FriendStatus.Deleted) {
          if(username === element.friendID1) {userIDList.userIDs.push(element.friendID2)}
          else {userIDList.userIDs.push(element.friendID1)}
        }
      });
      const [apiOnline,usersInfo] = await getUsersInfo(userIDList,String(remoteDBCreds.apiServerURL), String(remoteDBState.accessJWT));
      if (!apiOnline) {
        setRemoteDBState(prevState =>({...prevState,apiServerAvailable: false}));
        setUseFriendState(UseFriendState.error);
        return;
      }
      setFriendRows(prevState => ([]));
      if (usersInfo.length > 0) {
        (friendDocs as FriendDocs).forEach((friendDoc) => {
          let friendRow : FriendRow = cloneDeep(InitFriendRow);
          friendRow.friendDoc=cloneDeep(friendDoc);
          if (friendRow.friendDoc.friendID1 === remoteDBCreds.dbUsername)
            { friendRow.targetUserName = friendRow.friendDoc.friendID2}
          else { friendRow.targetUserName = friendRow.friendDoc.friendID1}
          let user=usersInfo.find((el) => el?.name === friendRow.targetUserName)
          if (user === undefined) {user = cloneDeep(initUserInfo)};
          if (friendDoc.friendStatus === FriendStatus.WaitingToRegister) {
            friendRow.targetEmail = friendDoc.inviteEmail
          } else {
            friendRow.targetEmail = String(user?.email);
          }
          friendRow.targetFullName = String(user?.fullname);
          if (friendDoc.friendStatus === FriendStatus.PendingFrom1 || friendDoc.friendStatus === FriendStatus.PendingFrom2) {
            if ((remoteDBCreds.dbUsername === friendDoc.friendID1 && friendDoc.friendStatus === FriendStatus.PendingFrom2) || 
                (remoteDBCreds.dbUsername === friendDoc.friendID2 && friendDoc.friendStatus === FriendStatus.PendingFrom1))
            {
              friendRow.friendStatusText = t("general.needs_confirmed");
              friendRow.resolvedStatus = ResolvedFriendStatus.PendingConfirmation;
            } else {
              friendRow.friendStatusText = t("general.requested");
              friendRow.resolvedStatus = ResolvedFriendStatus.Requested;
            }
          } else if (friendDoc.friendStatus === FriendStatus.Confirmed) {
            friendRow.friendStatusText = t("general.confirmed");
            friendRow.resolvedStatus = ResolvedFriendStatus.Confirmed;
          } else if (friendDoc.friendStatus === FriendStatus.WaitingToRegister) {
            friendRow.friendStatusText = t("general.needs_registering");
            friendRow.resolvedStatus = ResolvedFriendStatus.WaitingToRegister
          }
          setFriendRows(prevArray => [...prevArray, friendRow])
        })
      }
      setUseFriendState((prevState) => UseFriendState.rowsLoaded);
    },[friendDocs,remoteDBCreds.apiServerURL,remoteDBCreds.dbUsername,remoteDBState.accessJWT,setRemoteDBState,t,username])


    useEffect( () => {
      if (useFriendState === UseFriendState.baseFriendsLoaded) {
        if ( remoteDBState.initialSyncComplete ) {
          setUseFriendState((prevState) => UseFriendState.rowsLoading);
          loadFriendRows();
        }  
      }
    },[useFriendState,remoteDBState.initialSyncComplete,loadFriendRows])

    useEffect( () => {
      if (friendState === "error") {setUseFriendState((prevState) => UseFriendState.error); return};
      if (friendState === "loading") {setUseFriendState((prevState) => UseFriendState.baseFriendsLoading)};
      if (friendState === "done" && useFriendState === UseFriendState.baseFriendsLoading) {
        setUseFriendState((prevState) => UseFriendState.baseFriendsLoaded);
      } 
    },[friendState,useFriendState] )


    return({useFriendState: useFriendState, friendRows});
}

export function useConflicts() : { conflictsError: boolean, conflictDocs: ConflictDocs, conflictsLoading: boolean} {
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  const { globalState, settingsLoading } = useContext(GlobalStateContext);
  const [mostRecentDate,setMostRecentDate] = useState<Date>(new Date());

  const { docs: conflictDocs, loading: conflictsLoading, error: dbError } = useFind({
    index: { fields: ["type","docType","updatedAt"]},
    selector: { type: "conflictlog", docType: { $exists: true }, updatedAt: { $gt: mostRecentDate.toISOString()} },
    sort: [ "type", "docType","updatedAt" ]
  })

  useEffect( () => {
    if (globalState.settingsLoaded && !settingsLoading) {
      let oneDayOldDate=new Date();
      oneDayOldDate.setDate(oneDayOldDate.getDate()-Number(globalState.settings.daysOfConflictLog));
      const lastConflictsViewed = new Date(String(remoteDBCreds.lastConflictsViewed))
      setMostRecentDate((lastConflictsViewed > oneDayOldDate) ? lastConflictsViewed : oneDayOldDate);  
    }
  },[remoteDBCreds.lastConflictsViewed,globalState.settings.daysOfConflictLog, globalState.settingsLoaded, settingsLoading])

  return({conflictsError: dbError !== null, conflictDocs: (conflictDocs as ConflictDocs), conflictsLoading});
}

export function useRecipes() : { recipesError: boolean, recipeDocs: RecipeDoc[], recipesLoading: boolean} {
  const { docs: recipeDocs, loading: recipesLoading, error: dbError} = useFind({
    index: { fields: ["type","name"]},
    selector: { type: "recipe", name: { $exists: true } },
    sort: [ "type", "name" ]
  });
  const [sortedRecipes,setSortedRecipes] = useState<RecipeDoc[]>()

  useEffect( () => {
    let sorted=cloneDeep(recipeDocs) as RecipeDoc[];
    sorted.sort(function(a,b) {
      return a.name.toUpperCase().localeCompare(b.name.toUpperCase())
    });
    setSortedRecipes(sorted);
  },[recipeDocs,recipesLoading])

  return ({recipesError: dbError !== null, recipeDocs: (sortedRecipes as RecipeDoc[]), recipesLoading})
}

export function useAddListToAllItems() {
  const db = usePouch();
  return useCallback(
    async ({listGroupID, listID, listDocs} : {listGroupID: string, listID: string, listDocs: ListDocs}) => {
          let updateSuccess=true;
          let itemRecords: PouchDB.Find.FindResponse<ItemDoc>
          itemRecords = await db.find({
            selector: { type: "item", 
                        name: { $exists: true},
                        listGroupID: listGroupID},
            sort: [ "type","name"]
          }) as PouchDB.Find.FindResponse<ItemDoc>;
          for (let i = 0; i < itemRecords.docs.length; i++) {
            const item = itemRecords.docs[i];
            let itemUpdated=false;
            let listIdx = item.lists.findIndex((l: ItemList) => l.listID === listID)
            if (listIdx === -1) {
              let newList = cloneDeep(ItemListInit);
              newList.listID = listID;
              newList.active = getCommonKey(item,"active",listDocs);
              newList.categoryID = getCommonKey(item,"categoryID",listDocs);
              newList.completed = getCommonKey(item,"completed",listDocs);
              newList.note = getCommonKey(item,"note",listDocs);
              newList.quantity = getCommonKey(item,"quantity",listDocs);
              newList.stockedAt = getCommonKey(item,"stockedAt",listDocs);
              newList.uomName = getCommonKey(item,"uomName",listDocs);
              item.lists.push(newList);
              itemUpdated=true;
            }
            if (itemUpdated) {
              let curDateStr=(new Date()).toISOString()
              item.updatedAt = curDateStr;
              let updateResponse = await db.put(item);
              if (!updateResponse.ok) {updateSuccess = false;}
            }
          }
      return updateSuccess;
    },[db])
}


export function usePhotoGallery() {
  const { t } = useTranslation();
  const takePhoto = async () => {
    let rPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: imageQuality,
      width: imageWidth,
      height: imageHeight,
      allowEditing: false,
      saveToGallery: false,
      promptLabelHeader: t("general.take_picture_for_item") as string
    });
    let photoString = rPhoto.base64String;
    if (photoString !== undefined && (isPlatform("desktop") || isPlatform("electron"))) {
      //image needs resizing -- desktop doesn't obey size constraints
      let base64Resp = await fetch(pictureSrcPrefix+photoString);
      const blob = await base64Resp.blob();
      let newBlob = await fromBlob(blob,imageQuality,imageWidth,"auto");
      photoString = await adaptResultToBase64(newBlob);
      photoString = (photoString as string).substring(pictureSrcPrefix.length);
    }
    return photoString;
  };

  return {
    takePhoto,
  };
}
