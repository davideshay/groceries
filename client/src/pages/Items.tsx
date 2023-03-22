import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup,
  IonItemDivider, IonButton, IonButtons, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect,
  IonSelectOption, IonInput, IonPopover, IonAlert,IonMenuButton, useIonToast, IonGrid, IonRow, 
  IonCol, useIonAlert, IonLoading } from '@ionic/react';
import { add, searchOutline } from 'ionicons/icons';
import React, { useState, useEffect, useContext, useRef, KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateGenericDocument, useLists, useCreateGenericDocument } from '../components/Usehooks';
import { AddListOptions, GlobalStateContext } from '../components/GlobalState';
import { ItemSearch, SearchState, PageState, ListRow, ListCombinedRow, HistoryProps, RowType, ItemSearchType} from '../components/DataTypes'
import { ItemDoc, ItemDocs, ItemListInit, ItemList, ItemDocInit, CategoryDoc, UomDoc, GlobalItemDocs } from '../components/DBSchema';
import { getAllSearchRows, getItemRows, filterSearchRows } from '../components/ItemUtilities';
import SyncIndicator from '../components/SyncIndicator';
import ErrorPage from './ErrorPage';

const Items: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode: routeMode, id: routeListID  } = useParams<{mode: string, id: string}>();
  const [searchRows,setSearchRows] = useState<ItemSearch[]>();
  const [searchState,setSearchState] = useState<SearchState>({searchCriteria:"",isOpen: false,isFocused: false,event: undefined, filteredSearchRows: [], dismissEvent: undefined});
  const [pageState, setPageState] = useState<PageState>({selectedListOrGroupID: routeListID, 
          selectedListType: (routeMode == "list" ? RowType.list : RowType.listGroup) ,
          ignoreCheckOffWarning: false,
          groupIDforSelectedList: "",
          doingUpdate: false, itemRows: [], showAlert: false, alertHeader: "", alertMessage: ""});
  const searchRef=useRef<HTMLIonInputElement>(null);
  const origSearchCriteria = useRef("");
  const [presentToast] = useIonToast();
  const [presentAlert, dismissAlert] = useIonAlert();
  const updateItemInList = useUpdateGenericDocument();
  const addNewItem = useCreateGenericDocument();
  const screenLoading = useRef(true);

  const { docs: itemDocs, loading: itemLoading, error: itemError } = useFind({
    index: { fields: ["type","name"]},
    selector: {
      type: "item", name: { $exists: true },
      "$or": [ {listGroupID: pageState.selectedListOrGroupID} , 
               {lists: { $elemMatch: { "listID": pageState.selectedListOrGroupID , "active" : true} }}] },
    sort: [ "type", "name"]})
  const { dbError: listError , listDocs, listCombinedRows,listRows, listRowsLoaded } = useLists();
  const { docs: uomDocs, loading: uomLoading, error: uomError } = useFind({
    index: { fields: [ "type","name"]},
    selector: { type: "uom", name: { $exists: true}},
    sort: [ "type","name"] })
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"] });
  const { docs: allItemDocs, loading: allItemsLoading, error: allItemsError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "item", name: { $exists: true}, listGroupID: pageState.groupIDforSelectedList},
      sort: [ "type","name"] });
  const { docs: globalItemDocs, loading: globalItemsLoading, error: globalItemsError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "globalitem", name: { $exists: true}}
  })

  const { globalState,setStateInfo: setGlobalStateInfo} = useContext(GlobalStateContext);
 
  function getGroupIDForList(listID: string): string {
    if (routeMode == "group") { return pageState.selectedListOrGroupID};
    let retGID = "";
    for (let i = 0; i < listRows.length; i++) {
      if (listRows[i].listDoc._id == listID) { retGID=String(listRows[i].listGroupID); break}
    }
    return retGID;
  }

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListOrGroupID: routeListID, selectedListType: (routeMode == "group" ? RowType.listGroup : RowType.list)}))
  },[routeListID,routeMode])

  useEffect( () => {
    if (listRowsLoaded) {
      setPageState(prevState => ({...prevState,groupIDforSelectedList: getGroupIDForList(pageState.selectedListOrGroupID)}))
    }
  },[listRowsLoaded,pageState.selectedListOrGroupID])

  useEffect( () => {
    if (!itemLoading && listRowsLoaded && !categoryLoading && !allItemsLoading &&!uomLoading && !globalItemsLoading) {
      setPageState( (prevState) => ({ ...prevState,
        doingUpdate: false,
        itemRows: getItemRows(itemDocs as ItemDocs, listCombinedRows, categoryDocs as CategoryDoc[], uomDocs as UomDoc[], pageState.selectedListType, pageState.selectedListOrGroupID)
      }))
    }
  },[itemLoading, allItemsLoading, listRowsLoaded, categoryLoading, uomLoading, globalItemsLoading, uomDocs, itemDocs, listCombinedRows, allItemDocs, categoryDocs, pageState.selectedListOrGroupID]);

  useEffect( () => {
    if (!allItemsLoading && !globalItemsLoading) {
      setSearchRows(getAllSearchRows(allItemDocs as ItemDocs,pageState.selectedListOrGroupID, listDocs, globalItemDocs as GlobalItemDocs));
    }  
  },[allItemsLoading, globalItemsLoading, globalItemDocs, allItemDocs, pageState.selectedListOrGroupID])

  useEffect( () => {
    let filterRows=filterSearchRows(searchRows, searchState.searchCriteria)
    console.log("new filtered rows: ", cloneDeep(filterRows));
    
    console.log("search changed: ",cloneDeep(searchState.searchCriteria),"is focused: ",cloneDeep(searchState.isFocused),"is open:",cloneDeep(searchState.isOpen));
//    if (filterRows.length > 0 ) {
    if (filterRows.length > 0 && searchState.isFocused ) {
      console.log("setting isOpen true");
      setSearchState(prevState => ({...prevState, filteredSearchRows: filterRows, isOpen: true }));
    } else {
      console.log("setting isOpen False");
      setSearchState(prevState => ({...prevState, filteredSearchRows: [], isOpen: false}));
    }  
  },[searchState.searchCriteria,searchState.isFocused])
  
  if (itemError || listError || categoryError || allItemsError || uomError || globalItemsError) {return (
    <ErrorPage errorText="Error Loading Items Information... Restart."></ErrorPage>
  )}

  if (itemLoading || !listRowsLoaded || categoryLoading || allItemsLoading || globalItemsLoading || uomLoading || pageState.doingUpdate )  {return(
    <IonPage>
        <IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
        <IonContent><IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false;}} 
                                message="Loading Data..." />
        </IonContent>
      </IonPage>
  )};  

  screenLoading.current=false;

  function updateSearchCriteria(event: CustomEvent) {
    console.log("updating search criteria:",event.detail.value);
    setSearchState(prevState => ({...prevState, event: event, searchCriteria: event.detail.value}));
    origSearchCriteria.current=event.detail.value;
  }  

  function isItemAlreadyInList(itemName: string) {
    let existingItem = (allItemDocs as ItemDocs).find((el) => el.name.toUpperCase() === itemName.toUpperCase());
    return(!(existingItem == undefined));
  }

  function addNewItemToList(itemName: string) {
    if (isItemAlreadyInList(itemName)) {
      setPageState(prevState => ({...prevState, showAlert: true, alertHeader: "Error adding to list", alertMessage: "Item already exists in the current list"}))
    } else {
      setGlobalStateInfo("itemMode","new");
      setGlobalStateInfo("callingListID",pageState.selectedListOrGroupID);
      setGlobalStateInfo("callingListType",pageState.selectedListType);
      setGlobalStateInfo("newItemName",itemName);
      console.log("ANITL: setting is focused/isopen to false");
      setSearchState(prevState => ({...prevState, isOpen: false,searchCriteria:"",isFocused: false}))
      props.history.push("/item/new/");
    }
  }
  
  function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
    console.log("key pressed", event.key);
    if (event.key === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    }
  }

  function clickedSearchCheck() {
    addNewItemToList(origSearchCriteria.current);
  }

  function leaveSearchBox() {
    console.log("leaving search box... setting is open false");
    origSearchCriteria.current=searchState.searchCriteria;
    setSearchState(prevState => ({...prevState, isOpen: false}));
  }

  function enterSearchBox(event: Event) {
    console.log("entering Search Box..., setting is focused to true");
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

  async function addExistingItemToList(item: ItemSearch) {
    console.log("AEITL" , cloneDeep(item));
    if (item.itemType == ItemSearchType.Global) {
      let newItem: ItemDoc = cloneDeep(ItemDocInit);
      newItem.globalItemID = item.globalItemID;
      newItem.listGroupID = pageState.groupIDforSelectedList;
      newItem.name = item.itemName;
      listRows.forEach((lr) => {
        if (lr.listGroupID == pageState.groupIDforSelectedList) {
          let newItemList: ItemList = cloneDeep(ItemListInit);
          newItemList.listID = lr.listDoc._id;
          newItemList.categoryID = item.globalItemCategoryID;
          newItemList.uomName = item.globalItemUOM;
          newItemList.quantity = 1;
          newItem.lists.push(newItemList);
        }  
      })
      let itemAdded = await addNewItem(newItem);
      if (!itemAdded.successful) {
        presentToast({message: "Error adding item, please retry.",duration: 1500, position: "middle"});
      }
      return;
    }
    let existingItem: ItemDoc = cloneDeep((allItemDocs as ItemDocs).find((el) => el._id === item.itemID));    
    listRows.forEach((listRow: ListRow) => {
      let idxInLists=existingItem.lists.findIndex((el) => el.listID === listRow.listDoc._id);
      let skipThisList=false;
      if (listRow.listDoc._id !== pageState.selectedListOrGroupID) {
        if (globalState.settings.addListOption === AddListOptions.dontAddAutomatically) {
          skipThisList=true;
        } else if (globalState.settings.addListOption === AddListOptions.addToListsWithCategoryAutomatically) {
          if (pageState.selectedListType !== RowType.listGroup) {
            if (idxInLists !== -1) {
              let currItemListCategory = existingItem.lists[idxInLists].categoryID;
              if (!isCategoryInList(listRow.listDoc._id,String(currItemListCategory))) {
                skipThisList = true;
              }
            }
          }
        }
      }
      if (!skipThisList && (idxInLists !== -1) && listRow.listDoc._id !== pageState.selectedListOrGroupID) {
        if (!existingItem.lists[idxInLists].stockedAt) {
          skipThisList = true;
        }
      }
      if (!skipThisList) {
        if (idxInLists === -1) {
          const newListItem: ItemList=cloneDeep(ItemListInit); 
          newListItem.listID = listRow.listDoc._id;
          newListItem.active = true;
          newListItem.completed = false;
          newListItem.stockedAt = true;
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

  function chooseSearchItem(item: ItemSearch) {
    console.log("AEITL setting is open and is focused to false" );
    addExistingItemToList(item);
    setSearchState(prevState => ({...prevState, searchCriteria: "", filteredRows: [],isOpen: false, isFocused: false}))
  }

  async function completeItemRow(id: String, newStatus: boolean | null) {
    if (pageState.selectedListType == RowType.listGroup && !pageState.ignoreCheckOffWarning) {
       await presentAlert({
        header: "Checking Items in List Group",
        subHeader: "Warning: You are checking off/on items while in List Group mode. Normally you would change to the shopping list first to make these changes. Continue? ",
        buttons: [ { text: "Cancel", role: "Cancel" ,
                    handler: () => dismissAlert()},
                    { text: "Continue/Ignore", role: "confirm",
                    handler: () => {setPageState(prevState => ({...prevState,ignoreCheckOffWarning: true})); dismissAlert()}}]
      })
    }
    // make the update in the database, let the refresh of the view change state
    let itemDoc: ItemDoc = cloneDeep(itemDocs.find(element => (element._id === id)))
    setPageState(prevState=> ({...prevState,doingUpdate: true}));
    let listChanged=false;
    itemDoc.lists.forEach((list: ItemList) => {
      let updateThisList=false;
      if (pageState.selectedListOrGroupID == list.listID) { updateThisList = true;}
      if (pageState.selectedListType == RowType.listGroup) { updateThisList = true};
      if (pageState.selectedListType == RowType.list && 
          globalState.settings.removeFromAllLists &&
          newStatus) { updateThisList = true;}
      if (updateThisList) {
        list.completed = Boolean(newStatus);
        if (newStatus) {
          list.boughtCount=list.boughtCount+1;
        }
        listChanged=true;
      }
    });
    if (listChanged) {
      let response = await updateItemInList(itemDoc);
      console.log("did update, response is:", cloneDeep(response));
      if (!response.successful) {
        presentToast({message: "Error updating completed status. Please retry", duration: 1500, position: "middle"})
      }  
    }
  }

  function selectList(listOrGroupID: string) {
    if (listOrGroupID == "null" ) { console.log("ungrouped selected");  return }
    let combinedRow: ListCombinedRow | undefined = listCombinedRows.find(lcr => lcr.listOrGroupID == listOrGroupID);
    let newListType: RowType = combinedRow!.rowType;
    setPageState({...pageState, selectedListOrGroupID: listOrGroupID, selectedListType: newListType, itemRows: getItemRows(itemDocs as ItemDocs, listCombinedRows, categoryDocs as CategoryDoc[], uomDocs as UomDoc[], newListType, listOrGroupID)});
    if (combinedRow == undefined) {return};
    if (combinedRow.rowType == RowType.list) {
      props.history.push('/items/list/'+combinedRow.listDoc._id);
    } else {
      props.history.push('/items/group/'+combinedRow.listGroupID);
    }
  }

  async function deleteCompletedItems(itemDocs: ItemDocs,listID: string) {
    (itemDocs as ItemDocs).forEach(async (itemDoc) => {
        let updatedItem: ItemDoc=cloneDeep(itemDoc);
        let listItemIdx=updatedItem.lists.findIndex((el) => el.listID === listID);
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

//     <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} >

  //     <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={() => {leaveSearchBox()}}>

  let popOverElem = (
    <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={(e) => {console.log("did dismiss:e:",cloneDeep(e)); leaveSearchBox()}}>
    <IonContent><IonList key="popoverItemList">
      {(searchState.filteredSearchRows as ItemSearch[]).map((item: ItemSearch) => (
        <IonItem button key={pageState.selectedListOrGroupID+"-poilist-"+item.itemID} onClick={(e) => {console.log("clicked", cloneDeep(e)); chooseSearchItem(item)}}>{item.itemName}</IonItem>
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
 //                onIonBlur={() => {console.log("searchbar out of focus"); setSearchState((prevState) => ({...prevState,isFocused: false}))}}
 
/*  <IonSearchbar class="ion-no-padding" debounce={5} ref={searchRef} value={searchState.searchCriteria} inputmode="search" enterkeyhint="enter"
 onKeyDown= {(e) => searchKeyPress(e)}
 onIonInput={(e) => updateSearchCriteria(e)}
 onClick={(e: any) => enterSearchBox(e)} 
 onIonFocus={(e: any) => {console.log("searchbar focused", cloneDeep(e)); setSearchState((prevState) => ({...prevState,isFocused: true}))}}   >
</IonSearchbar>
 */

//               onIonBlur={() => {console.log("searchbar out of focus"); setSearchState((prevState) => ({...prevState,isFocused: false}))}}


  let headerElem=(
    <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton /></IonButtons>
    <IonTitle class="ion-no-padding">
        <IonItem key="listselector">
        <IonSelect label="Items On" aria-label="Items On List:" interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListOrGroupID}  >
            {listCombinedRows.map((listCombinedRow: ListCombinedRow) => (
                <IonSelectOption disabled={listCombinedRow.rowKey=="G-null"} className={listCombinedRow.rowType == RowType.list ? "indented" : ""} key={listCombinedRow.listOrGroupID} value={listCombinedRow.listOrGroupID}>
                  {listCombinedRow.rowName}
                </IonSelectOption>
            ))}
          </IonSelect>
        <SyncIndicator history={props.history}/>  
        </IonItem>
        <IonItem key="searchbar">
          <IonIcon icon={searchOutline} />
          <IonInput aria-label="" class="ion-no-padding" debounce={5} ref={searchRef} value={searchState.searchCriteria} inputmode="search" enterkeyhint="enter"
              clearInput={true} placeholder="Search" fill="solid"
              onKeyDown= {(e) => searchKeyPress(e)}
              onIonInput={(e) => updateSearchCriteria(e)}
              onClick={(e: any) => enterSearchBox(e)} 
              onIonFocus={(e: any) => {console.log("searchbar focused", cloneDeep(e)); setSearchState((prevState) => ({...prevState,isFocused: true, event: e}))}}   >
           </IonInput>
          {/* <IonButton onClick={()=> clickedSearchCheck()}><IonIcon icon={checkmark} /></IonButton> */}
        </IonItem>
        {popOverElem}
        {alertElem}
    </IonTitle></IonToolbar></IonHeader>)

  if (pageState.itemRows.length <=0 )  {return(
    <IonPage>{headerElem}<IonContent><IonItem key="nonefound"><IonLabel key="nothinghere">No Items On List</IonLabel></IonItem></IonContent></IonPage>
  )};  

  let listContent=[];

  function addCurrentRows(listCont: any, curRows: any, catID: string, catName: string, completed: boolean | null) {
    listCont.push(
        <IonItemGroup key={"cat"+catID+Boolean(completed).toString()}>
        <IonItemDivider key={"cat"+catID+Boolean(completed).toString()}>{catName}</IonItemDivider>
          {curRows}
      </IonItemGroup>
    )
  }

  let lastCategoryID : string | null ="<INITIAL>";
  let lastCategoryName="<INITIAL>";
  let lastCategoryFinished: boolean | null = null;
  let currentRows=[];
  let createdFinished=false;
  const completedDivider=(
        <IonItemGroup key="completeddividergroup"><IonItemDivider key="Completed">
        <IonLabel key="completed-divider-label">Completed</IonLabel>
        <IonButton slot="end" onClick={() => deleteCompletedItems(itemDocs as ItemDocs,pageState.selectedListOrGroupID)}>DELETE COMPLETED ITEMS</IonButton>
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
            onIonChange={(e) => completeItemRow(item.itemID,e.detail.checked)}
            checked={Boolean(pageState.itemRows[i].completed)}></IonCheckbox>
        </IonCol>
        <IonCol size="11">
          <IonItem class="item-button" routerLink={"/item/edit/"+item.itemID} key={pageState.itemRows[i].itemID+"mynewbutton"}>{item.itemName + (item.quantityUOMDesc == "" ? "" : " ("+ item.quantityUOMDesc+")")}</IonItem>
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

  if (searchState.isOpen || searchState.isFocused) {
    searchRef.current?.focus();
  }

  return (
    <IonPage>
      {headerElem}
      <IonContent>
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
