import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem,
        IonMenuButton, IonButtons, IonButton, useIonAlert, IonInput,
        IonRadioGroup, IonRadio, IonCheckbox, isPlatform, IonItemDivider } from '@ionic/react';
import { useContext, useEffect, useState } from 'react';        
import { usePouch } from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import SyncIndicator from '../components/SyncIndicator';
import { GlobalStateContext, initSettings, GlobalSettings, AddListOptions } from '../components/GlobalState';
import { initialRemoteDBState, RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';

const Settings: React.FC<HistoryProps> = (props: HistoryProps) => {
  const db = usePouch();
  const [presentAlert] = useIonAlert();
  const {globalState, updateSettingKey} = useContext(GlobalStateContext);
  const { remoteDBCreds, setRemoteDBState } = useContext(RemoteDBStateContext);
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(initSettings)
  const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);

  useEffect( () => {
    if (!localSettingsInitialized && globalState.settingsLoaded) {
      setLocalSettings(prevState=>(globalState.settings));
      setLocalSettingsInitialized(true);
    }
  },[globalState.settings,localSettingsInitialized,globalState.settingsLoaded])

  async function stopSync() {
    let credsStr=JSON.stringify({});
    await Preferences.set({key: 'dbcreds', value: credsStr})
    if (!(isPlatform("desktop") || isPlatform("electron"))) {App.exitApp()}
    console.log("RESETTING TO INITSTATE");
    setRemoteDBState(initialRemoteDBState);
    window.location.replace('/');
//    navigate('/');
    return false;
  }

  async function destroyDB() {
    await db.destroy();
    let credsStr=JSON.stringify({});
    await Preferences.set({key: 'dbcreds', value: credsStr})
    if (!(isPlatform("desktop") || isPlatform("electron"))) {App.exitApp()}
    console.log("RESETTING TO INITSTATE");
    setRemoteDBState(initialRemoteDBState);
    window.location.replace('/');
//    navigate('/');
    return false;
  }


  function stopSyncPopup() {
    presentAlert({
      header: 'Warning',
      subHeader: '',
      message: 'Do you want to remove your saved credentials? This will cause the application to restart and allow you to sign in again if desired.',
      buttons: [
        {
          text:'Cancel',
          role: 'cancel',
          handler: () => {}},
        {
        text: 'Remove',
        role: 'confirm',
        handler: () => {stopSync()}}
        ]
    })
  }

  function destroyDBPopup() {
    presentAlert({
      header: 'Warning',
      subHeader: '',
      message: 'Do you want to remove the local database? This will cause the application to restart and allow you to sign in again if desired. It will also re-sync all data from the server.',
      buttons: [
        {
          text:'Cancel',
          role: 'cancel',
          handler: () => {}},
        {
        text: 'Remove',
        role: 'confirm',
        handler: () => {destroyDB()}}
        ]
    })
  }


  function changeSetting(key: string, value: any) {
    updateSettingKey(key,value);
    setLocalSettings(prevState => ({...prevState,[key]: value}));
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle class="ion-no-padding">Settings</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList lines="full">
          <IonItemDivider>User Info</IonItemDivider>
          <IonItem>Name: {remoteDBCreds.fullName}</IonItem>
          <IonItem>UserID: {remoteDBCreds.dbUsername}</IonItem>
          <IonItem>E-mail: {remoteDBCreds.email}</IonItem>
          <IonItem key="logout">
            <IonButton slot="start" onClick={() => stopSyncPopup()} key="stopitall">Stop Sync & Logout</IonButton>
            <IonButton slot="end" onClick={() => destroyDBPopup()} key="deletedb">Delete Local Database</IonButton>
          </IonItem>
          <IonItemDivider>Add To Other List Options</IonItemDivider> 
          <IonRadioGroup value={localSettings?.addListOption} onIonChange={(e) => changeSetting("addListOption",e.detail.value)}>
          <IonItem class="myindented" key="addallauto">
            <IonRadio class="myindented" justify="space-between" labelPlacement="start" value={AddListOptions.addToAllListsAutomatically}>Add in Same Group Automatically</IonRadio>
          </IonItem>
          <IonItem key="addcategoryauto">
            <IonRadio justify="space-between" labelPlacement="start" value={AddListOptions.addToListsWithCategoryAutomatically}>Add with same categories automatically</IonRadio>
          </IonItem>
          <IonItem key="dontaddauto">
            <IonRadio justify="space-between" labelPlacement="start" value={AddListOptions.dontAddAutomatically}>Don't Add automatically</IonRadio>
          </IonItem>
          </IonRadioGroup>
          <IonItemDivider>Other Settings</IonItemDivider>
          <IonItem key="removesettings">
            <IonCheckbox justify="space-between" labelPlacement="start" checked={localSettings.removeFromAllLists} onIonChange={(e) => changeSetting("removeFromAllLists",e.detail.checked)}>Remove items from all lists when completed</IonCheckbox>
          </IonItem>
          <IonItem key="dayslog">
            <IonInput label="Days of conflict log to view:" labelPlacement="start" type="number" min="0" max="25" onIonInput={(e) => changeSetting("daysOfConflictLog", e.detail.value)} value={Number(localSettings?.daysOfConflictLog)}></IonInput>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
