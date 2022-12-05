import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup,
  IonItemDivider, IonButton, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect,
  IonSelectOption, IonSearchbar, IonPopover, NavContext} from '@ionic/react';
import { add,checkmark } from 'ionicons/icons';
import React, { useState, useEffect, useContext, useRef, KeyboardEvent } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateCompleted, useUpdateGenericDocument, useCreateGenericDocument } from '../components/itemhooks';
import { createEmptyItemDoc} from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';

interface ItemsPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Items: React.FC<ItemsPageProps> = ({ match }) => {

  interface ItemRow {
    itemID: string,
    itemName: string,
    categoryID: string,
    categoryName: string,
    categorySeq: number,
    quantity: number,
    completed: boolean | null
  }

  interface ItemSearch {
    itemID: string
    itemName: string
    quantity: number
    boughtCount: number
  }

  interface SearchState {
    searchCriteria: string,
    isOpen: boolean,
    event: Event | undefined,
    filteredSearchRows: Array<ItemSearch>,
    dismissEvent: CustomEvent | undefined
  }

  interface PageState {
    selectedListID: string,
    doingUpdate: boolean,
    itemRows: Array<ItemRow>,
  }

  const [searchRows,setSearchRows] = useState<ItemSearch[]>();
  const [searchState,setSearchState] = useState<SearchState>({searchCriteria:"",isOpen: false,event: undefined, filteredSearchRows: [], dismissEvent: undefined});
  const [pageState, setPageState] = useState<PageState>({selectedListID: match.params.id, doingUpdate: false, itemRows: []});
  const searchRef=useRef<HTMLIonSearchbarElement>(null);
  
