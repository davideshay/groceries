import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonButtons, IonMenuButton, NavContext,
   useIonToast, IonFooter, useIonAlert } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext, useInsertionEffect } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends, useLists, useDeleteGenericDocument, useDeleteListFromItems } from '../components/Usehooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import './List.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { initUserIDList, initUsersInfo, PouchResponse, ResolvedFriendStatus, UserIDList, UsersInfo } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';
import { getUsersInfo } from '../components/Utilities';
import { UserInfo } from 'os';

interface PageState {
  needInitListDoc: boolean,
  listDoc: any,
  selectedListID: String,
  changesMade: Boolean,
  formError: string,
  usersLoaded: boolean,
  usersInfo: UsersInfo,
  deletingDoc: boolean
}  

const List: React.FC = () => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListDoc: (mode === "new") ? true : false,
    listDoc: {},
    selectedListID: routeID,
    changesMade: false,
    formError: "",
    usersLoaded: false,
    usersInfo: cloneDeep(initUsersInfo),
    deletingDoc: false
  })
  const updateListWhole  = useUpdateGenericDocument();
  const createList = useCreateGenericDocument();
  const deleteList = useDeleteGenericDocument();
  const deleteListFromItems = useDeleteListFromItems()
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const {friendsLoading,friendRowsLoading,friendRows} = useFriends(String(remoteDBState.dbCreds.dbUsername));
  const { listDocs, listsLoading } = useLists(String(remoteDBState.dbCreds.dbUsername));
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  const {goBack, navigate} = useContext(NavContext);
  const [presentAlert,dismissAlert] = useIonAlert();

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListID: routeID}))
  },[routeID])

  function changeListUpdateState(listID: string) {
    console.log("in changeListUpdateState about to update listdoc");
    setPageState(prevState => ({...prevState,
        listDoc: listDocs.find((el: any) => el._id === listID),
        selectedListID: listID}))
    navigate('/list/edit/'+listID);    
  }

  useEffect( () => {
    async function getUI(userIDList: UserIDList) {
      let usersInfo: UsersInfo
      if (userIDList.userIDs.length > 0) {
        setPageState(prevState => ({...prevState,usersInfo:[],usersLoaded:false}));
        usersInfo = await getUsersInfo(userIDList,String(remoteDBState.dbCreds.apiServerURL))  
      }
      setPageState(prevState => ({...prevState,usersInfo: usersInfo,usersLoaded: true}))
    }
    let newPageState=cloneDeep(pageState);
//    console.log({listLoading,friendRowsLoading,friendsLoading,categoryLoading,mode,pageState})
    if (!listsLoading && !friendRowsLoading && !friendsLoading && !categoryLoading) {
      if (mode === "new" && pageState.needInitListDoc) {
        console.log("in new useeffect, creating initlistdoc");
        let initCategories=categoryDocs.map(cat => cat._id);
        let initListDoc = {
          type: "list",
          name: "",
          listOwner: remoteDBState.dbCreds.dbUsername,
          sharedWith: [],
          categories: initCategories
        }
        newPageState.listDoc=initListDoc;
        newPageState.needInitListDoc=false;
      }
      else if (mode != "new") {
        console.log("in initDoc, doing lookup against listDocs");
        let newListDoc = listDocs.find((el: any) => el._id === pageState.selectedListID);
        if (newListDoc == undefined) {return}
        newPageState.listDoc = newListDoc;
      }
      newPageState.changesMade=false;
      setPageState(newPageState);
      let userIDList: UserIDList = cloneDeep(initUserIDList);
      newPageState.listDoc.sharedWith.forEach((user: any) => {
        userIDList.userIDs.push(user);
      });
      getUI(userIDList);
    }
  },[listsLoading,listDocs,friendsLoading, friendRowsLoading, friendRows, categoryLoading,categoryDocs,pageState.selectedListID]);

  if (listsLoading || friendRowsLoading || friendsLoading || categoryLoading || isEmpty(pageState.listDoc) || !pageState.usersLoaded || pageState.deletingDoc)  {return(
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
      goBack("/lists");
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

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers: any=[];
    let foundIt=false;
    for (let i = 0; i < pageState.listDoc.sharedWith.length; i++) {
      if (pageState.listDoc.sharedWith[i] === userID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
        } 
      } else {
        currUsers.push(pageState.listDoc.sharedWith[i])
      }
    }
    if (updateVal && !foundIt) {
      currUsers.push(userID);
    }
    if (!isEqual(pageState.listDoc.sharedWith,currUsers)) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listDoc: {...prevState.listDoc, sharedWith: currUsers}}))
    }
  }

  function updateName(updName: string) {
    if (pageState.listDoc.name !== updName) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listDoc: {...prevState.listDoc, name: updName}}));
    }  
  }

  let usersElem=[];
  let ownerText="";
  let iAmListOwner=false;
  if (pageState.listDoc.listOwner == remoteDBState.dbCreds.dbUsername) {
    ownerText = "You are the list owner";
    iAmListOwner=true;
  } else {
    let ownerRow=friendRows.find(el => (el.targetUserName == pageState.listDoc.listOwner));
    ownerText = ownerRow?.targetFullName + " is the list owner";
  }

  usersElem.push(<IonItemDivider key="listuserdivider">{ownerText}</IonItemDivider>)
  usersElem.push(<IonItemDivider key="listdivider">List is shared with these other users:</IonItemDivider>)

  if (iAmListOwner) {
    for (let i = 0; i < friendRows.length; i++) {
      if (friendRows[i].resolvedStatus == ResolvedFriendStatus.Confirmed) {
        const userID=friendRows[i].targetUserName;
        const userName=friendRows[i].targetFullName;
        const userEmail=friendRows[i].targetEmail;
        const userFound=pageState.listDoc.sharedWith.find((element: string) => (element === userID));
        if (iAmListOwner) {
          usersElem.push(
            <IonItem key={pageState.selectedListID+"-"+userID}>
              <IonCheckbox key={pageState.selectedListID+"-"+userID} slot="start" onIonChange={(e: any) => selectUser(userID,Boolean(e.detail.checked))} checked={userFound}></IonCheckbox>
              <IonLabel>{userName}</IonLabel>
              <IonLabel>{userEmail}</IonLabel>
            </IonItem>)
        } 
      }
    }
  } else { // not the list owner
    pageState.usersInfo.forEach(user => {
      console.log("getting data for userinfo user:",cloneDeep(user));
      if (user.name != remoteDBState.dbCreds.dbUsername && user.name != pageState.listDoc.listOwner) {
        usersElem.push(
          <IonItem key={pageState.selectedListID+"-"+user.name}>
            <IonLabel>{user.fullname}</IonLabel>
            <IonLabel>{user.email}</IonLabel>
          </IonItem>
        )
      }        
    });
}

