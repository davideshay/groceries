import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
  IonButtons, IonMenuButton, useIonToast, IonIcon, useIonAlert, IonFooter, IonText } from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends, 
  UseFriendState, useDeleteGenericDocument, useDeleteItemsInListGroup, useGetOneDoc } from '../components/Usehooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash-es';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { initUserIDList, initUsersInfo, PouchResponse, ResolvedFriendStatus, UserIDList, UsersInfo, HistoryProps, ListCombinedRow, RowType, FriendRow } from '../components/DataTypes'
import { ListGroupDoc, ListGroupDocInit } from '../components/DBSchema';
import SyncIndicator from '../components/SyncIndicator';
import { getUsersInfo } from '../components/Utilities';
import './ListGroup.css';
import { closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';
import { log } from "../components/Utilities";
import { updateTriggerDoc } from '../components/RemoteUtilities';
import { usePouch } from 'use-pouchdb';
import { GlobalStateContext } from '../components/GlobalState';

interface PageState {
  needInitListGroupDoc: boolean,
  listGroupDoc: ListGroupDoc,
  alexaDefault: boolean,
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
    alexaDefault: false,
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
  const { remoteDBState, remoteDBCreds, setRemoteDBState, restartSync } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const {useFriendState, friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { listCombinedRows, listRows, listRowsLoaded, listError } = useContext(GlobalDataContext);
  const { globalState, updateSettingKey } = useContext(GlobalStateContext);
  const { loading: listGroupLoading, doc: listGroupDoc, dbError: listGroupError } = useGetOneDoc(pageState.selectedListGroupID);
  const [presentAlert,dismissAlert] = useIonAlert();
  const screenLoading = useRef(true);
  const history = useHistory();
  const { t } = useTranslation();
  const db = usePouch();

  useEffect( () => {
    setPageState(prevState => ({...prevState,
      selectedListGroupID: (routeID === "<new>" ? null : routeID)}));
  },[routeID])

  function changeListUpdateState(listGroupID: string) {
    setPageState(prevState => ({...prevState,
        selectedListGroupID: listGroupID}))
    history.push('/listgroup/edit/'+listGroupID);    
  }

  useEffect( () => {
    async function getUI(userIDList: UserIDList) {
      let usersInfo: UsersInfo = cloneDeep(initUsersInfo);
      let online = true;
      if (userIDList.userIDs.length > 0) {
        setPageState(prevState => ({...prevState,usersInfo:[],usersLoaded:false}));
        [online,usersInfo] = await getUsersInfo(userIDList,String(remoteDBCreds.apiServerURL),String(remoteDBState.accessJWT))  
      }
      setPageState(prevState => ({...prevState,usersInfo: usersInfo,usersLoaded: true}));
      if (!online) {
        setRemoteDBState(prevState => ({...prevState,apiServerAvailable: false}));
      }
    }
    if (listRowsLoaded && (useFriendState === UseFriendState.rowsLoaded ||  !remoteDBState.dbServerAvailable) && (!listGroupLoading || mode==="new")) {
      let sharedWith: string[] = [];
      if (mode === "new" && pageState.needInitListGroupDoc) {
        let initListGroupDoc: ListGroupDoc = cloneDeep(ListGroupDocInit);
        initListGroupDoc.listGroupOwner=String(remoteDBCreds.dbUsername);
        friendRows.forEach((fr: FriendRow) => {
          initListGroupDoc.sharedWith.push(fr.targetUserName);
        })
        setPageState(prevState => ({...prevState,listGroupDoc: initListGroupDoc, needInitListGroupDoc: false, changesMade: false}))
      }
      else if (mode !== "new") {
        sharedWith = (listGroupDoc as ListGroupDoc).sharedWith;
        let newDoc: ListGroupDoc = cloneDeep(listGroupDoc);
        let alexaDefault= (newDoc._id === globalState.settings.alexaDefaultListGroup)
        if(!newDoc.hasOwnProperty("alexaDefault")) {newDoc.alexaDefault = false;}
        setPageState(prevState => ({...prevState,listGroupDoc: newDoc, alexaDefault: alexaDefault, changesMade: false}))
      }
      let userIDList: UserIDList = cloneDeep(initUserIDList);
      sharedWith.forEach((user: string) => {
        userIDList.userIDs.push(user);
      });
      getUI(userIDList);
    }
  },[listGroupLoading, listGroupDoc, listRowsLoaded, mode, useFriendState,friendRows,pageState.selectedListGroupID, globalState.settings.alexaDefaultListGroup,remoteDBState.accessJWT, pageState.needInitListGroupDoc,remoteDBCreds.apiServerURL,remoteDBCreds.dbUsername,remoteDBState.dbServerAvailable,setRemoteDBState]);

  if (listError || listGroupError  || useFriendState === UseFriendState.error) {
    <ErrorPage errorText={t('error.loading_list_group') as string}></ErrorPage>
  }

  if (!listRowsLoaded || (listGroupLoading && pageState.selectedListGroupID !== null) ||(useFriendState !== UseFriendState.rowsLoaded && !remoteDBState.workingOffline) || isEmpty(pageState.listGroupDoc) || !pageState.usersLoaded || pageState.deletingDoc)  {
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
    let nameExists=false;
    if (listCombinedRows.filter(lcr => (lcr.rowType === RowType.listGroup && lcr.listGroupName.toUpperCase() === pageState.listGroupDoc.name.toUpperCase() && lcr.listGroupID !== pageState.listGroupDoc._id)).length > 0) {
      nameExists=true;
    }
    if (nameExists) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.listgroup_already_exists"), hasError: true}}));
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
      if (pageState.alexaDefault) {
        updateSettingKey("alexaDefaultListGroup",String(response.pouchData.id));
      } else {
        if (globalState.settings.alexaDefaultListGroup === response.pouchData.id) {
          updateSettingKey("alexaDefaultListGroup",null);
        }
      }
      log.debug("List Group updated, about to restart sync...");
      await updateTriggerDoc(db as PouchDB.Database,{triggerUpdate: "listgroup"})
      restartSync()
      history.goBack();  // back("lists")
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

  function updateAlexaDefault(updDefault: boolean) {
    if (pageState.alexaDefault !== updDefault) {
      setPageState(prevState => (
        {...prevState, changesMade: true, alexaDefault: updDefault}));
    }
  }

  let assignedListsElem=[];
  assignedListsElem.push(<IonItemDivider key="assigneddivider" className="category-divider">{t("general.lists_assigned_to_group")}</IonItemDivider>)
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

  usersElem.push(<IonItemDivider key="listuserdivider" className="category-divider">{ownerText}</IonItemDivider>)
  if (remoteDBState.workingOffline) {
    usersElem.push(<IonItem key="offline">{t("general.offline_cant_get_sharing_info")}</IonItem>)
  } else {
    usersElem.push(<IonItemDivider key="listdivider" className="category-divider">{t("general.listgroup_shared_with_users")}</IonItemDivider>)
  }  

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
      if (globalState.settings.alexaDefaultListGroup === pageState.listGroupDoc._id) {
        updateSettingKey("alexaDefaultListGroup",null);
      }
      restartSync()
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      dismissAlert();
      history.goBack(); // back to "list"
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
       listCombinedRows[i].listGroupOwner === remoteDBCreds.dbUsername && 
       !listCombinedRows[i].listGroupRecipe) {
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
      header: t("general.delete_this_listgroup",{listgroup: pageState.listGroupDoc.name}),
      subHeader: t("general.delete_this_listgroup_detail"),
      buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                  handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))},
                { text: t("general.delete"), role: "confirm",
                  handler: () => deleteListGroupFromDB()}]
    })
  }              
}
  let selectOptionListElem = (
    listCombinedRows.filter(lg => (lg.rowType === RowType.listGroup && !lg.hidden)).map((list: ListCombinedRow) => (
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
      <IonSelect label={t("general.editing_listgroup") as string} aria-label={t("general.editing_listgroup") as string} key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListGroupID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect label={t("general.editing_listgroup")+":"} aria-label={t("general.editing_listgroup")+":"} key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListGroupID}>
        {selectOptionListElem}
      </IonSelect>
    ) 
  }
  
  let selectDropDown=[];
    if (mode === "new") {
      selectDropDown.push(<IonTitle className="ion-no-padding" key="createnew">{t("general.creating_listgroup")}</IonTitle>)
    } else {  
      selectDropDown.push(
        <IonTitle className="ion-no-padding" key="editexisting">
        <IonItem key="editexistingitem">
        {selectElem}
        </IonItem>
        </IonTitle>
    )
  }

  let updateButton=[];
  if (iAmListOwner) {
    if (mode === "new") {
      updateButton.push(<IonButton color="primary" fill="solid" key="add" onClick={() => updateThisItem()}>{t("general.add")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
    } else {
      updateButton.push(<IonButton color="primary" fill="solid" key="update" onClick={() => updateThisItem()}>{t("general.save")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
    }
  }

  let lastRemainingListGroup = listCombinedRows.filter( lcr =>
      lcr.rowType === RowType.listGroup && !lcr.listGroupRecipe  &&
      lcr.listGroupOwner === remoteDBCreds.dbUsername).length <= 1;
  let deleteButton=[];
  if (iAmListOwner && !pageState.listGroupDoc.recipe && !lastRemainingListGroup) {
    deleteButton.push(<IonButton key="delete" fill="outline" color="danger"  onClick={() => deletePrompt()}>{t("general.delete")}<IonIcon slot="start" icon={trashOutline}></IonIcon></IonButton>)
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
            {selectDropDown}
            <SyncIndicator addPadding={true}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList className="ion-no-padding">
            <IonItem key="name">
              <IonInput label="Name" labelPlacement='stacked'  type="text" placeholder="<New>"
                  onIonInput={(e) => updateName(String(e.detail.value))}
                  value={pageState.listGroupDoc.name}
                  readonly={iAmListOwner ? false: true}
                  className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
                  errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            {pageState.listGroupDoc.recipe ? <></> :
              <IonItem key="alexa">
                <IonCheckbox slot="start" labelPlacement="end" checked={pageState.alexaDefault}
                  onIonChange={(e) => updateAlexaDefault(e.detail.checked)}>
                <IonLabel>{t("general.alexa_default")}</IonLabel>
                </IonCheckbox>
              </IonItem>
            }
            { (pageState.listGroupDoc.recipe) ? (
              <IonItemDivider className="category-divider">
                {t("general.is_recipe_listgroup_for_user")}
              </IonItemDivider>
            ): (
              <IonItemGroup key="assignedlists">
              {assignedListsElem}
            </IonItemGroup>
            )}
            <IonItemGroup key="userlist">
            {usersElem}
            </IonItemGroup>
          </IonList>
          <IonFooter className="floating-error-footer">
              {
                formErrors[ErrorLocation.General].hasError ? <IonItem className="shorter-item-some-padding" lines="none"><IonText color="danger">{formErrors[ErrorLocation.General].errorMessage}</IonText></IonItem> : <></>
              }  
            <IonToolbar>
            <IonButtons slot="start">
              {deleteButton}
            </IonButtons>
            <IonButtons slot="secondary">
              {iAmListOwner ? (
                <IonButton color="secondary" key="back" fill="outline" onClick={() => history.goBack()}>{t("general.cancel")}<IonIcon slot="start" icon={closeCircleOutline}></IonIcon></IonButton>  
                ) : <></>}
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
