import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup,
  IonItemDivider, IonButton, IonButtons, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect,
  IonSelectOption, IonInput, IonPopover, IonAlert,IonMenuButton, useIonToast, IonGrid, IonRow, 
  IonCol, useIonAlert } from '@ionic/react';
import { add,searchOutline } from 'ionicons/icons';
import React, { useState, useEffect, useContext, useRef, KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateGenericDocument, useCreateGenericDocument, useItems } from '../components/Usehooks';
import { GlobalStateContext } from '../components/GlobalState';
import { AddListOptions } from '../components/DBSchema';
import { ItemSearch, SearchState, PageState, ListCombinedRow, HistoryProps, RowType, ItemSearchType} from '../components/DataTypes'
import { ItemDoc, ItemDocs, ItemListInit, ItemList, ItemDocInit, CategoryDoc, UomDoc, GlobalItemDocs } from '../components/DBSchema';
import { getAllSearchRows, getItemRows, filterSearchRows } from '../components/ItemUtilities';
import SyncIndicator from '../components/SyncIndicator';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { translatedItemName } from '../components/translationUtilities';

const Items: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode: routeMode, id: routeListID  } = useParams<{mode: string, id: string}>();
  const [searchRows,setSearchRows] = useState<ItemSearch[]>();
  const [searchState,setSearchState] = useState<SearchState>({searchCriteria:"",isOpen: false,isFocused: false, filteredSearchRows: [], dismissEvent: undefined});
  const [pageState, setPageState] = useState<PageState>({selectedListOrGroupID: routeListID,
          selectedListType: (routeMode === "list" ? RowType.list : RowType.listGroup) ,
          ignoreCheckOffWarning: false,
          groupIDforSelectedList: null,
          doingUpdate: false, itemRows: [], showAlert: false, alertHeader: "", alertMessage: ""});
  const searchRef=useRef<HTMLIonInputElement>(null);
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
  const { listError , listDocs, listCombinedRows,listRows, listRowsLoaded, uomDocs, uomLoading, uomError, categoryDocs, categoryLoading, categoryError, itemDocs } = useContext(GlobalDataContext);
  const { globalState,setStateInfo: setGlobalStateInfo} = useContext(GlobalStateContext);
  const {t} = useTranslation();

  function getGroupIDForList(listID: string): string | null {
    if (routeMode === "group") { return pageState.selectedListOrGroupID};
    let retGID = null;
    for (let i = 0; i < listRows.length; i++) {
      if (listRows[i].listDoc._id === listID) { retGID=String(listRows[i].listGroupID); break}
    }
    return retGID;
  }

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListOrGroupID: routeListID, selectedListType: (routeMode === "group" ? RowType.listGroup : RowType.list)}))
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
  },[baseItemRowsLoaded, listRowsLoaded, categoryLoading, uomLoading, globalData.globalItemsLoading,
    uomDocs, baseItemDocs, listCombinedRows, categoryDocs, pageState.selectedListOrGroupID, pageState.selectedListType]);

  useEffect( () => {
    if (baseSearchItemRowsLoaded && !globalData.globalItemsLoading) {
      setSearchState(prevState => ({...prevState,isOpen: false, isFocused: false}));
      setSearchRows(getAllSearchRows(baseSearchItemDocs as ItemDocs,pageState.selectedListOrGroupID, pageState.selectedListType, listDocs, globalData.globalItemDocs as GlobalItemDocs));
    }
  },[baseSearchItemRowsLoaded, globalData.globalItemsLoading, globalData.globalItemDocs, baseSearchItemDocs, pageState.selectedListOrGroupID, pageState.selectedListType, listDocs])

  function filterAndCheckRows(searchCriteria: string, setFocus : boolean) {
    let filterRows=filterSearchRows(searchRows, searchCriteria)
    let toOpen=true;
    if (filterRows.length === 0 || !setFocus) {
      toOpen=false;
    }
    let toFocus=setFocus;
    if (toOpen) { toFocus = true};
    setSearchState(prevState => ({...prevState, searchCriteria: searchCriteria, filteredSearchRows: filterRows, isOpen: toOpen, isFocused: toFocus }));
  }

  useEffect( () => {
    filterAndCheckRows(searchState.searchCriteria,searchState.isFocused);
  },[searchRows,searchState.isFocused])

  if (baseItemError || baseSearchError || listError || categoryError  || uomError || globalData.globalItemError) {return (
    <ErrorPage errorText={t("general.loading_item_info_restart") as string}></ErrorPage>
  )}

  if (!baseItemRowsLoaded || !baseSearchItemRowsLoaded || !listRowsLoaded || categoryLoading || globalData.globalItemsLoading || uomLoading || pageState.doingUpdate )  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_items")} /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };

  screenLoading.current=false;

  function updateSearchCriteria(event: CustomEvent) {
    let toOpen=true;
    if (event.detail.value.length === 0) {toOpen = false}
    setSearchState(prevState => ({...prevState, isFocused: true}));
    filterAndCheckRows(event.detail.value,true)
  }

  function isItemAlreadyInList(itemName: string): boolean {
    let existingItem = (baseItemDocs as ItemDocs).find((el) => el.name.toUpperCase() === itemName.toUpperCase());
    return(!(existingItem === undefined));
  }

  function addNewItemToList(itemName: string) {
    if (isItemAlreadyInList(itemName)) {
      setPageState(prevState => ({...prevState, showAlert: true, alertHeader: t("error.adding_to_list") , alertMessage: t("error.item_exists_current_list")}))
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
    if (event.key === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    }
  }

  function leaveSearchBox() {
    setSearchState(prevState => ({...prevState, isOpen: false, isFocused: false}));
  }

  function enterSearchBox() {
    let toOpen=true;
    if (searchState.filteredSearchRows.length === 0) { toOpen = false}
    setSearchState(prevState => ({...prevState, isFocused: true,isOpen: toOpen}));
  }

  function shouldBeActive(itemList: ItemList, newRow: boolean): boolean {
    if (!newRow && !itemList.stockedAt) {
      if (pageState.selectedListType === RowType.list && itemList.listID === pageState.selectedListOrGroupID) {
        return true;
      } else {
        return false;
      }
    }
    if (globalState.settings.addListOption === AddListOptions.dontAddAutomatically) {
      if (pageState.selectedListType === RowType.listGroup) {
         return true;
      } else {
        if (newRow) {
          return (itemList.listID === pageState.selectedListOrGroupID)
        } else {
          return itemList.active || (itemList.listID === pageState.selectedListOrGroupID)
        }
      }
    }
    if (globalState.settings.addListOption === AddListOptions.addToAllListsAutomatically) {
      return true;
    } 
    // Add list option = by category
    if (pageState.selectedListType === RowType.list) {
      if (itemList.listID === pageState.selectedListOrGroupID) {
        return true;
      }
    }
    // add by category mode, either in listgroup mode or are in list mode and we are on a different list
    if (itemList.categoryID === null) { return true}
    let matchingListRow = listRows.find((lr) => lr.listDoc._id === itemList.listID)
    if (matchingListRow === undefined) {return false}
    if (matchingListRow.listDoc.categories.includes(String(itemList.categoryID))) {
      return true;
    }
    return false;
  }


  async function addExistingItemToList(itemSearch: ItemSearch) {

    /*  scenarios:
      
    Item exist check:
      if global item, check for same name or same globalitemID in listgroup
      If local item, check for same name or item id in listgroup

      * Item exists
          * Item is active on all lists -- error
          * Item is active on no lists -- in listgroup, update all to active, in list, check setting, same as below
          * Item is active on some lists -- in listgroup mode, update item to active on all
                                            in list mode, depending on setting to "add to all", update item to active on all or just one
      * Item does not exist
          * Add item, set to active based on listgroup mode/list selected -- data comes from global item if needed
 */

    let testItemDoc: ItemDoc | undefined = undefined;
    testItemDoc = cloneDeep(itemDocs.find((item) => ((item._id === itemSearch.itemID && item.listGroupID === pageState.groupIDforSelectedList) || 
              (item.name === itemSearch.itemName && item.listGroupID === pageState.groupIDforSelectedList))) );

    const addingNewItem = (testItemDoc === undefined);

    if (!addingNewItem) {
      if (testItemDoc!.lists.filter(il => il.active).length === testItemDoc!.lists.length) {
        presentToast({message: t("error.item_exists_current_list"), duration: 1500, position: "middle"});
        return;
      }
    }
    
    let newItem: ItemDoc = cloneDeep(ItemDocInit);
    if (addingNewItem) {
      if (itemSearch.itemType === ItemSearchType.Global) {
        newItem.globalItemID = itemSearch.globalItemID;
        newItem.listGroupID = pageState.groupIDforSelectedList;
        newItem.name = itemSearch.itemName;
        listRows.forEach((lr) => {
          if (lr.listGroupID === pageState.groupIDforSelectedList) {
            let newItemList: ItemList = cloneDeep(ItemListInit); // sets to active true by default
            newItemList.listID = String(lr.listDoc._id);
            newItemList.categoryID = itemSearch.globalItemCategoryID;
            newItemList.uomName = itemSearch.globalItemUOM;
            newItemList.quantity = 1;
            newItemList.active = shouldBeActive(newItemList,true);
            newItem.lists.push(newItemList);
          }
        })
      }  
      else { 
        newItem.globalItemID = null;
        newItem.listGroupID = pageState.groupIDforSelectedList;
        newItem.name = itemSearch.itemName;
        listRows.forEach((lr) => {
          if (lr.listGroupID === pageState.groupIDforSelectedList) {
            let newItemList: ItemList = cloneDeep(ItemListInit);
            newItemList.listID = String(lr.listDoc._id);
            newItemList.quantity = 1;
            newItemList.active = shouldBeActive(newItemList,true);
            newItem.lists.push(newItemList);
          }
        })
      }  
      let itemAdded = await addNewItem(newItem);
      if (!itemAdded.successful) {
        presentToast({message: t("error.adding_item"),duration: 1500, position: "middle"});
      }
      return;
    }

// Finished adding new item where it didn't exist. Now update existing item, active on no or some lists
    let origLists = cloneDeep(testItemDoc!.lists);
    testItemDoc!.lists.forEach(il => {
      il.active = shouldBeActive(il,false);
      if (il.active) { il.completed = false;}
    })
    if (!isEqual(origLists,testItemDoc!.lists)) {
      let result = await updateItemInList(testItemDoc);
      if (!result.successful) {
        presentToast({message: t("error.updating_item"),duration: 1500, position: "middle"});
      }
    }
  }

  function chooseSearchItem(item: ItemSearch) {
    addExistingItemToList(item);
    setSearchState(prevState => ({...prevState, searchCriteria: "", filteredRows: [],isOpen: false, isFocused: false}))
  }

  async function completeItemRow(id: String, newStatus: boolean | null) {
    if (pageState.selectedListType === RowType.listGroup && !pageState.ignoreCheckOffWarning) {
       await presentAlert({
        header: t("error.checking_items_list_group_header"),
        subHeader: t("error.checking_items_list_group_detail"),
        buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                    handler: () => dismissAlert()},
                    { text: t("general.continue_ignore"), role: "confirm",
                    handler: () => {setPageState(prevState => ({...prevState,ignoreCheckOffWarning: true})); dismissAlert()}}]
      })
    }
    // make the update in the database, let the refresh of the view change state
    let itemDoc: ItemDoc = cloneDeep(baseItemDocs.find(element => (element._id === id)))
    setPageState(prevState=> ({...prevState,doingUpdate: true}));
    let listChanged=false;
    itemDoc.lists.forEach((list: ItemList) => {
      let updateThisList=false;
      if (pageState.selectedListOrGroupID === list.listID) { updateThisList = true;}
      if (pageState.selectedListType === RowType.listGroup) { updateThisList = true};
      if (pageState.selectedListType === RowType.list &&
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
        presentToast({message: t("error.updating_item_completed"), duration: 1500, position: "middle"})
      }
    }
  }

  function selectList(listOrGroupID: string) {
    if (listOrGroupID === "null" ) { return }
    let combinedRow: ListCombinedRow | undefined = listCombinedRows.find(lcr => lcr.listOrGroupID === listOrGroupID);
    let newListType: RowType = combinedRow!.rowType;
    setPageState({...pageState, selectedListOrGroupID: listOrGroupID, selectedListType: newListType, itemRows: getItemRows(baseItemDocs as ItemDocs, listCombinedRows, categoryDocs as CategoryDoc[], uomDocs as UomDoc[], newListType, listOrGroupID)});
    if (combinedRow === undefined) {return};
    if (combinedRow.rowType === RowType.list) {
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
          let willUpdate = (updatedItem.lists[i].listID === listID || globalState.settings.completeFromAllLists) && updatedItem.lists[i].completed;
          if (!willUpdate) {continue}
          updatedItem.lists[i].active = false;
          itemUpdated = true;
        }
        if (itemUpdated) {
          let result = await updateItemInList(updatedItem);
          if (!result.successful) {
            presentToast({message: t("error.deleting_items_list"),
              duration: 1500, position: "middle"})
          }          
        }
    });
  }

  let popOverElem = (
    <IonPopover side="bottom" trigger="item-search-box-id" isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={(e) => {leaveSearchBox()}}>
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
    <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton class={"ion-no-padding small-menu-button"} /></IonButtons>
    <IonTitle class="ion-no-padding item-outer"></IonTitle>
        <IonItem id="item-list-selector-id" class="item-list-selector" key="listselector">
        <IonSelect id="select-list-selector-id" class="select-list-selector" label={t("general.items_on") as string} aria-label={t("general.items_on") as string} interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListOrGroupID}  >
            {listCombinedRows.map((listCombinedRow: ListCombinedRow) => (
                <IonSelectOption disabled={listCombinedRow.rowKey==="G-null"} className={listCombinedRow.rowType === RowType.list ? "indented" : ""} key={listCombinedRow.listOrGroupID} value={listCombinedRow.listOrGroupID}>
                  {listCombinedRow.rowName}
                </IonSelectOption>
            ))}
          </IonSelect>
        <SyncIndicator />
        </IonItem>
        <IonItem key="searchbar" class="item-search">
           <IonIcon icon={searchOutline} />
           <IonInput id="item-search-box-id" aria-label="" class="ion-no-padding input-search" debounce={5} ref={searchRef} value={searchState.searchCriteria} inputmode="text" enterkeyhint="enter"
              clearInput={true}  placeholder={t("general.search") as string} fill="solid"
              onKeyDown= {(e) => searchKeyPress(e)}
              onIonInput={(e) => updateSearchCriteria(e)}
              onClick={() => enterSearchBox()}
