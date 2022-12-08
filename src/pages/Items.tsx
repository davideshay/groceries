import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup,
  IonItemDivider, IonButton, IonButtons, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect,
  IonSelectOption, IonSearchbar, IonPopover, IonMenuButton, NavContext} from '@ionic/react';
import { add,checkmark } from 'ionicons/icons';
import React, { useState, useEffect, useContext, useRef, KeyboardEvent } from 'react';
import { RouteComponentProps, useParams } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateCompleted, useUpdateGenericDocument, useCreateGenericDocument } from '../components/itemhooks';
import { createEmptyItemDoc} from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';
import {ItemRow, ItemSearch, SearchState, PageState} from '../components/DataTypes'
import { getAllSearchRows, getItemRows, filterSearchRows } from '../components/ItemUtilities';

const Items: React.FC = () => {

  let { id: routeListID  } = useParams<{id: string}>();
  const [searchRows,setSearchRows] = useState<ItemSearch[]>();
  const [searchState,setSearchState] = useState<SearchState>({searchCriteria:"",isOpen: false,event: undefined, filteredSearchRows: [], dismissEvent: undefined});
  const [pageState, setPageState] = useState<PageState>({selectedListID: routeListID, doingUpdate: false, itemRows: []});
  const searchRef=useRef<HTMLIonSearchbarElement>(null);
  
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
    const { docs: listDocs, loading: listLoading, error: listError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "list", name: { $exists: true}},
      sort: [ "type","name"]
    })
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
    const { globalState,setGlobalState,setStateInfo} = useContext(GlobalStateContext);

    useEffect( () => {
      console.log("Route list ID changed");
      setPageState(prevState => ({...prevState,selectedListID: routeListID}))
    },[routeListID])

    useEffect( () => {
      if (!itemLoading && !listLoading && !categoryLoading && !allItemsLoading) {
        setPageState({ ...pageState,
          doingUpdate: false,
          itemRows: getItemRows(itemDocs, listDocs, categoryDocs, pageState.selectedListID),
        })
      }
    },[itemLoading, allItemsLoading, listLoading, categoryLoading, itemDocs, listDocs, allItemDocs, categoryDocs, pageState.selectedListID]);

    useEffect( () => {
      setSearchRows(getAllSearchRows(allItemDocs,pageState.selectedListID));
    },[allItemsLoading, allItemDocs, pageState.selectedListID])

    useEffect( () => {
      setSearchState({...searchState, filteredSearchRows: filterSearchRows(searchRows, searchState.searchCriteria)});
    },[searchState.searchCriteria])

  
  if (itemLoading || listLoading || categoryLoading || allItemsLoading || pageState.doingUpdate )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};  

  function updateSearchCriteria(event: CustomEvent) {
    setSearchState({...searchState,isOpen: (event.detail.value === "") ? false: true , event: event, searchCriteria: event.detail.value});
  }  

  function addNewItemToList(itemName: string) {
    let newItemDoc=createEmptyItemDoc(listDocs,pageState.selectedListID,itemName);
    let  newglobalState=cloneDeep(globalState);
    setGlobalState({...globalState, itemMode: "new",
                                     callingListID: pageState.selectedListID,
                                     newItemName: itemName})
    setSearchState({...searchState, isOpen: false})
    navigate("/item/new/");
  }

  function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
    if (event.code === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    } 
  }

  function addExistingItemToList(itemID: string) {
    let existingItem: any = cloneDeep(allItemDocs.find((el: any) => el._id === itemID));
    let idxInLists=existingItem.lists.findIndex((el: any) => el.listID === pageState.selectedListID);
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
    updateItemInList(existingItem);
  }

  function chooseSearchItem(itemID: string) {
    addExistingItemToList(itemID);
    setSearchState({...searchState, searchCriteria: "", isOpen: false})
  }

  let popOverElem = (
    <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={() => {setSearchState({...searchState, isOpen: false, searchCriteria: ""})}}>
    <IonContent><IonList key="popoverItemList">
      {(searchState.filteredSearchRows as ItemSearch[]).map((item: ItemSearch) => (
        <IonItem key={pageState.selectedListID+"-poilist-"+item.itemID} onClick={() => chooseSearchItem(item.itemID)}>{item.itemName}</IonItem>
      ))}
    </IonList></IonContent>
    </IonPopover>
  )

  let headerElem=(
    <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton /></IonButtons>
    <IonTitle>
        <IonItem key="listselector">
        <IonLabel key="listselectlabel">Items on List:</IonLabel>
        <IonSelect interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListID}>
            {listDocs.map((list) => (
                <IonSelectOption key={list._id} value={(list as any)._id}>
                  {(list as any).name}
                </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem key="searchbar">
          <IonSearchbar ref={searchRef} value={searchState.searchCriteria} onKeyPress= {(e: any) => searchKeyPress(e)} onIonChange={(e: any) => updateSearchCriteria(e)}>
          </IonSearchbar>
          <IonButton><IonIcon icon={checkmark} /></IonButton>
        </IonItem>
        {popOverElem}
    </IonTitle></IonToolbar></IonHeader>)

  if (pageState.itemRows.length <=0 )  {return(
    <IonPage>{headerElem}<IonContent><IonItem key="nonefound"><IonLabel key="nothinghere">No Items On List</IonLabel></IonItem></IonContent></IonPage>
  )};  

  function completeItemRow(id: String, newStatus: boolean | null) {
    let newItemRows: Array<ItemRow>=cloneDeep(pageState.itemRows);
    let itemSeq = newItemRows.findIndex(element => (element.itemID === id))
    newItemRows[itemSeq].completed = newStatus;
    // get itemdoc from itemDocs
    let itemDoc = itemDocs.find(element => (element._id === id))
    let updateInfo = {
      itemDoc: itemDoc,
      updateAll: true,
      newStatus: newStatus,
      listID: pageState.selectedListID
    }
    setPageState({...pageState, itemRows: newItemRows, doingUpdate: true});
    updateCompleted(updateInfo);
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

  function deleteCompletedItems(itemDocs: any,listID: string) {
    itemDocs.forEach((itemDoc: any) => {
        let updatedItem=cloneDeep(itemDoc);
        let listItemIdx=updatedItem.lists.findIndex((el: any) => el.listID === listID);
        if ((listItemIdx !== -1)) {
            if (updatedItem.lists[listItemIdx].completed) {
                updatedItem.lists[listItemIdx].active = false;
                updateItemInList(updatedItem);
            }    
        }
    });
  }

  let lastCategorySeq=-2;
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
    if ((lastCategorySeq !== item.categorySeq )||(lastCategoryFinished !== item.completed)) { 
      if (currentRows.length > 0) {
        addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName,lastCategoryFinished);
        currentRows=[];
      }
      lastCategorySeq = item.categorySeq;
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
        <IonFabButton>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Items;
