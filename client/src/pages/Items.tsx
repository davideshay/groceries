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
import { useUpdateGenericDocument, useCreateGenericDocument, useItems } from '../components/Usehooks';
import { AddListOptions, GlobalStateContext } from '../components/GlobalState';
import { ItemSearch, SearchState, PageState, ListRow, ListCombinedRow, HistoryProps, RowType, ItemSearchType} from '../components/DataTypes'
import { ItemDoc, ItemDocs, ItemListInit, ItemList, ItemDocInit, CategoryDoc, UomDoc, GlobalItemDocs } from '../components/DBSchema';
import { getAllSearchRows, getItemRows, filterSearchRows } from '../components/ItemUtilities';
import SyncIndicator from '../components/SyncIndicator';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';

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
  const globalData = useContext(GlobalDataContext);
  const { dbError: baseItemError, itemRowsLoaded: baseItemRowsLoaded, itemRows: baseItemDocs} = useItems(
      {selectedListGroupID: pageState.groupIDforSelectedList,
        isReady: (pageState.groupIDforSelectedList !== null && pageState.selectedListOrGroupID !== null),
        needListGroupID: true, activeOnly: true, selectedListID: pageState.selectedListOrGroupID,
        selectedListType: pageState.selectedListType});
  const { dbError: baseSearchError, itemRowsLoaded: baseSearchItemRowsLoaded, itemRows: baseSearchItemDocs} = useItems(
    {selectedListGroupID: pageState.groupIDforSelectedList,
      isReady: (pageState.groupIDforSelectedList !== null && pageState.selectedListOrGroupID !== null),
      needListGroupID: true, activeOnly: false, selectedListID: pageState.selectedListOrGroupID,
      selectedListType: pageState.selectedListType});

  const { listError , listDocs, listCombinedRows,listRows, listRowsLoaded } = useContext(GlobalDataContext);
  const { docs: uomDocs, loading: uomLoading, error: uomError } = useFind({
    index: { fields: [ "type","name"]},
    selector: { type: "uom", name: { $exists: true}},
    sort: [ "type","name"] })
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"] });

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
    if (baseItemRowsLoaded && listRowsLoaded && !categoryLoading && !uomLoading && !globalData.globalItemsLoading) {
      setPageState( (prevState) => ({ ...prevState,
        doingUpdate: false,
        itemRows: getItemRows(baseItemDocs as ItemDocs, listCombinedRows, categoryDocs as CategoryDoc[], uomDocs as UomDoc[], pageState.selectedListType, pageState.selectedListOrGroupID)
      }))
    }
  },[baseItemRowsLoaded, listRowsLoaded, categoryLoading, uomLoading, globalData.globalItemsLoading, uomDocs, baseItemDocs, listCombinedRows, categoryDocs, pageState.selectedListOrGroupID]);

  useEffect( () => {
    if (baseSearchItemRowsLoaded && !globalData.globalItemsLoading) {
      setSearchState(prevState => ({...prevState,isOpen: false, isFocused: false}));
      setSearchRows(getAllSearchRows(baseSearchItemDocs as ItemDocs,pageState.selectedListOrGroupID, listDocs, globalData.globalItemDocs as GlobalItemDocs));
    }
  },[baseSearchItemRowsLoaded, globalData.globalItemsLoading, globalData.globalItemDocs, baseSearchItemDocs, pageState.selectedListOrGroupID])

  function filterAndCheckRows() {
    let filterRows=filterSearchRows(searchRows, searchState.searchCriteria)
//    if (filterRows.length > 0 ) {
    if (filterRows.length > 0 && searchState.isFocused ) {
      setSearchState(prevState => ({...prevState, filteredSearchRows: filterRows, isOpen: true }));
    } else {
      setSearchState(prevState => ({...prevState, filteredSearchRows: [], isOpen: false}));
    }
  }


  useEffect( () => {
    filterAndCheckRows();
  },[searchRows,searchState.searchCriteria,searchState.isFocused])

  if (baseItemError || baseSearchError || listError || categoryError  || uomError || globalData.globalItemError) {return (
    <ErrorPage errorText="Error Loading Items Information... Restart."></ErrorPage>
  )}

  if (!baseItemRowsLoaded || !baseSearchItemRowsLoaded || !listRowsLoaded || categoryLoading || globalData.globalItemsLoading || uomLoading || pageState.doingUpdate )  {
    return ( <Loading isOpen={screenLoading.current} message="Loading Items..."    /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };

  screenLoading.current=false;

  function updateSearchCriteria(event: CustomEvent) {
    setSearchState(prevState => ({...prevState, event: event, searchCriteria: event.detail.value}));
    origSearchCriteria.current=event.detail.value;
  }

  function isItemAlreadyInList(itemName: string): boolean {
    let existingItem = (baseItemDocs as ItemDocs).find((el) => el.name.toUpperCase() === itemName.toUpperCase());
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
      setSearchState(prevState => ({...prevState, isOpen: false,searchCriteria:"",isFocused: false}))
      props.history.push("/item/new/");
    }
  }

  function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
    console.log("search key press: ",event.key);
    if (event.key === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    }
  }

  function clickedSearchCheck() {
    addNewItemToList(origSearchCriteria.current);
  }

  function leaveSearchBox() {
    origSearchCriteria.current=searchState.searchCriteria;
    setSearchState(prevState => ({...prevState, isOpen: false, isFocused: false}));
  }

  function enterSearchBox(event: Event) {
    let toOpen=true;
//    filterAndCheckRows();
//    if (searchState.filteredSearchRows.length === 0) { toOpen = false}
    setSearchState(prevState => ({...prevState, event: event, isFocused: true,isOpen: true}));
  }

  function isCategoryInList(listID: string, categoryID: string) {
    let listIdx = listRows.findIndex(el => el.listDoc._id === listID);
    if (listIdx === -1) {return false;}
    let catexists= listRows[listIdx].listDoc.categories.includes(categoryID);
    return catexists;
  }

  async function addExistingItemToList(item: ItemSearch) {
    const testItemDoc = baseItemDocs.find((id) => (id._id === item.itemID));
    if (testItemDoc !== undefined) {presentToast({message: "Trying to add duplicate item... Error.", duration: 1500, position: "middle"}); return}
    if (item.itemType == ItemSearchType.Global) {
      let newItem: ItemDoc = cloneDeep(ItemDocInit);
      newItem.globalItemID = item.globalItemID;
      newItem.listGroupID = pageState.groupIDforSelectedList;
      newItem.name = item.itemName;
      listRows.forEach((lr) => {
        if (lr.listGroupID == pageState.groupIDforSelectedList) {
          let newItemList: ItemList = cloneDeep(ItemListInit);
          newItemList.listID = String(lr.listDoc._id);
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
    let existingItem: ItemDoc = cloneDeep((baseSearchItemDocs as ItemDocs).find((el) => el._id === item.itemID));
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
              if (!isCategoryInList(String(listRow.listDoc._id),String(currItemListCategory))) {
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
          newListItem.listID = String(listRow.listDoc._id);
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
    let itemDoc: ItemDoc = cloneDeep(baseItemDocs.find(element => (element._id === id)))
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
      if (!response.successful) {
        presentToast({message: "Error updating completed status. Please retry", duration: 1500, position: "middle"})
      }
    }
  }

  function selectList(listOrGroupID: string) {
    if (listOrGroupID == "null" ) { console.log("ungrouped selected");  return }
    let combinedRow: ListCombinedRow | undefined = listCombinedRows.find(lcr => lcr.listOrGroupID == listOrGroupID);
    let newListType: RowType = combinedRow!.rowType;
    setPageState({...pageState, selectedListOrGroupID: listOrGroupID, selectedListType: newListType, itemRows: getItemRows(baseItemDocs as ItemDocs, listCombinedRows, categoryDocs as CategoryDoc[], uomDocs as UomDoc[], newListType, listOrGroupID)});
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
        let itemUpdated = false;
        for (let i = 0; i < updatedItem.lists.length; i++) {
          let willUpdate = (updatedItem.lists[i].listID == listID || globalState.settings.completeFromAllLists) && updatedItem.lists[i].completed;
          if (!willUpdate) {continue}
          console.log("did update to list...");
          updatedItem.lists[i].active = false;
          itemUpdated = true;
        }
        if (itemUpdated) {
          let result = await updateItemInList(updatedItem);
          console.log("results of updateItemInList...",result);
          if (!result.successful) {
            presentToast({message: "Error deleting items from list. Please retry.",
              duration: 1500, position: "middle"})
          }          
        }
    });
  }

  let popOverElem = (
    <IonPopover side="bottom" trigger="itemsearchbox" isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={(e) => {leaveSearchBox()}}>
    <IonContent><IonList key="popoverItemList">
      {(searchState.filteredSearchRows as ItemSearch[]).map((item: ItemSearch) => (
        <IonItem button key={pageState.selectedListOrGroupID+"-poilist-"+item.itemID} onClick={(e) => {chooseSearchItem(item)}}>{item.itemName}</IonItem>
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
    <IonTitle class="ion-no-padding">
        <IonItem key="listselector">
        <IonSelect label="Items On" aria-label="Items On List:" interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListOrGroupID}  >
            {listCombinedRows.map((listCombinedRow: ListCombinedRow) => (
                <IonSelectOption disabled={listCombinedRow.rowKey=="G-null"} className={listCombinedRow.rowType == RowType.list ? "indented" : ""} key={listCombinedRow.listOrGroupID} value={listCombinedRow.listOrGroupID}>
                  {listCombinedRow.rowName}
                </IonSelectOption>
            ))}
          </IonSelect>
        <SyncIndicator />
        </IonItem>
        <IonItem key="searchbar">
          <IonIcon icon={searchOutline} />
          <IonInput id="itemsearchbox" aria-label="" class="ion-no-padding" debounce={5} ref={searchRef} value={searchState.searchCriteria} inputmode="text" enterkeyhint="enter"
              clearInput={true} placeholder="Search" fill="solid"
              onKeyDown= {(e) => searchKeyPress(e)}
              onIonInput={(e) => updateSearchCriteria(e)}
              onClick={(e: any) => enterSearchBox(e)}
              onIonFocus={(e: any) => {/* setSearchState((prevState) => ({...prevState,isFocused: true, event: e})) */}}   >
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
        <IonItemDivider class="category-divider" key={"cat"+catID+Boolean(completed).toString()}>{catName}</IonItemDivider>
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
        <IonButton slot="end" onClick={() => deleteCompletedItems(baseItemDocs as ItemDocs,pageState.selectedListOrGroupID)}>DELETE COMPLETED ITEMS</IonButton>
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
