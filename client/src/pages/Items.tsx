import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup,
  IonItemDivider, IonButton, IonButtons, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect,
  IonSelectOption, IonSearchbar, IonPopover, IonAlert,IonMenuButton, NavContext, useIonToast} from '@ionic/react';
import { add,checkmark } from 'ionicons/icons';
import React, { useState, useEffect, useContext, useRef, KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Keyboard } from '@capacitor/keyboard';
import { useFind } from 'use-pouchdb';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateCompleted, useUpdateGenericDocument, useLists } from '../components/Usehooks';
import { AddListOptions, GlobalStateContext } from '../components/GlobalState';
import {ItemRow, ItemSearch, SearchState, PageState, ListRow} from '../components/DataTypes'
import { getAllSearchRows, getItemRows, filterSearchRows } from '../components/ItemUtilities';
import SyncIndicator from '../components/SyncIndicator';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { isEqual } from 'lodash';

const Items: React.FC = () => {
  const { remoteDBState} = useContext(RemoteDBStateContext);
  let { id: routeListID  } = useParams<{id: string}>();
  const [searchRows,setSearchRows] = useState<ItemSearch[]>();
  const [searchState,setSearchState] = useState<SearchState>({searchCriteria:"",isOpen: false,isFocused: false,event: undefined, filteredSearchRows: [], dismissEvent: undefined});
  const [pageState, setPageState] = useState<PageState>({selectedListID: routeListID, doingUpdate: false, itemRows: [], showAlert: false, alertHeader: "", alertMessage: ""});
  const searchRef=useRef<HTMLIonSearchbarElement>(null);
  const origSearchCriteria = useRef("");
  const [presentToast] = useIonToast();
  const updateCompleted = useUpdateCompleted();
  const updateItemInList = useUpdateGenericDocument();

  const { docs: itemDocs, loading: itemLoading, error: itemError } = useFind({
    index: {
      fields: ["type","name","lists"]
    },
    selector: {
      type: "item",
      name: { $exists: true },
      lists: { $elemMatch: { "listID": pageState.selectedListID , "active" : true} }
    },
    sort: [ "type", "name", "lists" ]
    })
    const { listDocs, listsLoading, listRows, listRowsLoading} = useLists(String(remoteDBState.dbCreds.dbUsername));
    const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
    })
    const { docs: allItemDocs, loading: allItemsLoading, error: allItemsError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "item", name: { $exists: true}},
      sort: [ "type","name"]
    })

    const {navigate} = useContext(NavContext);
    const { globalState,setGlobalState} = useContext(GlobalStateContext);

    useEffect( () => {
      setPageState(prevState => ({...prevState,selectedListID: routeListID}))
    },[routeListID])

    useEffect( () => {
      if (!itemLoading && !listsLoading && !listRowsLoading && !categoryLoading && !allItemsLoading) {
        setPageState({ ...pageState,
          doingUpdate: false,
          itemRows: getItemRows(itemDocs, listDocs, categoryDocs, pageState.selectedListID),
        })
      }
    },[itemLoading, allItemsLoading, listsLoading, listRowsLoading, categoryLoading, itemDocs, listDocs, allItemDocs, categoryDocs, pageState.selectedListID]);

    useEffect( () => {
      setSearchRows(getAllSearchRows(allItemDocs,pageState.selectedListID));
    },[allItemsLoading, allItemDocs, pageState.selectedListID])

    useEffect( () => {
      let filterRows=filterSearchRows(searchRows, searchState.searchCriteria)
      if (filterRows.length > 0 && searchState.isFocused ) {
        setSearchState(prevState => ({...prevState, filteredSearchRows: filterRows, isOpen: true }));
      } else {
        setSearchState(prevState => ({...prevState, filteredSearchRows: [], isOpen: false}));
      }  
    },[searchState.searchCriteria,searchState.isFocused])

  
  if (itemLoading || listsLoading || listRowsLoading || categoryLoading || allItemsLoading || pageState.doingUpdate )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};  

  function updateSearchCriteria(event: CustomEvent) {
//    console.log("update search criteria, val:",event.detail.value);
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
                                     callingListID: pageState.selectedListID,
                                     newItemName: itemName})
      setSearchState(prevState => ({...prevState, isOpen: false}))
      navigate("/item/new/");
    }
  }
  
  function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
