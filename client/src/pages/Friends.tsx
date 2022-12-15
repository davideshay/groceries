import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons, IonButton, useIonAlert, NavContext} from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import { useCreateGenericDocument, useUpdateGenericDocument } from '../components/itemhooks';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import { GlobalStateContext } from '../components/GlobalState';
import { compassSharp } from 'ionicons/icons';


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
  const { globalState, setGlobalState, setStateInfo} = useContext(GlobalStateContext);

  const uname = (globalState.dbCreds as any).dbUsername;
  
  // const { docs, loading, error } = useFind({
  //   index: { fields: ["type","friendID1","friendID2"]},
  //   selector: { 
  //     "$and": [
  //       { "type": "friend"},
  //       { "$or": [
  //         { "friendID1" : uname },
  //         { "friendID2" : uname }
  //       ]}
  //     ]      
  //   },
  //   sort: [ "type", "friendID1", "friendID2" ]
  //   })

  const { docs, loading, error } = useFind({
    index: { fields: ["type","friendID1","friendID2"]},
    selector: { "$and": [ {
        "type": "friend",
        "friendID1": { "$exists": true },
        "friendID2": { "$exists" : true} }, 
        { "$or" : [{"friendID1": uname},{"friendID2": uname}]}
    ]  
    },
    sort: [ "type", "friendID1", "friendID2" ],
    fields: [ "type", "friendID1", "friendID2", "friendStatus"]
    })

  let friendsElem: any =[];
  if (!loading) {
    docs.forEach((element: any) => {
      let friendEmail=(element.friendID1 == globalState.dbCreds?.dbUsername) ? element.friendID2 : element.friendID1
      friendsElem.push(
        <IonItem key={friendEmail}><IonLabel>{friendEmail}</IonLabel><IonLabel>{element.friendStatus}</IonLabel></IonItem>
      )
    });
  } 


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
