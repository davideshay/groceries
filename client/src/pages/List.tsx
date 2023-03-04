import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonButtons, IonMenuButton, IonGrid,
   useIonToast, IonFooter, useIonAlert, IonRow, IonCol, IonText } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends, useGetOneDoc,
  UseFriendState, useLists, useDeleteGenericDocument, useDeleteListFromItems } from '../components/Usehooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import './List.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { initUserIDList, initUsersInfo, PouchResponse, ResolvedFriendStatus, UserIDList, UsersInfo, HistoryProps, ListRow } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';
import { getUsersInfo } from '../components/Utilities';

interface PageState {
  needInitListDoc: boolean,
  listDoc: any,
  selectedListID: string,
  listGroupID: string,
  changesMade: boolean,
  formError: string,
  deletingDoc: boolean
}  

const List: React.FC<HistoryProps> = (props: HistoryProps) => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListDoc: (mode === "new") ? true : false,
    listDoc: {},
    selectedListID: routeID,
    listGroupID: "",
    changesMade: false,
    formError: "",
    deletingDoc: false
  })
  const updateListWhole  = useUpdateGenericDocument();
  const createList = useCreateGenericDocument();
  const deleteList = useDeleteGenericDocument();
  const deleteListFromItems = useDeleteListFromItems()
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const {useFriendState, friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { listDocs, listsLoading, listRowsLoading, listRows } = useLists(String(remoteDBCreds.dbUsername));
  const { docs: categoryDocs, loading: categoryLoading } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })
  const { loading: listGroupLoading, doc: listGroupDoc} = useGetOneDoc(pageState.listGroupID);

  const [presentAlert,dismissAlert] = useIonAlert();

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListID: routeID}))
  },[routeID])

  function changeListUpdateState(listID: string) {
    setPageState(prevState => ({...prevState,
        listDoc: listDocs.find((el: any) => el._id === listID),
        selectedListID: listID}))
    props.history.push('/list/edit/'+listID);    
  }

  useEffect( () => {
    let newPageState=cloneDeep(pageState);
    if (!listsLoading && (useFriendState === UseFriendState.rowsLoaded) && !categoryLoading) {
      if (mode === "new" && pageState.needInitListDoc) {
        console.log("in new useeffect, creating initlistdoc");
        let initCategories=categoryDocs.map(cat => cat._id);
        let initListDoc = {
          type: "list",
          name: "",
          listOwner: remoteDBCreds.dbUsername,
          sharedWith: [],
          categories: initCategories
        }
        newPageState.listDoc=initListDoc;
        newPageState.listGroupID="";
        newPageState.needInitListDoc=false;
      }
      else if (mode !== "new") {
        console.log("in initDoc, doing lookup against listDocs");
        let newListDoc = listDocs.find((el: any) => el._id === pageState.selectedListID);
        if (newListDoc == undefined) {return}
        newPageState.listDoc = newListDoc;
        newPageState.listGroupID = newListDoc.listGroupID;
      }
      newPageState.changesMade=false;
      setPageState(newPageState);
    }
  },[listsLoading,listGroupLoading, listDocs, listGroupDoc, useFriendState,friendRows, categoryLoading,categoryDocs,pageState.selectedListID, remoteDBState.accessJWT]);

  if (listsLoading || listRowsLoading || (useFriendState !== UseFriendState.rowsLoaded) || categoryLoading || isEmpty(pageState.listDoc) || listGroupLoading || pageState.deletingDoc)  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
  
  async function updateThisItem() {
    if (pageState.listDoc.name == "" || pageState.listDoc.name == undefined || pageState.listDoc.name == null) {
      setPageState(prevState => ({...prevState,formError: "Must enter name for list"}));
      return false;
    }
    let response: PouchResponse;
    if (mode === "new") {
      response = await createList(pageState.listDoc);
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
    const currCategories: any=[];
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

async function deleteListFromDB() {
  // first, find 
  let response = await deleteListFromItems(String(pageState.selectedListID));
  if (response.successful) {
    let delResponse = await deleteList((pageState.listDoc as any));
    if (delResponse.successful) {
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      props.history.push(); // back to "list"
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
    const catDoc = (categoryDocs.find(element => (element._id === id)) as any)
    if (catDoc != undefined) {
      let name = catDoc.name;
      return (
        <IonItem key={pageState.selectedListID+"-"+actname+"-"+id}>
            <IonCheckbox labelPlacement="end" justify="start" key={pageState.selectedListID+"-"+actname+"-"+id} onIonChange={(e: any) => updateCat(id,Boolean(e.detail.checked))} checked={active}>{name}</IonCheckbox>
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
  
  for (let i = 0; i < (pageState.listDoc as any).categories.length; i++) {
    categoryLines.push(catItem((pageState.listDoc as any).categories[i],true));
  }
  categoryElem.push(catItemDivider(true,categoryLines));
  categoryLines=[];
  for (let i = 0; i < categoryDocs.length; i++) {
    const inList = (pageState.listDoc as any).categories.includes(categoryDocs[i]._id);
    if (!inList) {
      categoryLines.push(catItem(categoryDocs[i]._id,false))
    }
  }
  categoryElem.push(catItemDivider(false,categoryLines));

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
  
  let selectDropDown: any=[];
    if (mode === "new") {
      selectDropDown.push(<IonTitle key="createnew">Creating new list</IonTitle>)
    } else {  
      selectDropDown.push(
        <IonTitle key="editexisting">
        <IonItem key="editexistingitem">
        {selectElem}
        </IonItem>
        </IonTitle>
    )
  }

  let updateButton=[];
  if (mode === "new") {
    updateButton.push(<IonButton key="add" onClick={() => updateThisItem()}>Add</IonButton>)
  } else {
    updateButton.push(<IonButton key="update" onClick={() => updateThisItem()}>Update</IonButton>)
  }

  let deleteButton=[];
  deleteButton.push(<IonButton key="delete" onClick={() => deletePrompt()}>Delete</IonButton>)

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
                  onIonChange={(e: any) => updateName(e.detail.value)}
                  value={(pageState.listDoc as any).name}>
              </IonInput>
            </IonItem>
            <IonItemGroup key="categorylist">
            {categoryElem}
            </IonItemGroup>
          </IonList>
          {updateButton}
          {deleteButton}
          <IonButton key="back" onClick={() => props.history.goBack()}>Cancel</IonButton>  
      </IonContent>
      <IonFooter>
        <IonLabel>{pageState.formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default List;
