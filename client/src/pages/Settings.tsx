import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons, IonButton, useIonAlert, NavContext} from '@ionic/react';
import { useContext } from 'react';        
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import SyncIndicator from '../components/SyncIndicator';


const Settings: React.FC = (props) => {
  const [presentAlert] = useIonAlert();
  const {navigate} = useContext(NavContext);

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
          <SyncIndicator />
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

export default Settings;
