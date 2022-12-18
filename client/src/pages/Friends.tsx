import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons, IonButton, useIonAlert, NavContext,
        IonFab, IonFabButton, IonIcon, IonInput } from '@ionic/react';
import { useState, useEffect, useContext, Fragment } from 'react';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { useCreateGenericDocument, useFriends, useUpdateGenericDocument} from '../components/Usehooks';
import { add } from 'ionicons/icons';
import './Friends.css';
import { GlobalStateContext } from '../components/GlobalState';
import { FriendRow, FriendStatus, ResolvedFriendStatus } from '../components/DataTypes';
import { checkUserByEmailExists, emailPatternValidation } from '../components/Utilities';

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
}  
              
const Friends: React.FC = (props) => {
  const { globalState} = useContext(GlobalStateContext);
  const uname = (globalState.dbCreds as any).dbUsername;
  const {friendsLoading,friendRows} = useFriends(uname);
  const updateDoc = useUpdateGenericDocument();
  const [friendsElem,setFriendsElem] = useState<any[]>([]);
  const [pageState,setPageState] = useState<PageState>({
    newFriendEmail: "",
    newFriendName: "",
    inAddMode: false,
    formError: ""
  })

  function confirmFriend(friendRow: FriendRow) {
    let updatedDoc = {
      _id : friendRow.friendRelID,
      _rev : friendRow.friendRev,
      type: "friend",
      friendID1: friendRow.friendID1,
      friendID2: friendRow.friendID2,
      inviteEmail: null,
      friendStatus: FriendStatus.Confirmed
    } 
    updateDoc(updatedDoc);
  }

  function statusItem(friendRow: FriendRow) {
    if (friendRow.resolvedStatus == ResolvedFriendStatus.PendingConfirmation)
    {
      return (<IonButton onClick={() => confirmFriend(friendRow)}>Confirm Friend</IonButton>)
    } else {
      return (<IonLabel>{friendRow.friendStatusText}</IonLabel>)
    }
  }

  function updateFriendsElem() {
    if (friendRows.length > 0) {
      setFriendsElem(prevState => ([]));
      console.log(friendRows);
      friendRows.forEach((friendRow: FriendRow) => {
        let elem: any =<IonItem key={friendRow.targetUserName}><IonLabel>{friendRow.targetUserName}</IonLabel>{statusItem(friendRow)}<IonLabel>{friendRow.targetEmail}</IonLabel><IonLabel>{friendRow.targetFullName}</IonLabel></IonItem>
        setFriendsElem((prevState : any) => ([...prevState,elem]))
      });
    }
  }
   
  useEffect( () => {
    console.log("Friend Rows Changed: ",{friendRows});
    updateFriendsElem();
  },[friendRows])

  function addFriend() {

  }

  function addNewFriend() {
    setPageState(prevState => ({...prevState,inAddMode: true, formError: "", newFriendEmail:"", newFriendName: ""}))
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
    const response = await checkUserByEmailExists(pageState.newFriendEmail,globalState);
    console.log("response to check user", response);
    if (response.userExists) {
      let friend1 = ""; let friend2 = ""; let pendfrom1: boolean = false;
      if (response.username > String(globalState.dbCreds?.dbUsername)) {
        friend1 = String(globalState.dbCreds?.dbUsername);
        friend2 = response.username;
        pendfrom1 = true;
      } else {
        friend1 = response.username
        friend2 = String(globalState.dbCreds?.dbUsername);
      }
      const newFriendDoc = {
        friendID1: friend1,
        friendID2: friend2,
        inviteEmail: "",
        friendStatus: pendfrom1 ? FriendStatus.PendingFrom1 : FriendStatus.PendingFrom2
      }
    }






    // check if email exists by user... if so, just add to friend list as unconfirmed and proceed
    // if not, present alert asking if want to send registration

  }

/*   <IonItem key="addfriendemail"><IonLabel key="labelfriendemail" position="stacked">E-Mail address for friend to add</IonLabel>
  <IonInput key="inputfriendemail" type="email" autocomplete="email" value={pageState.newFriendEmail} onIonChange={(e) => {setPageState(prevstate => ({...prevstate, newFriendEmail: String(e.detail.value)}))}}>
  </IonInput>
</IonItem>
<IonItem key="blankspace"></IonItem>
<IonItem key="formbuttons">
  <IonButton key="addbutton" slot="start" onClick={() => submitForm()}>Add</IonButton>
  <IonButton key="cancelbutton" slot="end" onClick={() => setPageState(prevState => ({...prevState,formError: "",  inAddMode: false, newFriendEmail: "", newFriendName: ""}))}>Cancel</IonButton>
</IonItem>
<IonItem key="formerrors">{pageState.formError}</IonItem>
 */


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
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
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
