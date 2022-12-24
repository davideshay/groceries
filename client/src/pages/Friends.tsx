import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons, IonButton, useIonAlert, NavContext, useIonToast,
        IonFab, IonFabButton, IonIcon, IonInput, IonAlert } from '@ionic/react';
import { useState, useEffect, useContext, Fragment } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep } from 'lodash';
import { useCreateGenericDocument, useFriends, useUpdateGenericDocument} from '../components/Usehooks';
import { add } from 'ionicons/icons';
import './Friends.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { GlobalStateContext } from '../components/GlobalState';
import { FriendRow, FriendStatus, ResolvedFriendStatus } from '../components/DataTypes';
import { checkUserByEmailExists, emailPatternValidation } from '../components/Utilities';
import SyncIndicator from '../components/SyncIndicator';


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
              
const Friends: React.FC = (props) => {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const uname = (remoteDBState.dbCreds as any).dbUsername;
  const {friendRowsLoading,friendsLoading,friendRows} = useFriends(uname);
  const updateDoc = useUpdateGenericDocument();
  const createDoc = useCreateGenericDocument();
  const [friendsElem,setFriendsElem] = useState<any[]>([]);
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
//  const [presentAlert,hideAlert] = useIonAlert();

  async function confirmFriend(friendRow: FriendRow) {
    let updatedDoc = cloneDeep(friendRow.friendDoc);
    updatedDoc.friendStatus = FriendStatus.Confirmed;
    let result = await updateDoc(updatedDoc);
    if (!result.successful) {
      presentToast({"message": "Error confirming friend. Please retry."})
    }
  }

  function statusItem(friendRow: FriendRow) {
    if (friendRow.resolvedStatus == ResolvedFriendStatus.PendingConfirmation)
    {
      return (<IonButton onClick={() => confirmFriend(friendRow)}>Confirm Friend</IonButton>)
    } else {
      return (<IonLabel>{friendRow.friendStatusText}</IonLabel>)
    }
  }

  function showURL(friendRow: FriendRow) {
    let confURL = remoteDBState.dbCreds.apiServerURL + "/createaccountui?uuid="+friendRow.friendDoc.inviteUUID;
    Clipboard.write({string: confURL});
    setPageState(prevState => ({...prevState,formError: "", inAddMode: false, newFriendEmail: "",
            showRegistrationURL: true,
            registrationAlertSubheader: "An email has been sent to "+pageState.newFriendEmail+" to confirm and create their account. The URL is here: " + confURL+ " . This has also been copied to the clipboard."}))
    }

  function URLButtonElem(friendRow: FriendRow) {
    if (friendRow.resolvedStatus == ResolvedFriendStatus.WaitingToRegister) {
      return(
        <IonButton onClick={() => showURL(friendRow)}>Show URL</IonButton> 
      )
    }
    else {
      return([]);
    }
  }

  function updateFriendsElem() {
    setFriendsElem(prevState => ([]));
    if (friendRows.length > 0) {
      console.log(friendRows);
      friendRows.forEach((friendRow: FriendRow) => {
        const itemKey = (friendRow.targetUserName == "" || friendRow.targetUserName == null) ? friendRow.targetEmail : friendRow.targetUserName;
        let elem: any =<IonItem key={itemKey}>{URLButtonElem(friendRow)}{statusItem(friendRow)}<IonLabel>{friendRow.targetEmail}</IonLabel><IonLabel>{friendRow.targetFullName}</IonLabel></IonItem>
        setFriendsElem((prevState : any) => ([...prevState,elem]))
      });
    }
  }
   
  useEffect( () => {
    console.log("Friend Rows Changed: ",{friendRows,friendRowsLoading});
    if (!friendRowsLoading) {
      updateFriendsElem();
    }  
  },[friendRows,friendRowsLoading])

  function addNewFriend() {
    setPageState(prevState => ({...prevState,inAddMode: true, formError: "", newFriendEmail:"", newFriendName: ""}))
  }

  async function sendFriendRequest() {
    console.log("in sendFriendRequest");
//    hideAlert();
    const invuid=uuidv4();
    const newFriendDoc = {
      type: "friend",
      friendID1: remoteDBState.dbCreds.dbUsername,
      friendID2: null,
      inviteEmail: pageState.newFriendEmail,
      inviteUUID: invuid,
      friendStatus: FriendStatus.WaitingToRegister
    }
    console.log(newFriendDoc);

    let createFriendSuccessful=true; let createResults;
    try { createResults = await remoteDBState.remoteDB?.post(newFriendDoc) } 
    catch(e) {createFriendSuccessful=false; console.log(e)}
    console.log({createResults});
//    let result=await createDoc(newFriendDoc);
//    console.log(result);
    const options = {
      url: String(remoteDBState.dbCreds.apiServerURL+"/triggerregemail"),
      method: "POST",
      headers: { 'Content-Type': 'application/json',
                 'Accept': 'application/json'},
      data: { "uuid": invuid }           
      };
    console.log("about to execute triggerregemail httpget with options: ", {options})
    let response = await CapacitorHttp.post(options);
    console.log("got triggerregemail httpget response: ",{response});

    let confURL = remoteDBState.dbCreds.apiServerURL + "/createaccountui?uuid="+invuid;
    Clipboard.write({string: confURL});
    setPageState(prevState => ({...prevState,formError: "", inAddMode: false, newFriendEmail: "",
            showRegistrationURL: true,
            registrationAlertSubheader: "An email has been sent to "+pageState.newFriendEmail+" to confirm and create their account. The URL is here: " + confURL+ " . This has also been copied to the clipboard."}))
    console.log("about to present new alert");
  }

  async function submitForm() {
    console.log("in submit form");
    if (pageState.newFriendEmail == "") {
      setPageState(prevState => ({...prevState, formError: "Please enter an email address"}));
      return
    }
    if (!emailPatternValidation(pageState.newFriendEmail)) {
      setPageState(prevState => ({...prevState, formError: "Invalid email address"}));
    }
    console.log("... add friend here ...");
    const response = await checkUserByEmailExists(pageState.newFriendEmail,remoteDBState);
    console.log("response to check user", response);
    if (response.userExists) {
      let friend1 = ""; let friend2 = ""; let pendfrom1: boolean = false;
      if (response.username > String(remoteDBState.dbCreds.dbUsername)) {
        friend1 = String(remoteDBState.dbCreds.dbUsername);
        friend2 = response.username;
        pendfrom1 = true;
      } else {
        friend1 = response.username
        friend2 = String(remoteDBState.dbCreds.dbUsername);
      }
      const newFriendDoc = {
        type: "friend",
        friendID1: friend1,
        friendID2: friend2,
        inviteEmail: "",
        inviteUUID: "",
        friendStatus: pendfrom1 ? FriendStatus.PendingFrom1 : FriendStatus.PendingFrom2
      }
      console.log(newFriendDoc);
      let result = await createDoc(newFriendDoc);
      if (result.successful) {
          setPageState(prevState => ({...prevState,formError: "",inAddMode: false, newFriendEmail: ""}))
      } else {
          setPageState(prevState => ({...prevState,formError: "Error creating friend. Please retry."}))
      }    
      return
    }
    // user does not exist in _users, prompt to register
    setPageState(prevState => ({...prevState,showNewUserAlert: true ,newUserAlertSubheader: "There is no user with email "+pageState.newFriendEmail+" currently registered. Do you want to ask them to register?"}))

  }

  let formElem: any[] = [];
  if (pageState.inAddMode) {
    formElem.push(
     <Fragment key="addfriendform">
      <IonItem key="addfriendheader">Adding a new Friend</IonItem>
      <IonItem key="addfriendemail"><IonLabel key="labelfriendemail" position="stacked">E-Mail address for friend to add</IonLabel>
        <IonInput key="inputfriendemail" type="email" autocomplete="email" value={pageState.newFriendEmail} onIonChange={(e) => {setPageState(prevstate => ({...prevstate, newFriendEmail: String(e.detail.value)}))}}>
        </IonInput>
      </IonItem>
      <IonItem key="blankspace"></IonItem>
      <IonItem key="formbuttons">
        <IonButton key="addbutton" slot="start" onClick={() => submitForm()}>Add</IonButton>
        <IonButton key="cancelbutton" slot="end" onClick={() => setPageState(prevState => ({...prevState,formError: "",  inAddMode: false, newFriendEmail: "", newFriendName: ""}))}>Cancel</IonButton>
      </IonItem>
      <IonItem key="formerrors">{pageState.formError}</IonItem>
      </Fragment>
      )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons key="buttonsinmenu" slot="start"><IonMenuButton key="menuhamburger" /></IonButtons>
          <IonTitle>Friends</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonAlert isOpen={pageState.showNewUserAlert}
                  header="User not found, send registration request?"
                  subHeader={pageState.newUserAlertSubheader}
                  onDidDismiss={() => setPageState(prevState => ({...prevState,showNewUserAlert: false}))} 
                  buttons={[
                    { text: "Cancel", role: "cancel"},
                    { text: "Send Registration", role: "confirm",
                      handler: () => {sendFriendRequest();} }
                  ]}
                  />
        <IonAlert isOpen={pageState.showRegistrationURL}
                  header="URL for Registration Confirmation"
                  subHeader={pageState.registrationAlertSubheader}
                  onDidDismiss={() => setPageState(prevState => ({...prevState,showRegistrationURL: false}))} 
                  buttons={["OK"]}
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
