import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup,
  IonItemDivider, IonButton, IonButtons, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect,
  IonSelectOption, IonSearchbar, IonPopover, IonAlert,IonMenuButton, useIonToast, IonGrid, IonRow, 
  IonRouterLink, IonCol} from '@ionic/react';
import { add,checkmark } from 'ionicons/icons';
import React, { useState, useEffect, useContext, useRef, KeyboardEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateCompleted, useUpdateGenericDocument, useLists } from '../components/Usehooks';
import { AddListOptions, GlobalStateContext } from '../components/GlobalState';
import { ItemSearch, SearchState, PageState, ListRow, ListCombinedRow, HistoryProps, RowType, ItemDoc, ItemDocs} from '../components/DataTypes'
import { getAllSearchRows, getItemRows, filterSearchRows } from '../components/ItemUtilities';
import SyncIndicator from '../components/SyncIndicator';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { isEqual } from 'lodash';

const Items: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { remoteDBCreds} = useContext(RemoteDBStateContext);
  let { mode: routeMode, id: routeListID  } = useParams<{mode: string, id: string}>();
  const [searchRows,setSearchRows] = useState<ItemSearch[]>();
  const [searchState,setSearchState] = useState<SearchState>({searchCriteria:"",isOpen: false,isFocused: false,event: undefined, filteredSearchRows: [], dismissEvent: undefined});
  const [pageState, setPageState] = useState<PageState>({selectedListOrGroupID: routeListID, doingUpdate: false, itemRows: [], showAlert: false, alertHeader: "", alertMessage: ""});
  const searchRef=useRef<HTMLIonSearchbarElement>(null);
  const origSearchCriteria = useRef("");
  const [presentToast] = useIonToast();
  const updateCompleted = useUpdateCompleted();
  const updateItemInList = useUpdateGenericDocument();

  const { docs: itemDocs, loading: itemLoading } = useFind({
    index: { fields: ["type","name"]},
    selector: {
      type: "item", name: { $exists: true },
      "$or": [ {listGroupID: pageState.selectedListOrGroupID} , 
               {lists: { $elemMatch: { "listID": pageState.selectedListOrGroupID , "active" : true} }}] },
    sort: [ "type", "name"]})
  const { listCombinedRows,listRows, listRowsLoading } = useLists(String(remoteDBCreds.dbUsername));
  const { docs: uomDocs, loading: uomLoading } = useFind({
    index: { fields: [ "type","name"]},
    selector: { type: "uom", name: { $exists: true}},
    sort: [ "type","name"] })
  const { docs: categoryDocs, loading: categoryLoading } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"] });
  const { docs: allItemDocs, loading: allItemsLoading } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "item", name: { $exists: true}},
      sort: [ "type","name"] });

  const { globalState,setGlobalState} = useContext(GlobalStateContext);
  const listType = (routeMode == "list") ? RowType.list : RowType.listGroup

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListOrGroupID: routeListID}))
  },[routeListID])

  useEffect( () => {
    if (!itemLoading && !listRowsLoading && !categoryLoading && !allItemsLoading &&!uomLoading) {
      setPageState( (prevState) => ({ ...prevState,
        doingUpdate: false,
        itemRows: getItemRows(itemDocs as ItemDocs, listCombinedRows, categoryDocs, uomDocs, listType, pageState.selectedListOrGroupID),
      }))
    }
  },[itemLoading, allItemsLoading, listRowsLoading, categoryLoading, uomLoading, uomDocs, itemDocs, listCombinedRows, allItemDocs, categoryDocs, pageState.selectedListOrGroupID]);

  useEffect( () => {
    setSearchRows(getAllSearchRows(allItemDocs,pageState.selectedListOrGroupID));
  },[allItemsLoading, allItemDocs, pageState.selectedListOrGroupID])

  useEffect( () => {
    let filterRows=filterSearchRows(searchRows, searchState.searchCriteria)
    if (filterRows.length > 0 && searchState.isFocused ) {
      setSearchState(prevState => ({...prevState, filteredSearchRows: filterRows, isOpen: true }));
    } else {
      setSearchState(prevState => ({...prevState, filteredSearchRows: [], isOpen: false}));
    }  
  },[searchState.searchCriteria,searchState.isFocused])
  
  if (itemLoading || listRowsLoading || categoryLoading || allItemsLoading || uomLoading || pageState.doingUpdate )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};  

  function updateSearchCriteria(event: CustomEvent) {
    setSearchState(prevState => ({...prevState, event: event, searchCriteria: event.detail.value}));
    origSearchCriteria.current=event.detail.value;
  }  

  function isItemAlreadyInList(itemName: string) {
    let existingItem: any = allItemDocs.find((el: any) => el.name.toUpperCase() === itemName.toUpperCase());
    return(!(existingItem == undefined));
  }

  function addNewItemToList(itemName: string) {
    if (isItemAlreadyInList(itemName)) {
      setPageState(prevState => ({...prevState, showAlert: true, alertHeader: "Error adding to list", alertMessage: "Item already exists in the current list"}))
    } else {
      setGlobalState({...globalState, itemMode: "new",
                                     callingListID: pageState.selectedListOrGroupID,
                                     newItemName: itemName})
      setSearchState(prevState => ({...prevState, isOpen: false,searchCriteria:"",isFocused: false}))
      props.history.push("/item/new/");
    }
  }
  
  function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    }
  }

  function clickedSearchCheck() {
    addNewItemToList(origSearchCriteria.current);
  }

  function leaveSearchBox(event: any) {
    origSearchCriteria.current=searchState.searchCriteria;
    setSearchState(prevState => ({...prevState, isOpen: false, isFocused: false}));
  }

  function enterSearchBox(event: any) {
    let toOpen=true;
    if (searchState.filteredSearchRows.length === 0) { toOpen = false}
    setSearchState(prevState => ({...prevState, event: event, isFocused: true,isOpen: toOpen}));
  }

  function isCategoryInList(listID: string, categoryID: string) {
    let listIdx = listRows.findIndex(el => el.listDoc._id === listID);
    if (listIdx === -1) {return false;}
    let catexists= listRows[listIdx].listDoc.categories.includes(categoryID);
    return catexists;
  }

  async function addExistingItemToList(itemID: string) {
    let existingItem: any = cloneDeep(allItemDocs.find((el: any) => el._id === itemID));
    //TODO
    let baseList = listRows.find((el: ListRow) => pageState.selectedListOrGroupID === el.listDoc._id)
    let baseParticipants = baseList?.participants;
    
    listRows.forEach((listRow: ListRow) => {
      let idxInLists=existingItem.lists.findIndex((el: any) => el.listID === listRow.listDoc._id);
      let skipThisList=false;
      if (!isEqual(listRow.participants,baseParticipants)) {skipThisList = true};
      //TODO
      if (listRow.listDoc._id !== pageState.selectedListOrGroupID) {
        if (globalState.settings.addListOption === AddListOptions.dontAddAutomatically) {
          skipThisList=true;
        } else if (globalState.settings.addListOption === AddListOptions.addToListsWithCategoryAutomatically) {
          if (!isCategoryInList(listRow.listDoc._id,existingItem.categoryID)) {
            skipThisList=true;
          }
        }
      }
      //TODO
      if (!skipThisList && (idxInLists !== -1) && listRow.listDoc._id !== pageState.selectedListOrGroupID) {
        if (!existingItem.lists[idxInLists].stockedAt) {
          skipThisList = true;
        }
      }
      if (!skipThisList) {
        if (idxInLists === -1) {
          const newListItem={
            listID: listRow.listDoc._id,
            boughtCount: 0,
            active: true,
            completed: false
          };
          existingItem.lists.push(newListItem);    
        } else {
          existingItem.lists[idxInLists].active = true;
          existingItem.lists[idxInLists].completed = false;     
        }
      }
    });
    let result = await updateItemInList(existingItem);
    if (!result.successful) {
      presentToast({message: "Error updating item, please retry.",duration: 1500, position: "middle"});
    }
  }

  function chooseSearchItem(itemID: string) {
    addExistingItemToList(itemID);
    setSearchState(prevState => ({...prevState, searchCriteria: "", filteredRows: [],isOpen: false, isFocused: false}))
  }

  let popOverElem = (
    <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={(e) => {leaveSearchBox(e)}}>
    <IonContent><IonList key="popoverItemList">
      {(searchState.filteredSearchRows as ItemSearch[]).map((item: ItemSearch) => (
        <IonItem key={pageState.selectedListOrGroupID+"-poilist-"+item.itemID} onClick={() => chooseSearchItem(item.itemID)}>{item.itemName}</IonItem>
      ))}
    </IonList></IonContent>
    </IonPopover>
  )

  let alertElem = (
    <IonAlert
      isOpen={pageState.showAlert}
      onDidDismiss={() => setPageState(prevState => ({...prevState,showAlert: false, alertHeader:"",alertMessage:""}))}
      header={pageState.alertHeader}
      message={pageState.alertMessage}
      buttons={["OK"]}
    />
  )
  
  let headerElem=(
    <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton /></IonButtons>
    <IonTitle>
        <IonItem key="listselector">
        <IonSelect label="Items On List:" aria-label="Items On List:" interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListOrGroupID}>
            {listCombinedRows.map((listCombinedRow: ListCombinedRow) => (
                <IonSelectOption disabled={listCombinedRow.rowKey=="G-null"} className={listCombinedRow.rowType == RowType.list ? "indented" : ""} key={listCombinedRow.listOrGroupID} value={listCombinedRow.listOrGroupID}>
                  {listCombinedRow.rowName}
                </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem key="searchbar">
          <IonSearchbar debounce={5} ref={searchRef} value={searchState.searchCriteria} inputmode="search" enterkeyhint="enter"
              onKeyDown= {(e:any) => searchKeyPress(e)}
              onIonChange={(e: any) => updateSearchCriteria(e)}
              // onIonBlur={(e: any) => leaveSearchBox(e)}
              onClick={(e: any) => enterSearchBox(e)}>
          </IonSearchbar>
          <IonButton onClick={()=> clickedSearchCheck()}><IonIcon icon={checkmark} /></IonButton>
        </IonItem>
        {popOverElem}
        {alertElem}
    </IonTitle><SyncIndicator history={props.history}/></IonToolbar></IonHeader>)

  if (pageState.itemRows.length <=0 )  {return(
    <IonPage>{headerElem}<IonContent><IonItem key="nonefound"><IonLabel key="nothinghere">No Items On List</IonLabel></IonItem></IonContent></IonPage>
  )};  

  async function completeItemRow(id: String, newStatus: boolean | null) {
    // make the update in the database, let the refresh of the view change state
    let itemDoc = itemDocs.find(element => (element._id === id))
    let updateInfo = {
      itemDoc: itemDoc,
      removeAll: globalState.settings.removeFromAllLists,
      newStatus: newStatus,
      listID: pageState.selectedListOrGroupID,
      listRows: listRows
    }
    setPageState(prevState=> ({...prevState,doingUpdate: true}));
    let response=await updateCompleted(updateInfo);
    if (!response.successful) {
      presentToast({message: "Error updating completed status. Please retry", duration: 1500, position: "middle"})
    }
  }

  function selectList(listOrGroupID: string) {
    if (listOrGroupID == "null" ) { console.log("ungrouped selected");  return }
    console.log("in select list: id:",listOrGroupID);
    console.log("current list combined rows:",cloneDeep(listCombinedRows));
    let combinedRow: ListCombinedRow | undefined = listCombinedRows.find(lcr => lcr.listOrGroupID == listOrGroupID);
    console.log("found combined row: ", cloneDeep(combinedRow));
    setPageState({...pageState, selectedListOrGroupID: listOrGroupID, itemRows: getItemRows(itemDocs as ItemDocs, listCombinedRows, categoryDocs, uomDocs, listType, listOrGroupID)});
    if (combinedRow == undefined) {return};
    if (combinedRow.rowType == RowType.list) {
      props.history.push('/items/list/'+combinedRow.listDoc._id);
    } else {
      props.history.push('/items/group/'+combinedRow.listGroupID);
    }
  }

  let listContent=[];

  function addCurrentRows(listCont: any, curRows: any, catID: string, catName: string, completed: boolean | null) {
    listCont.push(
        <IonItemGroup key={"cat"+catID+Boolean(completed).toString()}>
        <IonItemDivider key={"cat"+catID+Boolean(completed).toString()}>{catName}</IonItemDivider>
          {curRows}
      </IonItemGroup>
    )
  }

  async function deleteCompletedItems(itemDocs: any,listID: string) {
    itemDocs.forEach(async (itemDoc: any) => {
        let updatedItem=cloneDeep(itemDoc);
        let listItemIdx=updatedItem.lists.findIndex((el: any) => el.listID === listID);
        if ((listItemIdx !== -1)) {
            if (updatedItem.lists[listItemIdx].completed) {
                updatedItem.lists[listItemIdx].active = false;
                let result = await updateItemInList(updatedItem);
                if (!result.successful) {
                  presentToast({message: "Error deleting items from list. Please retry.",
                    duration: 1500, position: "middle"})
                }
            }    
        }
    });
  }

  let lastCategoryID : string | null ="<INITIAL>";
  let lastCategoryName="<INITIAL>";
  let lastCategoryFinished: boolean | null = null;
  let currentRows=[];
  let createdFinished=false;
  const completedDivider=(
        <IonItemGroup key="completeddividergroup"><IonItemDivider key="Completed">
        <IonLabel key="completed-divider-label">Completed</IonLabel>
        <IonButton slot="end" onClick={() => deleteCompletedItems(itemDocs,pageState.selectedListOrGroupID)}>DELETE COMPLETED ITEMS</IonButton>
        </IonItemDivider></IonItemGroup>);
  for (let i = 0; i < pageState.itemRows.length; i++) {
    const item = pageState.itemRows[i];
    if ((lastCategoryName !== item.categoryName )||(lastCategoryFinished !== item.completed)) { 
      if (currentRows.length > 0) {
        addCurrentRows(listContent,currentRows,String(lastCategoryID),lastCategoryName,lastCategoryFinished);
        currentRows=[];
      }
      lastCategoryID = item.categoryID;
      lastCategoryName=item.categoryName;
      lastCategoryFinished=item.completed;   
    }
    currentRows.push(
      <IonItem key={pageState.itemRows[i].itemID} >
        <IonGrid><IonRow>
        <IonCol size="1">
        <IonCheckbox aria-label=""
            onIonChange={(e: any) => completeItemRow(item.itemID,e.detail.checked)}
            checked={Boolean(pageState.itemRows[i].completed)}></IonCheckbox>
        </IonCol>
        <IonCol size="11">
          <IonRouterLink color="dark" href={"/item/edit/"+item.itemID}>{item.itemName + " ("+ item.quantity.toString()+(item.uomDesc == "" ? "" : " ")+item.uomDesc+")"}</IonRouterLink>
        </IonCol>
        </IonRow></IonGrid>
      </IonItem>);
    if (lastCategoryFinished && !createdFinished) {
      listContent.push(completedDivider);
      createdFinished=true;
    }    
  }
  addCurrentRows(listContent,currentRows,String(lastCategoryID),lastCategoryName,lastCategoryFinished);
  if (!createdFinished) {listContent.push(completedDivider)};
  let contentElem=(<IonList lines="full">{listContent}</IonList>)

  if (searchState.isOpen) {
    searchRef.current?.focus();
  }

  return (
    <IonPage>
      {headerElem}
      <IonContent fullscreen id="main">
          {contentElem}
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton onClick={() => addNewItemToList("")}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Items;
