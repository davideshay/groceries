import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonButtons, IonMenuButton, 
   useIonToast, IonFooter, IonIcon, useIonAlert, IonLoading } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends, useGetOneDoc,
  UseFriendState, useLists, useDeleteGenericDocument, useDeleteListFromItems, useAddListToAllItems } from '../components/Usehooks';
import { cloneDeep, isEmpty } from 'lodash';
import './List.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { PouchResponse, HistoryProps, ListRow, RowType } from '../components/DataTypes';
import { ListDocInit, ListDoc, CategoryDoc } from '../components/DBSchema'
import SyncIndicator from '../components/SyncIndicator';
import { closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';

interface PageState {
  needInitListDoc: boolean,
  listDoc: ListDoc,
  selectedListID: string,
  listGroupID: string | null,
  listGroupOwner: string | null,
  changesMade: boolean,
  formError: string,
  deletingDoc: boolean
}  

const List: React.FC<HistoryProps> = (props: HistoryProps) => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListDoc: (mode === "new") ? true : false,
    listDoc: cloneDeep(ListDocInit),
    selectedListID: routeID,
    listGroupID: null,
    listGroupOwner: null,
    changesMade: false,
    formError: "",
    deletingDoc: false
  })
  const updateListWhole  = useUpdateGenericDocument();
  const createList = useCreateGenericDocument();
  const deleteList = useDeleteGenericDocument();
  const deleteListFromItems = useDeleteListFromItems();
  const addListToAllItems = useAddListToAllItems();
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const {useFriendState, friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { dbError: listError, listDocs, listsLoading, listRowsLoaded, listRows, listCombinedRows } = useLists();
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })
  const { loading: listGroupLoading, doc: listGroupDoc, dbError: listGroupError} = useGetOneDoc(pageState.listGroupID);
  const [presentAlert,dismissAlert] = useIonAlert();
  const screenLoading = useRef(true);

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListID: routeID}))
  },[routeID])

  useEffect( () => {
    let newPageState: PageState=cloneDeep(pageState);
    if (!listsLoading && listRowsLoaded && (useFriendState === UseFriendState.rowsLoaded) && !categoryLoading) {
      if (mode === "new" && pageState.needInitListDoc) {
        let initCategories=categoryDocs.map(cat => cat._id);
        let initListDoc : ListDoc = cloneDeep(ListDocInit);
        if (listCombinedRows.length > 0) {
          initListDoc.listGroupID=String(listCombinedRows[0].listGroupID)
          newPageState.listGroupOwner=listCombinedRows[0].listGroupOwner;
        } else {
          initListDoc.listGroupID=null
        }
        initListDoc.categories = initCategories;
        newPageState.listDoc=initListDoc;
        newPageState.listGroupID=initListDoc.listGroupID;
        newPageState.needInitListDoc=false;
      }
      else if (mode !== "new") {
        let newListRow = listRows.find((lr: ListRow) => lr.listDoc._id === pageState.selectedListID);
        if (newListRow == undefined) {return}
        newPageState.listDoc = newListRow.listDoc;
        newPageState.listGroupID = newListRow.listGroupID;
        newPageState.listGroupOwner = newListRow.listGroupOwner;
      }
      newPageState.changesMade=false;
      setPageState(newPageState);
    }
  },[listsLoading, listRowsLoaded, listGroupLoading, listDocs, listCombinedRows, mode, listGroupDoc, useFriendState,friendRows, categoryLoading,categoryDocs,pageState.selectedListID, remoteDBState.accessJWT]);

  if (useFriendState == UseFriendState.error || listError || listGroupError || categoryError) {
    screenLoading.current=false;
    return (
    <ErrorPage errorText="Error Loading List Information... Restart."></ErrorPage>
  )}

  if (listsLoading || !listRowsLoaded || (useFriendState !== UseFriendState.rowsLoaded) || categoryLoading || isEmpty(pageState.listDoc) || (listGroupLoading && pageState.listGroupID !== null) || pageState.deletingDoc)  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
      <IonContent><IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false;}} 
                   message="Loading Data..."></IonLoading>
      </IonContent></IonPage>
  )};
  
  screenLoading.current = false;

  function changeListUpdateState(listID: string) {
    setPageState(prevState => ({...prevState,
        listDoc: listDocs.find((el: ListDoc) => el._id === listID),
        selectedListID: listID}))
    props.history.push('/list/edit/'+listID);    
  }

  async function updateThisItem() {
    if (pageState.listDoc.name == "" || pageState.listDoc.name == undefined || pageState.listDoc.name == null) {
      setPageState(prevState => ({...prevState,formError: "Must enter name for list"}));
      return false;
    }
    if (pageState.listGroupID == null) {
      setPageState(prevState => ({...prevState,formError: "Must select a valid group ID"}));
      return false;
    }
    let response: PouchResponse;
    if (mode === "new") {
      response = await createList(pageState.listDoc);
      if (response.successful) {
        let addedToItems = addListToAllItems({listGroupID: String(pageState.listGroupID) ,listID: response.pouchData.id, listDocs: listDocs})
        if (!addedToItems) {response.successful = false;}
      }
    }
    else {
      response = await updateListWhole(pageState.listDoc);
    }
    if (response.successful) {
      props.history.goBack();  // back("lists")
    } else {
      presentToast({message: "Error Creating/Updating List", duration: 1500, position: "middle"});
    }
  }

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    let newPageState=cloneDeep(pageState);
    newPageState.listDoc.categories.splice(event.detail.to,0,newPageState.listDoc.categories.splice(event.detail.from,1)[0]);
    newPageState.changesMade=true;
    setPageState(newPageState);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
    const currCategories: string[] =[];
    let foundIt=false;
    for (let i = 0; i < pageState.listDoc.categories.length; i++) {
      if (pageState.listDoc.categories[i] === categoryID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
        }
      } else {
        currCategories.push(pageState.listDoc.categories[i])
      }
    }
    if (updateVal && !foundIt) {
      currCategories.push(categoryID);
    }
    setPageState(prevState => (
      {...prevState, changesMade: true, listDoc: {...prevState.listDoc, categories: currCategories}}))

  }

  function updateName(updName: string) {
    if (pageState.listDoc.name !== updName) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listDoc: {...prevState.listDoc, name: updName}}));
    }  
  }

  function updateListGroup(updGroup: string) {
    if (pageState.listGroupID !== updGroup) {
      setPageState(prevState => ({...prevState, changesMade: true, listDoc: {...prevState.listDoc, listGroupID: updGroup}, listGroupID: updGroup}))
    }
  }