/*                Not sure why, but when you have this specific setsearchstate, it captures the click on the item in the popover and nothing works /*
/*               onIonBlur={(e) => { setSearchState(prevState => ({...prevState,isFocused: false}))}} */           >   
           </IonInput>
          {/* <IonButton onClick={()=> clickedSearchCheck()}><IonIcon icon={checkmark} /></IonButton> */}
        </IonItem>
        {popOverElem}
        {alertElem}
    </IonToolbar></IonHeader>)

  if (globalData.listRows.length <=0) {return(
    <IonPage>{headerElem}<IonContent><IonItem key="nonefound"><IonLabel key="nothinghere">{t("error.please_create_list_before_adding_items")}</IonLabel></IonItem></IonContent></IonPage>
  )};

  if (pageState.itemRows.length <=0 )  {return(
    <IonPage>{headerElem}<IonContent><IonItem key="nonefound"><IonLabel key="nothinghere">{t("error.no_items_on_list")}</IonLabel></IonItem></IonContent></IonPage>
  )};

  let listContent=[];

  function addCurrentRows(listCont: JSX.Element[], curRows: JSX.Element[], catID: string, catName: string, completed: boolean | null) {
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
        <IonLabel key="completed-divider-label">{t("general.completed")}</IonLabel>
        <IonButton slot="end" onClick={() => deleteCompletedItems(baseItemDocs as ItemDocs,pageState.selectedListOrGroupID)}>{t("general.delete_completed_items")}</IonButton>
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
      <IonItem class="itemrow-outer" key={pageState.itemRows[i].itemID} >
        <IonGrid class="grid-no-pad"><IonRow>
        <IonCol class="col-no-pad" size="1">
        <IonCheckbox aria-label=""
            onIonChange={(e) => completeItemRow(item.itemID,e.detail.checked)}
            checked={Boolean(pageState.itemRows[i].completed)}></IonCheckbox>
        </IonCol>
        <IonCol class="col-no-pad" size="11">
          <IonItem class="itemrow-inner" routerLink={"/item/edit/"+item.itemID} key={pageState.itemRows[i].itemID+"mynewbutton"}>{item.itemName + (item.quantityUOMDesc === "" ? "" : " ("+ item.quantityUOMDesc+")")}</IonItem>
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
