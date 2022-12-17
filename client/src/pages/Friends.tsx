import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons, IonButton, useIonAlert, NavContext} from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { useCreateGenericDocument, useFriends, useUpdateGenericDocument} from '../components/Usehooks';
import './Settings.css';
import { GlobalStateContext } from '../components/GlobalState';
import { FriendRow, FriendStatus, ResolvedFriendStatus } from '../components/DataTypes';

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
const Friends: React.FC = (props) => {
  const [presentAlert] = useIonAlert();
  const {navigate} = useContext(NavContext);
  const { globalState} = useContext(GlobalStateContext);
  const uname = (globalState.dbCreds as any).dbUsername;
  const friendRows = useFriends(uname);
  const updateDoc = useUpdateGenericDocument();
  const [friendsElem,setFriendsElem] = useState<any[]>([]);

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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Friends</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
          {friendsElem}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Friends;