async function deleteListFromDB() {
  // first, find 
  let response = await deleteListFromItems(String(pageState.selectedListID));
  if (response.successful) {
    let delResponse = await deleteList((pageState.listDoc));
    if (delResponse.successful) {
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      props.history.goBack(); // back to "list"
    } else {
      setPageState(prevState => ({...prevState,formError: "Could not delete list"}));
    }

  } else {
    setPageState(prevState => ({...prevState,formError: "Unable to remove list from all items"}));
  }
}

function deletePrompt() {
  setPageState(prevState => ({...prevState,deletingDoc: true}));
  presentAlert({
    header: "Delete this list?",
    subHeader: "Do you really want to delete this list?  All information on this list will be lost.",
    buttons: [ { text: "Cancel", role: "Cancel" ,
                handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))},
               { text: "Delete", role: "confirm",
                handler: () => deleteListFromDB()}]
  })
}

  let categoryElem=[];
  let categoryLines=[];

  function catItem(id: string, active: boolean) {
    const actname=active ? "active" : "inactive"
    const catDoc : CategoryDoc | undefined = (categoryDocs as CategoryDoc[]).find(element => (element._id === id))
    if (catDoc != undefined) {
      let name = catDoc.name;
      return (
        <IonItem key={pageState.selectedListID+"-"+actname+"-"+id}>
            <IonCheckbox labelPlacement="end" justify="start" key={pageState.selectedListID+"-"+actname+"-"+id} onIonChange={(e) => updateCat(id,Boolean(e.detail.checked))} checked={active}>{name}</IonCheckbox>
            <IonReorder slot="end"></IonReorder>
        </IonItem>)    
    } else {
      console.log("cat doc not defined: id:",id);
      return(
      <IonItem key={pageState.selectedListID+"-"+actname+"-"+id}>
          <IonButton fill="clear" class="textButton">UNDEFINED CATEGORY</IonButton>
          <IonReorder slot="end"></IonReorder>
      </IonItem>)
    }
  }

  function catItemDivider(active: boolean, lines: any) {
    const actname=active ? "Active" : "Inactive"
    return (
      <div key={actname+"-div"}>
      <IonItemDivider key={actname}><IonLabel>{actname}</IonLabel></IonItemDivider>
      <IonReorderGroup key={actname+"-reorder-group"} disabled={false} onIonItemReorder={handleReorder}>
          {lines}
      </IonReorderGroup>
      </div>  
    )   
  }
  
  for (let i = 0; i < pageState.listDoc.categories.length; i++) {
    categoryLines.push(catItem(pageState.listDoc.categories[i],true));
  }
  categoryElem.push(catItemDivider(true,categoryLines));
  categoryLines=[];
  for (let i = 0; i < categoryDocs.length; i++) {
    const inList = pageState.listDoc.categories.includes(categoryDocs[i]._id);
    if (!inList) {
      categoryLines.push(catItem(categoryDocs[i]._id,false))
    }
  }
  if (categoryLines.length > 0) {
    categoryElem.push(catItemDivider(false,categoryLines));
  } 

  let selectOptionListElem=(
    listRows.map((list: ListRow) => (
      <IonSelectOption key={"list-"+list.listDoc._id} value={list.listDoc._id}>
        {list.listDoc.name}
      </IonSelectOption>
    )))

  let selectElem=[];
  if (pageState.changesMade) {
    let alertOptions={
      header: "Changing Selected List",
      message: "List has been updated and not saved. Do you still want to change lists?"
    }
    selectElem.push(
      <IonSelect label="Editing List:" key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect label="Editing List:" key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    ) 
  }
  
  let selectDropDown = [];
    if (mode === "new") {
      selectDropDown.push(<IonTitle class="ion-no-padding" key="createnew">Creating new list</IonTitle>)
    } else {  
      selectDropDown.push(
        <IonTitle class="ion-no-padding" key="editexisting">
        <IonItem key="editexistingitem">
        {selectElem}
        </IonItem>
        </IonTitle>
    )
  }

  let updateButton=[];
  if (mode === "new") {
    updateButton.push(<IonButton class="ion-float-right" key="add" onClick={() => updateThisItem()}>Add<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  } else {
    updateButton.push(<IonButton class="ion-float-right" key="save" onClick={() => updateThisItem()}>Save<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  }

  let deleteButton=[];
  if (pageState.listGroupOwner===remoteDBCreds.dbUsername) {
    deleteButton.push(<IonButton class="ion-float-left" fill="outline" color="danger" key="delete" onClick={() => deletePrompt()}>Delete<IonIcon slot="start" icon={trashOutline}></IonIcon></IonButton>)
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
            {selectDropDown}
            <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonInput label="Name" labelPlacement="stacked" type="text" placeholder="<New>"
                  onIonInput={(e) => updateName(String(e.detail.value))}
                  value={pageState.listDoc.name}>
              </IonInput>
            </IonItem>
            <IonItem key="listgroup">
              <IonSelect disabled={mode!=="new"} key="listgroupsel" label="List Group" labelPlacement='stacked' interface="popover" onIonChange={(e) => updateListGroup(e.detail.value)} value={pageState.listDoc.listGroupID}>
                {listCombinedRows.map((lr) => {
                  if (lr.rowType === RowType.listGroup) return ( <IonSelectOption key={lr.rowKey} value={lr.listGroupID}>{lr.listGroupName}</IonSelectOption> )
                })}
              </IonSelect>
            </IonItem>
            <IonItemGroup key="categorylist">
            {categoryElem}
            </IonItemGroup>
          </IonList>
          {deleteButton}
          {updateButton}
          <IonButton class="ion-float-right" key="back" fill="outline"  onClick={() => props.history.goBack()}>Cancel<IonIcon slot="start" icon={closeCircleOutline}></IonIcon></IonButton>  
      </IonContent>
      <IonFooter>
        <IonLabel>{pageState.formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default List;
