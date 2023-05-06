import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
  IonButtons, IonMenuButton, useIonToast, IonIcon, useIonAlert, IonFooter, IonText } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends, 
  UseFriendState, useDeleteGenericDocument, useDeleteItemsInListGroup, useGetOneDoc } from '../components/Usehooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { initUserIDList, initUsersInfo, PouchResponse, ResolvedFriendStatus, UserIDList, UsersInfo, HistoryProps, ListCombinedRow, RowType, FriendRow, ListCombinedRows } from '../components/DataTypes'
import { ListGroupDoc, ListGroupDocInit } from '../components/DBSchema';
import SyncIndicator from '../components/SyncIndicator';
import { getUsersInfo } from '../components/Utilities';
import './ListGroup.css';
import { closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';

interface PageState {
  needInitListGroupDoc: boolean,
  listGroupDoc: ListGroupDoc,
  selectedListGroupID: string | null,
  changesMade: Boolean,
  usersLoaded: boolean,
  usersInfo: UsersInfo,
  deletingDoc: boolean
}

enum ErrorLocation  {
   Name, General
}
const FormErrorInit = { [ErrorLocation.Name]:       {errorMessage:"", hasError: false},
                        [ErrorLocation.General]:    {errorMessage:"", hasError: false}
                    }

const ListGroup: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListGroupDoc: (mode === "new") ? true : false,
    listGroupDoc: ListGroupDocInit,
    selectedListGroupID: (routeID === "<new>" ? null : routeID),
    changesMade: false,
    usersLoaded: false,
    usersInfo: [],
    deletingDoc: false
  })
  const [formErrors,setFormErrors] = useState(FormErrorInit);
  const updateListGroupWhole  = useUpdateGenericDocument();
  const createListGroup = useCreateGenericDocument();
  const deleteListGroup = useDeleteGenericDocument();
  const deleteList = useDeleteGenericDocument();
  const deleteItemsInListGroup = useDeleteItemsInListGroup();
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const {useFriendState, friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { listCombinedRows, listRows, listRowsLoaded, listError } = useContext(GlobalDataContext);
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })
  const { loading: listGroupLoading, doc: listGroupDoc, dbError: listGroupError } = useGetOneDoc(pageState.selectedListGroupID);
  const [presentAlert,dismissAlert] = useIonAlert();
  const screenLoading = useRef(true);
  const { t } = useTranslation();

  useEffect( () => {
    setPageState(prevState => ({...prevState,
      selectedListGroupID: (routeID === "<new>" ? null : routeID)}))
  },[routeID])

  function changeListUpdateState(listGroupID: string) {
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
    if (listRowsLoaded && (useFriendState === UseFriendState.rowsLoaded) && !categoryLoading && (!listGroupLoading || mode==="new")) {
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
      newPageState.listGroupDoc.sharedWith.forEach((user: string) => {
        userIDList.userIDs.push(user);
      });
      getUI(userIDList);
    }
  },[listGroupLoading, listGroupDoc, listRowsLoaded, mode, useFriendState,friendRows, categoryLoading,categoryDocs,pageState.selectedListGroupID, remoteDBState.accessJWT]);

  if (listError || listGroupError  || useFriendState === UseFriendState.error || categoryError) {
    <ErrorPage errorText={t('error.loading_list_group') as string}></ErrorPage>
  }

  if (!listRowsLoaded || (listGroupLoading && pageState.selectedListGroupID !== null) ||(useFriendState !== UseFriendState.rowsLoaded) || categoryLoading || isEmpty(pageState.listGroupDoc) || !pageState.usersLoaded || pageState.deletingDoc)  {
    return ( <Loading isOpen={screenLoading.current} message={t('general.loading_list_group')}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function updateThisItem() {
    setFormErrors(prevState=>(FormErrorInit))
    if (pageState.listGroupDoc.name === "" || pageState.listGroupDoc.name === undefined || pageState.listGroupDoc.name === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true }}));
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
      presentToast({message: t("error.creating_updating_listgroup"), duration: 1500, position: "middle"});
    }
  }

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers: string[]=[];
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

  let assignedListsElem=[];
  assignedListsElem.push(<IonItemDivider key="assigneddivider">{t("general.lists_assigned_to_group")}</IonItemDivider>)
  listCombinedRows.forEach((lcr: ListCombinedRow)  => {
    if (lcr.rowType === RowType.list && lcr.listGroupID === pageState.selectedListGroupID) {
      assignedListsElem.push(<IonItem key={lcr.rowKey}>{lcr.rowName}</IonItem>)
    }
  });

  let usersElem=[];
  let ownerText="";
  let iAmListOwner=false;
  if (pageState.listGroupDoc.listGroupOwner === remoteDBCreds.dbUsername) {
    ownerText = t("general.you_are_listgroup_owner");
    iAmListOwner=true;
  } else {
    let ownerRow=friendRows.find(el => (el.targetUserName === pageState.listGroupDoc.listGroupOwner));
    ownerText = ownerRow?.targetFullName + " " +t("general.is_listgroup_owner");
  }

  usersElem.push(<IonItemDivider key="listuserdivider">{ownerText}</IonItemDivider>)
  usersElem.push(<IonItemDivider key="listdivider">{t("general.listgroup_shared_with_users")}</IonItemDivider>)

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
              <IonCheckbox labelPlacement="end" justify="start" key={pageState.selectedListGroupID+"-"+userID} onIonChange={(e) => selectUser(userID,Boolean(e.detail.checked))} checked={Boolean(userFound)}>{userName}</IonCheckbox>
              <IonLabel slot="end">{userEmail}</IonLabel>
            </IonItem>)
        } 
      }
    }
  } else { // not the list owner
    pageState.usersInfo.forEach(user => {
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
    if (listRows[i].listGroupID === pageState.selectedListGroupID) {
      let response = await deleteList(listRows[i].listDoc);
      if (!response.successful) {delSuccess = false;}
    }  
  }
  let response = await deleteItemsInListGroup(String(pageState.selectedListGroupID));
  if (response.successful) {
    let delResponse = await deleteListGroup(pageState.listGroupDoc);
    if (delResponse.successful) {
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      dismissAlert();
      props.history.goBack(); // back to "list"
    } else {
      dismissAlert()
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.could_not_delete_listgroup"), hasError: true }}));
      setPageState(prevState => ({...prevState, deletingDoc: false}));
    }
  } else {
    dismissAlert();
    setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_listgroup_items"), hasError: true }}));
    setPageState(prevState => ({...prevState, deletingDoc: false}));
  }
  return delSuccess;
}

function deletePrompt() {
  setPageState(prevState => ({...prevState,deletingDoc: true}));
  setFormErrors(prevState=>(FormErrorInit));
  let ownListGroupsCount=0;
  for (let i = 0; i < listCombinedRows.length; i++) {
    if (listCombinedRows[i].rowType === RowType.listGroup && 
       listCombinedRows[i].listGroupOwner === remoteDBCreds.dbUsername ) {
        ownListGroupsCount++;
       }
  }
  if (ownListGroupsCount <= 1) {
    presentAlert({
      header: t("error.deleting_listgroup"),
      subHeader: t("error.deleting_listgroup_detail"),
      buttons: [ { text: t("general.ok"), role: "confirm", 
        handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))
        }]
    })
  } else {
    presentAlert({
      header: t("general.delete_this_listgroup"),
      subHeader: t("general.delete_this_listgroup_detail"),
      buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                  handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))},
                { text: t("general.delete"), role: "confirm",
                  handler: () => deleteListGroupFromDB()}]
    })
  }              
}
  let groupOnlyRows: ListCombinedRows = cloneDeep(listCombinedRows);
  groupOnlyRows.filter(lg => (lg.rowType === RowType.listGroup))
  let selectOptionListElem = (
    groupOnlyRows.map((list: ListCombinedRow) => (
      <IonSelectOption key={list.rowKey} value={list.listGroupID}>
        {list.listGroupName}
      </IonSelectOption>) 
      ))

  let selectElem=[];
  if (pageState.changesMade) {
    let alertOptions={
      header: t("general.changing_selected_listgroup"),
      message: t("general.changing_selected_listgroup_detail")
    }
    selectElem.push(
      <IonSelect label={t("general.editing_list_group") as string} aria-label={t("general.editing_list_group") as string} key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListGroupID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect label={t("general.editing")+":"} aria-label={t("general.editing")+":"} key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListGroupID}>
        {selectOptionListElem}
      </IonSelect>
    ) 
  }
  
  let selectDropDown=[];
    if (mode === "new") {
      selectDropDown.push(<IonTitle class="ion-no-padding" key="createnew">{t("general.creating_listgroup")}</IonTitle>)
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
    updateButton.push(<IonButton color="primary" fill="solid" key="add" onClick={() => updateThisItem()}>{t("general.add")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  } else {
    updateButton.push(<IonButton color="primary" fill="solid" key="update" onClick={() => updateThisItem()}>{t("general.save")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  }

  let deleteButton=[];
  if (iAmListOwner) {
    deleteButton.push(<IonButton key="delete" fill="outline" color="danger"  onClick={() => deletePrompt()}>{t("general.delete")}<IonIcon slot="start" icon={trashOutline}></IonIcon></IonButton>)
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
              <IonInput label="Name" labelPlacement='stacked'  type="text" placeholder="<New>"
                  onIonInput={(e) => updateName(String(e.detail.value))}
                  value={pageState.listGroupDoc.name}
                  readonly={iAmListOwner ? false: true}
                  className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
                  errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="defaultlistgroup">
              <IonCheckbox labelPlacement="end" justify='start'
                  onIonChange={(evt) => {setPageState(prevState => ({...prevState,listGroupDoc: {...pageState.listGroupDoc, default: evt.detail.checked}}))}}
                  checked={pageState.listGroupDoc.default}>
                  {t("general.is_default_listgroup_for_user")}</IonCheckbox>
            </IonItem>
            <IonItemGroup key="assignedlists">
              {assignedListsElem}
            </IonItemGroup>
            <IonItemGroup key="userlist">
            {usersElem}
            </IonItemGroup>
          </IonList>
          <IonFooter class="floating-error-footer">
              {
                formErrors[ErrorLocation.General].hasError ? <IonItem class="shorter-item-some-padding" lines="none"><IonText color="danger">{formErrors[ErrorLocation.General].errorMessage}</IonText></IonItem> : <></>
              }  
            <IonToolbar>
            <IonButtons slot="start">
              {deleteButton}
            </IonButtons>
            <IonButtons slot="secondary">
              <IonButton color="secondary" key="back" fill="outline" onClick={() => props.history.goBack()}>{t("general.cancel")}<IonIcon slot="start" icon={closeCircleOutline}></IonIcon></IonButton>  
            </IonButtons>
            <IonButtons slot="end">
              {updateButton}
            </IonButtons>
            </IonToolbar>
          </IonFooter>
      </IonContent>
    </IonPage>
  );
};

export default ListGroup;