//    console.log("in search key press, ",event);
    if (event.key === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    }
  }

  function clickedSearchCheck() {
    addNewItemToList(origSearchCriteria.current);
  }

  function leaveSearchBox(event: any) {
    origSearchCriteria.current=searchState.searchCriteria;
    setSearchState(prevState => ({...prevState, searchCriteria: "", isOpen: false, isFocused: false}));
  }

  function enterSearchBox(event: any) {
    let toOpen=true;
    if (searchState.filteredSearchRows.length === 0) { toOpen = false}
    setSearchState(prevState => ({...prevState, event: event, isFocused: true,isOpen: toOpen}));
  }

  function isCategoryInList(listID: string, categoryID: string) {
    let listIdx = listDocs.findIndex((el: any) => el._id === listID);
    if (listIdx === -1) {console.log("returning false idx-1"); return false;}
    let catexists= (listDocs[listIdx] as any).categories.includes(categoryID);
    return catexists;
  }

  async function addExistingItemToList(itemID: string) {
    let existingItem: any = cloneDeep(allItemDocs.find((el: any) => el._id === itemID));
    let baseList = listRows.find((el: ListRow) => pageState.selectedListID === el.listDoc._id)
    let baseParticipants = baseList?.participants;
    
    listRows.forEach((listRow: ListRow) => {
      let idxInLists=existingItem.lists.findIndex((el: any) => el.listID === listRow.listDoc._id);
      let skipThisList=false;
      if (!isEqual(listRow.participants,baseParticipants)) {skipThisList = true};
      if (listRow.listDoc._id !== pageState.selectedListID) {
        if (globalState.settings.addListOption == AddListOptions.dontAddAutomatically) {
          skipThisList=true;
        } else if (globalState.settings.addListOption == AddListOptions.addToListsWithCategoryAutomatically) {
          if (!isCategoryInList(listRow.listDoc._id,existingItem.categoryID)) {
            skipThisList=true;
          }
        }
      }
      if (!skipThisList) {
        if (idxInLists === -1) {
          const newListItem={
            listID: pageState.selectedListID,
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
    setSearchState(prevState => ({...prevState, searchCriteria: "", isOpen: false}))
  }

  let popOverElem = (
    <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={(e) => {leaveSearchBox(e)}}>
    <IonContent><IonList key="popoverItemList">
      {(searchState.filteredSearchRows as ItemSearch[]).map((item: ItemSearch) => (
        <IonItem key={pageState.selectedListID+"-poilist-"+item.itemID} onClick={() => chooseSearchItem(item.itemID)}>{item.itemName}</IonItem>
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
        <IonLabel key="listselectlabel">Items on List:</IonLabel>
        <IonSelect interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListID}>
            {listDocs.map((list: any) => (
                <IonSelectOption key={list._id} value={(list as any)._id}>
                  {(list as any).name}
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
    </IonTitle><SyncIndicator /></IonToolbar></IonHeader>)

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
      listID: pageState.selectedListID,
      listRows: listRows
    }
    setPageState(prevState=> ({...prevState,doingUpdate: true}));
    let response=await updateCompleted(updateInfo);
    if (!response.successful) {
      presentToast({message: "Error updating completed status. Please retry", duration: 1500, position: "middle"})
    }
  }

  function selectList(listID: string) {
    setPageState({...pageState, selectedListID: listID, itemRows: getItemRows(itemDocs, listDocs, categoryDocs, listID)});
    navigate('/items/'+listID);
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

  let lastCategoryID="<INITIAL>";
  let lastCategoryName="<INITIAL>";
  let lastCategoryFinished: boolean | null = null;
  let currentRows=[];
  let createdFinished=false;
  const completedDivider=(
        <IonItemGroup key="completeddividergroup"><IonItemDivider key="Completed">
        <IonLabel key="completed-divider-label">Completed</IonLabel>
        <IonButton slot="end" onClick={() => deleteCompletedItems(itemDocs,pageState.selectedListID)}>DELETE COMPLETED ITEMS</IonButton>
        </IonItemDivider></IonItemGroup>);
  for (let i = 0; i < pageState.itemRows.length; i++) {
    const item = pageState.itemRows[i];
    if ((lastCategoryName !== item.categoryName )||(lastCategoryFinished !== item.completed)) { 
      if (currentRows.length > 0) {
        addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName,lastCategoryFinished);
        currentRows=[];
      }
      lastCategoryID = item.categoryID;
      lastCategoryName=item.categoryName;
      lastCategoryFinished=item.completed;   
    }
    currentRows.push(
      <IonItem key={pageState.itemRows[i].itemID} >
        <IonCheckbox slot="start"
            onIonChange={(e: any) => completeItemRow(pageState.itemRows[i].itemID,e.detail.checked)}
            checked={Boolean(pageState.itemRows[i].completed)}></IonCheckbox>
        <IonButton fill="clear" class="textButton" routerLink= {"/item/edit/"+pageState.itemRows[i].itemID}>
          {pageState.itemRows[i].itemName + " ("+ pageState.itemRows[i].quantity.toString()+")"}</IonButton>
      </IonItem>);
    if (lastCategoryFinished && !createdFinished) {
      listContent.push(completedDivider);
      createdFinished=true;
    }    
  }
  addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName,lastCategoryFinished);
  if (!createdFinished) {listContent.push(completedDivider)};
  let contentElem=(<IonList lines="full">{listContent}</IonList>)

  if (searchState.isOpen) {
    searchRef.current?.focus();
  }

  return (
    <IonPage>
      {headerElem}
      <IonContent fullscreen>
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
