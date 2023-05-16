import { IonContent, IonPage, IonList, IonItem, IonLabel,
        IonButton, useIonToast, 
        IonFab, IonFabButton, IonIcon, IonInput, IonAlert, IonGrid, IonRow, IonCol, IonText, IonToolbar, IonButtons } from '@ionic/react';
import { useState, useContext, Fragment, useRef } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { CapacitorHttp, HttpOptions } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep } from 'lodash';
import { useCreateGenericDocument, useFriends, UseFriendState, useUpdateGenericDocument} from '../components/Usehooks';
import { add, addCircleOutline, closeCircleOutline } from 'ionicons/icons';
import './Friends.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { FriendRow, ResolvedFriendStatus, HistoryProps} from '../components/DataTypes';
import { FriendStatus } from '../components/DBSchema';
import { checkUserByEmailExists, emailPatternValidation, apiConnectTimeout } from '../components/Utilities';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import log from 'loglevel';

/* 

Friend document structure

friendID1 : string -- _user.id of friend1 (lower ID #)
friendID2 : string -- _user.id of friend2 (higher ID #)
inviteEmail: string -- email address of friend request (friend that needs to register)
friendStatus: string
    PendingFrom1 - friend request from id1 to id2 (both in _users)
    PendingFrom2 - friend request from id2 to id1 (both in _users)
    WaitingToRegister - waiting on inviteEmail user to register
    RegisteredNotConfirmed - email user has registered, not yet confirmed
    Confirmed - friendship confirmed
    Deleted - friendship deleted
inviteUUID : string    


Critical API calls:
  /checkuserbyemailexists -- input { email: "user1@gmail.com"}
      return: { username: "user1", fullname: "User Name 1", email: "user1@gmail.com"}
  /getusersinfo
       input - json list of userIDs : userIDs: ["username1","username2"] -- should be _users ids 
            without the org.couchdb.user prefix
       return - json array of objects:
            [ {userID: "username1", email: "username1@gmail.com", fullName: "User 1"},
              {userID: "username2", email: "username2@yahoo.com", fullName: "User 2"}]


 */

interface PageState {
  newFriendEmail: string,
  newFriendName: string,
  inAddMode: boolean,
  formError: string,
  showNewUserAlert: boolean,
  newUserAlertSubheader: string,
  showRegistrationURL: boolean,
  registrationAlertSubheader: string,
}  
              
