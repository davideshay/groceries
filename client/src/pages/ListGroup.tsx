import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
  IonButtons, IonMenuButton, IonLoading,
   useIonToast, IonIcon, useIonAlert } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends, 
  UseFriendState, useLists, useDeleteGenericDocument, useDeleteItemsInListGroup, useGetOneDoc } from '../components/Usehooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { initUserIDList, initUsersInfo, PouchResponse, ResolvedFriendStatus, UserIDList, UsersInfo, HistoryProps, ListGroupDoc, ListGroupDocInit, ListCombinedRow, RowType, FriendRow } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';
import { getUsersInfo } from '../components/Utilities';
import './ListGroup.css';
import { closeCircleOutline, list, saveOutline, trashOutline } from 'ionicons/icons';

interface PageState {
  needInitListGroupDoc: boolean,
  listGroupDoc: ListGroupDoc,
  selectedListGroupID: string,
  changesMade: Boolean,
  formError: string,
  usersLoaded: boolean,
  usersInfo: UsersInfo,
  deletingDoc: boolean
}  

const ListGroup: React.FC<HistoryProps> = (props: HistoryProps) => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListGroupDoc: (mode === "new") ? true : false,
    listGroupDoc: ListGroupDocInit,
    selectedListGroupID: routeID,
    changesMade: false,
    formError: "",
    usersLoaded: false,
    usersInfo: [],
    deletingDoc: false
  })
  const updateListGroupWhole  = useUpdateGenericDocument();
  const createListGroup = useCreateGenericDocument();
  const deleteListGroup = useDeleteGenericDocument();
  const deleteList = useDeleteGenericDocument();
  const deleteItemsInListGroup = useDeleteItemsInListGroup();
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const {useFriendState, friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { listCombinedRows, listRows, listRowsLoaded } = useLists();
  const { docs: categoryDocs, loading: categoryLoading } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })
  const { loading: listGroupLoading, doc: listGroupDoc } = useGetOneDoc(pageState.selectedListGroupID);
  const [presentAlert,dismissAlert] = useIonAlert();
  const screenLoading = useRef(true);

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListGroupID: routeID}))
  },[routeID])

  function changeListUpdateState(listGroupID: string) {
    console.log("in changeListUpdateState about to update listdoc");
    setPageState(prevState => ({...prevState,
        selectedListGroupID: listGroupID}))
    props.history.push('/listgroup/edit/'+listGroupID);    
  }

  useEffect( () => {
    async function getUI(userIDList: UserIDList) {
      let usersInfo: UsersInfo = cloneDeep(initUsersInfo);
      if (userIDList.userIDs.length > 0) {
        setPageState(prevState => ({...prevState,usersInfo:[],usersLoaded:false}));
        usersInfo = await getUsersInfo(userIDList,String(remoteDBCreds.apiServerURL),String(remoteDBState.accessJWT))  
      }
      setPageState(prevState => ({...prevState,usersInfo: usersInfo,usersLoaded: true}))
    }
    let newPageState: PageState =cloneDeep(pageState);
    if (listRowsLoaded && (useFriendState === UseFriendState.rowsLoaded) && !categoryLoading && !listGroupLoading) {
      if (mode === "new" && pageState.needInitListGroupDoc) {
        let initListGroupDoc = ListGroupDocInit;
        newPageState.listGroupDoc=initListGroupDoc;
        newPageState.listGroupDoc.listGroupOwner=String(remoteDBCreds.dbUsername);
        friendRows.forEach((fr: FriendRow) => {
          newPageState.listGroupDoc.sharedWith.push(fr.targetUserName);
        })
        newPageState.needInitListGroupDoc=false;
      }
      else if (mode !== "new") {
        newPageState.listGroupDoc = listGroupDoc;
      }
      newPageState.changesMade=false;
      setPageState(newPageState);
      let userIDList: UserIDList = cloneDeep(initUserIDList);
      newPageState.listGroupDoc.sharedWith.forEach((user: any) => {
        userIDList.userIDs.push(user);
      });
      getUI(userIDList);
    }
  },[listGroupLoading, listGroupDoc, listRowsLoaded,useFriendState,friendRows, categoryLoading,categoryDocs,pageState.selectedListGroupID, remoteDBState.accessJWT]);

  if (!listRowsLoaded || listGroupLoading ||(useFriendState !== UseFriendState.rowsLoaded) || categoryLoading || isEmpty(pageState.listGroupDoc) || !pageState.usersLoaded || pageState.deletingDoc)  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent>
      </IonContent><IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false}}
                    message="Loading Data...">
      </IonLoading></IonPage>
  )};
  
  screenLoading.current=false;

  async function updateThisItem() {
    if (pageState.listGroupDoc.name == "" || pageState.listGroupDoc.name == undefined || pageState.listGroupDoc.name == null) {
      setPageState(prevState => ({...prevState,formError: "Must enter name for list group"}));
      return false;
    }
    let response: PouchResponse;
    if (mode === "new") {
      response = await createListGroup(pageState.listGroupDoc);
    }
    else {
      response = await updateListGroupWhole(pageState.listGroupDoc);
    }
    if (response.successful) {
      props.history.goBack();  // back("lists")
    } else {
      presentToast({message: "Error Creating/Updating List Group", duration: 1500, position: "middle"});
    }
  }

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers: any=[];
    let foundIt=false;
    for (let i = 0; i < pageState.listGroupDoc.sharedWith.length; i++) {
      if (pageState.listGroupDoc.sharedWith[i] === userID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
        } 
      } else {
        currUsers.push(pageState.listGroupDoc.sharedWith[i])
      }
    }
    if (updateVal && !foundIt) {
      currUsers.push(userID);
    }
    if (!isEqual(pageState.listGroupDoc.sharedWith,currUsers)) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listGroupDoc: {...prevState.listGroupDoc, sharedWith: currUsers}}))
    }
  }

  function updateName(updName: string) {
    if (pageState.listGroupDoc.name !== updName) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listGroupDoc: {...prevState.listGroupDoc, name: updName}}));
    }  
  }

  let assignedListsElem: any=[];
  assignedListsElem.push(<IonItemDivider key="assigneddivider">Lists assigned to this group:</IonItemDivider>)
  listCombinedRows.forEach((lcr: ListCombinedRow)  => {
    if (lcr.rowType == RowType.list && lcr.listGroupID == pageState.selectedListGroupID) {
      assignedListsElem.push(<IonItem key={lcr.rowKey}>{lcr.rowName}</IonItem>)
    }
  });

  let usersElem=[];
  let ownerText="";
  let iAmListOwner=false;
  if (pageState.listGroupDoc.listGroupOwner === remoteDBCreds.dbUsername) {
    ownerText = "You are the list group owner";
    iAmListOwner=true;
  } else {
    let ownerRow=friendRows.find(el => (el.targetUserName === pageState.listGroupDoc.listGroupOwner));
    ownerText = ownerRow?.targetFullName + " is the list group owner";
  }

  usersElem.push(<IonItemDivider key="listuserdivider">{ownerText}</IonItemDivider>)
  usersElem.push(<IonItemDivider key="listdivider">List group is shared with these other users:</IonItemDivider>)

  if (iAmListOwner) {
    for (let i = 0; i < friendRows.length; i++) {
      if (friendRows[i].resolvedStatus === ResolvedFriendStatus.Confirmed) {
        const userID=friendRows[i].targetUserName;
        const userName=friendRows[i].targetFullName;
        const userEmail=friendRows[i].targetEmail;
        const userFound=pageState.listGroupDoc.sharedWith.find((element: string) => (element === userID));
        if (iAmListOwner) {
          usersElem.push(
            <IonItem key={pageState.selectedListGroupID+"-"+userID}>
              <IonCheckbox labelPlacement="end" justify="start" key={pageState.selectedListGroupID+"-"+userID} onIonChange={(e: any) => selectUser(userID,Boolean(e.detail.checked))} checked={Boolean(userFound)}>{userName}</IonCheckbox>
              <IonLabel slot="end">{userEmail}</IonLabel>
            </IonItem>)
        } 
      }
    }
  } else { // not the list owner
    console.log("pagestate: ", cloneDeep(pageState));
    pageState.usersInfo.forEach(user => {
      console.log("getting data for userinfo user:",cloneDeep(user));
      if (user.name !== remoteDBCreds.dbUsername && user.name !== pageState.listGroupDoc.listGroupOwner) {
        usersElem.push(
          <IonItem key={pageState.selectedListGroupID+"-"+user.name}>
            <IonLabel>{user.fullname}</IonLabel>
            <IonLabel>{user.email}</IonLabel>
          </IonItem>
        )
      }        
    });
}

