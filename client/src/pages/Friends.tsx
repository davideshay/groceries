import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons, IonButton, useIonAlert, NavContext} from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import { useCreateGenericDocument, useUpdateGenericDocument } from '../components/itemhooks';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';

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






 */
const Friends: React.FC = (props) => {
  const [presentAlert] = useIonAlert();
  const {navigate} = useContext(NavContext);

  const { docs, loading, error } = useFind({
    index: { fields: ["type","name"]},
    selector: { type: "category", name: { $exists: true }},
    sort: [ "type", "name" ]
    })


  async function stopSync() {
    let credsStr=JSON.stringify({});
    await Preferences.set({key: 'dbcreds', value: credsStr})
    App.exitApp()
    navigate("/","back","replace");
  }

  function stopSyncPopup() {
    presentAlert({
      header: 'Warning',
      subHeader: '',
      message: 'Do you want to remove your saved credentials? This will cause the application to restart and allow you to sign in again if desired.',
      buttons: [{
        text: 'Remove',
        role: 'confirm',
        handler: () => {stopSync()}}
        ,{
        text:'Cancel',
        role: 'cancel',
        handler: () => {}}]

    })

  }


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
          <IonItem>
            <IonButton onClick={() => stopSyncPopup()} key="stopitall">Stop Sync, Logout, and Remove Credentials</IonButton>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Friends;