  const updateCompleted = useUpdateCompleted();
  const updateItemInList = useUpdateGenericDocument();
  const addNewItem = useCreateGenericDocument();
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
      if (!itemLoading && !listLoading && !categoryLoading && !allItemsLoading) {
        setPageState({ ...pageState,
          doingUpdate: false,
          itemRows: getItemRows(pageState.selectedListID),
        })
      }
    },[itemLoading, allItemsLoading, listLoading, categoryLoading, itemDocs, listDocs, allItemDocs, categoryDocs, pageState.selectedListID, match.params.id]);

    useEffect( () => {
      setSearchRows(getAllSearchRows());
    },[allItemsLoading, allItemDocs, pageState.selectedListID])

    function getAllSearchRows(): ItemSearch[] {
      let searchRows: ItemSearch[] = [];
      allItemDocs.forEach((itemDoc: any) => {
        let searchRow: ItemSearch = {
          itemID: itemDoc._id,
          itemName: itemDoc.name,
          quantity: itemDoc.quantity,
          boughtCount: 0
        }
        let list=itemDoc.lists.find((el: any) => el.listID === pageState.selectedListID)
        if (list) {searchRow.boughtCount=list.boughtCount}
        searchRows.push(searchRow);
      })
      return searchRows;
    }

    function getItemRows(listID: string) {
      let itemRows: Array<ItemRow> =[];
      let listDoc=listDocs.find(el => el._id === listID);
      itemDocs.forEach((itemDoc: any) => {
        let itemRow: ItemRow = {
          itemID:"",
          itemName:"",
          categoryID: "",
          categoryName: "",
          categorySeq: 0,
          quantity: 0,
          completed: false
        };
        itemRow.itemID = itemDoc._id;
        itemRow.itemName = itemDoc.name;
        itemRow.categoryID = itemDoc.categoryID;
        if (itemRow.categoryID == null) {
          itemRow.categoryName = "Uncategorized";
          itemRow.categorySeq = -1
        } else {
          itemRow.categoryName = (categoryDocs.find(element => (element._id === itemDoc.categoryID)) as any).name;
          itemRow.categorySeq = ((listDoc as any).categories.findIndex((element: any) => (element === itemDoc.categoryID)));  
        }
        itemRow.quantity = itemDoc.quantity;
        const listIdx = itemDoc.lists.findIndex((element: any) => (element.listID === listID))
        if (listIdx === -1) {itemRow.completed=false} else {
          itemRow.completed = itemDoc.lists[listIdx].completed;
        }  
        itemRows.push(itemRow);
      })
    
      itemRows.sort((a,b) => (
        (Number(a.completed) - Number(b.completed)) || (a.categorySeq - b.categorySeq) ||
        (a.itemName.localeCompare(b.itemName))
      ))
      return (itemRows)
    }
  
  if (itemLoading || listLoading || categoryLoading || allItemsLoading || pageState.doingUpdate )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};  

  function updateSearchCriteria(event: CustomEvent) {
    setSearchState({...searchState,isOpen: (event.detail.value === "") ? false: true , event: event, searchCriteria: event.detail.value});
  }  

  function addNewItemToList(itemName: string) {
    let newItemDoc=createEmptyItemDoc(listDocs,pageState.selectedListID,itemName);
    console.log("in add New Item To List, setting state");
    let  newglobalState=cloneDeep(globalState);
    setGlobalState({...globalState, itemMode: "new",
                                     callingListID: pageState.selectedListID,
                                     newItemName: itemName})
    setSearchState({...searchState, isOpen: false})
    navigate("/item/new/");
//    addNewItem(newItemDoc);
  }

  function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
    if (event.code === "Enter") {
      addNewItemToList(searchState.searchCriteria)
    } 
  }

  function addExistingItemToList(itemID: string) {
    console.log("adding itemID to list", itemID);
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
    console.log("from list selected:", itemID)
    addExistingItemToList(itemID);
    setSearchState({...searchState, searchCriteria: "", isOpen: false})
  }


  let popOverElem = (
    <IonPopover side="bottom" event={searchState.event} isOpen={searchState.isOpen} keyboardClose={false} onDidDismiss={() => {setSearchState({...searchState, isOpen: false, searchCriteria: ""}); console.log("dismissing")}}>
    <IonContent><IonList key="popoverItemList">
      {(searchRows as ItemSearch[]).map((item: ItemSearch) => (
        <IonItem key={pageState.selectedListID+"-poilist-"+item.itemID} onClick={() => chooseSearchItem(item.itemID)}>{item.itemName+" ("+item.quantity+")"}</IonItem>
      ))}
    </IonList></IonContent>
    </IonPopover>
  )

  let headerElem=(
    <IonHeader><IonToolbar><IonTitle>
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
    setPageState({...pageState, selectedListID: listID, itemRows: getItemRows(listID)});
    navigate('/items/'+listID);
  }

  let listContent=[];

  function addCurrentRows(listCont: any, curRows: any, catID: string, catName: string, completed: boolean | null) {
    listCont.push(
        <IonItemGroup key={catID+Boolean(completed).toString()}>
        <IonItemDivider key={catID+Boolean(completed).toString()}>{catName}</IonItemDivider>
          {curRows}
      </IonItemGroup>
    )
  }

  let lastCategoryID="<INITIAL>";
  let lastCategoryName="<INITIAL>";
  let lastCategoryFinished: boolean | null = null;
  let currentRows=[];
  let createdFinished=false;
  const completedDivider=(<IonItemDivider key="Completed">Completed</IonItemDivider>);
  for (let i = 0; i < pageState.itemRows.length; i++) {
    const item = pageState.itemRows[i];
    if ((lastCategoryID !== item.categoryID )||(lastCategoryFinished !== item.completed)) { 
      if (currentRows.length > 0) {
        addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName,lastCategoryFinished);
        currentRows=[];
      }
      if (item.categoryID === null) {
        lastCategoryID = "Uncategorized"
      }
      else {
        lastCategoryID = item.categoryID;
      }
      lastCategoryName=item.categoryName;
      lastCategoryFinished=item.completed;   
    }
    currentRows.push(
      <IonItem key={pageState.itemRows[i].itemID} >
        <IonCheckbox slot="start"
            onIonChange={(e: any) => completeItemRow(pageState.itemRows[i].itemID,e.detail.checked)}
            checked={Boolean(pageState.itemRows[i].completed)}></IonCheckbox>
        <IonButton fill="clear" class="textButton" routerLink= {"/item/edit/"+pageState.itemRows[i].itemID}>
          {pageState.itemRows[i].itemName + " "+ pageState.itemRows[i].quantity.toString() }</IonButton>
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