async function deleteListGroupFromDB() {
  // first, delete all lists in listgroup
  // second, delete all items in listgroup
  // third, delete listgroup itself
  // if (ownListGroupsCount <= 1) {
  //   dismissAlert();
  //   setPageState(prevState => ({...prevState,formError: "Cannot delete last list group", deletingDoc: false}));
  //   return false;
  // }
  let delSuccess = true;
  for (let i = 0; i < listRows.length; i++) {
    let response = await deleteList(listRows[i].listDoc);
    if (!response.successful) {delSuccess = false;}
  }
  let response = await deleteItemsInListGroup(String(pageState.selectedListGroupID));
  if (response.successful) {
    let delResponse = await deleteListGroup((pageState.listGroupDoc as any));
    if (delResponse.successful) {
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      dismissAlert();
      props.history.push(); // back to "list"
    } else {
      dismissAlert()
      setPageState(prevState => ({...prevState,formError: "Could not delete list group", deletingDoc: false}));
    }
  } else {
    dismissAlert();
    setPageState(prevState => ({...prevState,formError: "Unable to remove list group from all items", deletingDoc: false}));
  }
  return delSuccess;
}

function deletePrompt() {
  setPageState(prevState => ({...prevState,deletingDoc: true, formError: ""}));
  let ownListGroupsCount=0;
  for (let i = 0; i < listCombinedRows.length; i++) {
    if (listCombinedRows[i].rowType === RowType.listGroup && 
       listCombinedRows[i].listGroupOwner == remoteDBCreds.dbUsername ) {
        ownListGroupsCount++;
       }
  }
  if (ownListGroupsCount <= 1) {
    presentAlert({
      header: "Cannot Delete List Group",
      subHeader: "You cannot delete the last remaining list group where you are owner.",
      buttons: [ { text: "OK", role: "confirm", 
        handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))
        }]
    })
  } else {
    presentAlert({
      header: "Delete this list group?",
      subHeader: "Do you really want to delete this list group?  All information on this list group will be lost (lists and items).",
      buttons: [ { text: "Cancel", role: "Cancel" ,
                  handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))},
                { text: "Delete", role: "confirm",
                  handler: () => deleteListGroupFromDB()}]
    })
  }              
}

  let selectOptionListElem = (
    listCombinedRows.map((list: ListCombinedRow) => { 
      if (list.rowType == RowType.listGroup) { return (
      <IonSelectOption key={list.rowKey} value={list.listGroupID}>
        {list.listGroupName}
      </IonSelectOption>) }
      }))

  let selectElem=[];
  if (pageState.changesMade) {
    let alertOptions={
      header: "Changing Selected List Group",
      message: "List group has been updated and not saved. Do you still want to change list groups?"
    }
    selectElem.push(
      <IonSelect label="Editing List Group:" aria-label="Editing List Group:" key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListGroupID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect label="Editing:" aria-label="Editing:" key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListGroupID}>
        {selectOptionListElem}
      </IonSelect>
    ) 
  }
  
  let selectDropDown: any=[];
    if (mode === "new") {
      selectDropDown.push(<IonTitle class="ion-no-padding" key="createnew">Creating new list group</IonTitle>)
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
    updateButton.push(<IonButton class="ion-float-right" key="update" onClick={() => updateThisItem()}>Save<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  }

  let deleteButton=[];
  if (iAmListOwner) {
    deleteButton.push(<IonButton class="ion-float-left" key="delete" fill="outline" color="danger"  onClick={() => deletePrompt()}>Delete<IonIcon slot="start" icon={trashOutline}></IonIcon></IonButton>)
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
              <IonInput label="Name" labelPlacement='stacked'  type="text" placeholder="<New>"
                  onIonInput={(e: any) => updateName(e.detail.value)}
                  value={(pageState.listGroupDoc as any).name}
                  readonly={iAmListOwner ? false: true}></IonInput>
            </IonItem>
            <IonItem key="defaultlistgroup">
              <IonCheckbox labelPlacement="end" justify='start'
                  onIonChange={(evt) => {setPageState(prevState => ({...prevState,listGroupDoc: {...pageState.listGroupDoc, default: evt.detail.checked}}))}}
                  checked={pageState.listGroupDoc.default}>
                  Is default list group for this user</IonCheckbox>
            </IonItem>
            <IonItemGroup key="assignedlists">
              {assignedListsElem}
            </IonItemGroup>
            <IonItemGroup key="userlist">
            {usersElem}
            </IonItemGroup>
          </IonList>
          <IonItem key="formerror"><IonLabel>{pageState.formError}</IonLabel></IonItem> 
            {deleteButton}
            {updateButton}
            <IonButton class="ion-float-right" key="back" fill="outline" onClick={() => props.history.goBack()}>Cancel<IonIcon slot="start" icon={closeCircleOutline}></IonIcon></IonButton>  
      </IonContent>
    </IonPage>
  );
};

export default ListGroup;