async function deleteListFromDB() {
  // first, find 
  let response = await deleteListFromItems(String(pageState.selectedListID));
  if (response.successful) {
    let delResponse = await deleteList((pageState.listDoc as any));
    if (delResponse.successful) {
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      goBack('/list');
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
        <IonCheckbox key={pageState.selectedListID+"-"+actname+"-"+id} slot="start" onIonChange={(e: any) => updateCat(id,Boolean(e.detail.checked))} checked={active}></IonCheckbox>
        <IonButton fill="clear" class="textButton">{name}</IonButton>
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
      <div key={actname+"-"+"div"}>
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
    listDocs.map((list: any) => (
      <IonSelectOption key={"list-"+list._id} value={(list as any)._id}>
        {(list as any).name}
      </IonSelectOption>
    )))

  let selectElem=[];
  if (pageState.changesMade) {
    let alertOptions={
      header: "Changing Selected List",
      message: "List has been updated and not saved. Do you still want to change lists?"
    }
    selectElem.push(
      <IonSelect key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
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
        <IonLabel key="editexisting">Editing List:</IonLabel>
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
  if (iAmListOwner) {
    deleteButton.push(<IonButton key="delete" onClick={() => deletePrompt()}>Delete</IonButton>)
  }


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
            {selectDropDown}
            <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" placeholder="<New>"
                  onIonChange={(e: any) => updateName(e.detail.value)}
                  value={(pageState.listDoc as any).name}
                  readonly={iAmListOwner ? false: true}></IonInput>
            </IonItem>
            <IonItemGroup key="userlist">
            <IonItem key="listowner">
              <IonLabel>{}</IonLabel>
            </IonItem>
            {usersElem}
            </IonItemGroup>
            <IonItemGroup key="categorylist">
            {categoryElem}
            </IonItemGroup>
          </IonList>
          {updateButton}
          {deleteButton}
          <IonButton key="back" onClick={() => goBack("/lists")}>Cancel</IonButton>
      </IonContent>
      <IonFooter>
        <IonLabel>{pageState.formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default List;