const Friends: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { remoteDBCreds, remoteDB, setRemoteDBState, remoteDBState } = useContext(RemoteDBStateContext);
  const uname = remoteDBCreds.dbUsername;
  const {useFriendState,friendRows} = useFriends(String(uname));
  const updateDoc = useUpdateGenericDocument();
  const createDoc = useCreateGenericDocument();
  const [pageState,setPageState] = useState<PageState>({
    newFriendEmail: "",
    newFriendName: "",
    inAddMode: false,
    formError: "",
    showNewUserAlert: false,
    newUserAlertSubheader: "",
    showRegistrationURL: false,
    registrationAlertSubheader: ""
  });
  const [presentToast] = useIonToast();
  const screenLoading = useRef(true);
  const { t } = useTranslation();

  if (useFriendState === UseFriendState.error) { return (
    <ErrorPage errorText={t("error.loading_friend_info") as string}></ErrorPage>
    )};

  if (useFriendState !== UseFriendState.rowsLoaded) {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_friends")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  async function confirmFriend(friendRow: FriendRow) {
    let updatedDoc = cloneDeep(friendRow.friendDoc);
    updatedDoc.friendStatus = FriendStatus.Confirmed;
    let result = await updateDoc(updatedDoc);
    if (!result.successful) {
      presentToast({"message": t("error.confirming_friend")})
    }
  }

  function showURL(friendRow: FriendRow) {
    let confURL = remoteDBCreds.apiServerURL + "/createaccountui?uuid="+friendRow.friendDoc.inviteUUID;
    Clipboard.write({string: confURL});
    setPageState(prevState => ({...prevState,formError: "", inAddMode: false, newFriendEmail: "",
            showRegistrationURL: true,
            registrationAlertSubheader: t("general.email_sent",{ email: pageState.newFriendEmail, url: confURL})
            }))
    }

  function ButtonElem(friendRow: FriendRow) {
    if (friendRow.resolvedStatus === ResolvedFriendStatus.WaitingToRegister) {
      return(
        <IonButton size="small" className="extra-small-button" onClick={() => showURL(friendRow)}>{t("general.url")}</IonButton> 
      )
    }
    else if (friendRow.resolvedStatus === ResolvedFriendStatus.PendingConfirmation)
    {
      return(<IonButton size="small" className="extra-small-button" onClick={() => confirmFriend(friendRow)}>{t("general.confirm")}</IonButton>);
    }
  }

  let friendsElem: JSX.Element[] = [];

  function updateFriendsElem() {
    let friendRowsElem: JSX.Element[] = [];
    if (friendRows.length > 0) {
      let elem=(<IonRow  className="ion-justify-content-center ion-align-items-center friend-row" key={"header"}>
              <IonCol className="col-minimal-padding" size="6"><IonText color="primary" className="bold-header">Friend Name/Email</IonText></IonCol>
              <IonCol className="col-minimal-padding" size="3"><IonText color="primary" className="bold-header">Status</IonText></IonCol>
              <IonCol className="col-minimal-padding" size="3"><IonText color="primary" className="bold-header">Action</IonText></IonCol>
            </IonRow>)
      friendRowsElem.push(elem);      
      friendRows.forEach((friendRow: FriendRow) => {
        const itemKey = (friendRow.targetUserName === "" || friendRow.targetUserName === null) ? friendRow.targetEmail : friendRow.targetUserName;
        let elem=(<IonRow  className="ion-justify-content-center ion-align-items-center friend-row" key={itemKey}>
              <IonCol className="col-minimal-padding" size="6">{friendRow.targetFullName === "" ? friendRow.targetEmail : friendRow.targetFullName}</IonCol>
              <IonCol className="col-minimal-padding" size="3"><IonLabel className="friend-label">{friendRow.friendStatusText}</IonLabel></IonCol>
              <IonCol className="col-minimal-padding" size="3">{ButtonElem(friendRow)}</IonCol>
            </IonRow>)
        friendRowsElem.push(elem);
      });
    }
    friendsElem.push(
      <IonGrid key="friendsgrid">
        {friendRowsElem}
      </IonGrid>
    )
  }
   
  function addNewFriend() {
    setPageState(prevState => ({...prevState,inAddMode: true, formError: "", newFriendEmail:"", newFriendName: ""}))
  }

  async function sendFriendRequest() {
    const invuid=uuidv4();
    const newFriendDoc = {
      type: "friend",
      friendID1: remoteDBCreds.dbUsername,
      friendID2: null,
      inviteEmail: pageState.newFriendEmail,
      inviteUUID: invuid,
      friendStatus: FriendStatus.WaitingToRegister,
      updatedAt: (new Date()).toISOString()

    }
    let createFriendSuccessful=true;
    try { await (remoteDB as PouchDB.Database).post(newFriendDoc) } 
    catch(e) {createFriendSuccessful=false; log.error("SendFriendRequest",e)}
    if (!createFriendSuccessful) { log.error("Creating friend"); return false;}

    const options: HttpOptions = {
      url: String(remoteDBCreds.apiServerURL+"/triggerregemail"),
      method: "POST",
      headers: { 'Content-Type': 'application/json',
                 'Accept': 'application/json',
                 'Authorization': 'Bearer '+remoteDBCreds?.refreshJWT },
      data: { "uuid": invuid },
      connectTimeout: apiConnectTimeout     
      };
      
    try {await CapacitorHttp.post(options)}
    catch(err) {log.error("sending friend email."); return false}

    let confURL = remoteDBCreds.apiServerURL + "/createaccountui?uuid="+invuid;
    Clipboard.write({string: confURL});
    setPageState(prevState => ({...prevState,formError: "", inAddMode: false, newFriendEmail: "",
            showRegistrationURL: true,
            registrationAlertSubheader: t("general.email_sent",{email: pageState.newFriendEmail, url: confURL})
      }))
  }

  async function submitForm() {
    if (pageState.newFriendEmail === "") {
      setPageState(prevState => ({...prevState, formError: t("error.no_email_entered")}));
      return;
    }
    if (!emailPatternValidation(pageState.newFriendEmail)) {
      setPageState(prevState => ({...prevState, formError: t("error.invalid_email_format")}));
      return;
    }
    let friendExists=false;
    friendRows.forEach((friendRow: FriendRow) => {
      if (friendRow.targetEmail === pageState.newFriendEmail) { friendExists = true}
    })
    if (friendExists) {
      setPageState(prevState => ({...prevState, formError: t("error.friend_already_exists")}));
      return;
    }
    const response = await checkUserByEmailExists(pageState.newFriendEmail,remoteDBCreds);
    if (response.apiError) {
      setPageState(prevState => ({...prevState, formError: t("error.could_not_contact_api_server")}))
      setRemoteDBState({...remoteDBState,apiServerAvailable: false})
      return;
    }
    if (response.userExists) {
      let friend1 = ""; let friend2 = ""; let pendfrom1: boolean = false;
      if (response.username > String(remoteDBCreds.dbUsername)) {
        friend1 = String(remoteDBCreds.dbUsername);
        friend2 = response.username;
        pendfrom1 = true;
      } else {
        friend1 = response.username
        friend2 = String(remoteDBCreds.dbUsername);
      }
      const newFriendDoc = {
        type: "friend",
        friendID1: friend1,
        friendID2: friend2,
        inviteEmail: "",
        inviteUUID: "",
        friendStatus: pendfrom1 ? FriendStatus.PendingFrom1 : FriendStatus.PendingFrom2
      }
      log.debug("new friend doc to create:",newFriendDoc);
      let result = await createDoc(newFriendDoc);
      if (result.successful) {
          setPageState(prevState => ({...prevState,formError: "",inAddMode: false, newFriendEmail: ""}))
      } else {
          setPageState(prevState => ({...prevState,formError: t("error.creating_friend")}))
      }    
      return
    }
    // user does not exist in _users, prompt to register
    setPageState(prevState => ({...prevState,showNewUserAlert: true ,newUserAlertSubheader: t("general.prompt_register_friend",{email: pageState.newFriendEmail})    }))

  }

  updateFriendsElem();

  let formElem = [];
  if (pageState.inAddMode) {
    formElem.push(
     <Fragment key="addfriendform">
      <IonItem key="addfriendheader">{t("general.adding_friend")}</IonItem>
      <IonItem key="addfriendemail"><IonLabel key="labelfriendemail" position="stacked">{t("general.email_address_friend")}</IonLabel>
        <IonInput key="inputfriendemail" type="email" autocomplete="email" value={pageState.newFriendEmail} onIonInput={(e) => {setPageState(prevstate => ({...prevstate, newFriendEmail: String(e.detail.value)}))}}>
        </IonInput>
      </IonItem>
      <IonItem key="blankspace"></IonItem>
      <IonItem key="formerrors"><IonText color="danger">{pageState.formError}</IonText></IonItem>
      <IonToolbar>
        <IonButtons slot="secondary">
          <IonButton key="cancelbutton" fill="outline" color="secondary" onClick={() => setPageState(prevState => ({...prevState,formError: "",  inAddMode: false, newFriendEmail: "", newFriendName: ""}))}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.cancel")}</IonButton>
        </IonButtons> 
        <IonButtons slot="end">
          <IonButton key="addbutton" fill="solid" color="primary" onClick={() => submitForm()}><IonIcon slot="start" icon={addCircleOutline}></IonIcon>{t("general.add")}</IonButton>
        </IonButtons>
      </IonToolbar>
      </Fragment>
      )
  }

  return (
    <IonPage>
      <PageHeader title={t("general.friends")} />
      <IonContent>
        <IonAlert isOpen={pageState.showNewUserAlert}
                  header={t("general.user_not_found_send_registration") as string}
                  subHeader={pageState.newUserAlertSubheader}
                  onDidDismiss={() => setPageState(prevState => ({...prevState,showNewUserAlert: false}))} 
                  buttons={[
                    { text: t("general.cancel"), role: "cancel"},
                    { text: t("general.send_registration"), role: "confirm",
                      handler: () => {sendFriendRequest();} }
                  ]}
                  />
        <IonAlert isOpen={pageState.showRegistrationURL}
                  header={t("general.url_registration_confirmation") as string}
                  subHeader={pageState.registrationAlertSubheader}
                  onDidDismiss={() => setPageState(prevState => ({...prevState,showRegistrationURL: false}))} 
                  buttons={[t("general.ok") as string]}
                  />
        <IonList id="friendslist" lines="full">
          {friendsElem}
          {formElem}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton key="addnewbutton" onClick={() => {addNewFriend()}}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Friends;
