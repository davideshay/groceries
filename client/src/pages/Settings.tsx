import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem,
        IonMenuButton, IonButtons, IonButton, useIonAlert, IonInput,
        IonRadioGroup,IonLabel, NavContext, IonRadio, IonCheckbox} from '@ionic/react';
import { useContext, useEffect, useState } from 'react';        
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import SyncIndicator from '../components/SyncIndicator';
import { GlobalStateContext, initSettings, GlobalSettings } from '../components/GlobalState';
import { AddListOptions } from '../components/GlobalState';
import { cloneDeep } from 'lodash';


const Settings: React.FC = (props) => {
  const [presentAlert] = useIonAlert();
  const {navigate} = useContext(NavContext);
  const {globalState, updateSettingKey} = useContext(GlobalStateContext);
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(initSettings)
  const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);

  useEffect( () => {
    if (!localSettingsInitialized && globalState.settingsLoaded) {
      setLocalSettings((globalState.settings));
      setLocalSettingsInitialized(true);
    }
  },[localSettings,globalState.settingsLoaded])

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

  function changeSetting(key: string, value: any) {
    updateSettingKey(key,value);
    setLocalSettings(prevState => ({...prevState,[key]: value}));
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
        <IonList lines="full">
          <IonItem key="logout">
            <IonButton onClick={() => stopSyncPopup()} key="stopitall">Stop Sync, Logout, and Remove Credentials</IonButton>
          </IonItem>
          <IonRadioGroup value={localSettings?.addListOption} onIonChange={(e) => changeSetting("addListOption",e.detail.value)}>
          <IonLabel position="stacked">Add To List Options</IonLabel>
          <IonItem key="addallauto">
             <IonLabel>Add Items to All Lists automatically</IonLabel>
            <IonRadio value={AddListOptions.addToAllListsAutomatically} slot="start"></IonRadio>
          </IonItem>
          <IonItem key="addcategoryauto">
             <IonLabel>Add Items to Lists with matching categories automatically</IonLabel>
            <IonRadio value={AddListOptions.addToListsWithCategoryAutomatically} slot="start"></IonRadio>
          </IonItem>
          <IonItem key="dontaddauto">
             <IonLabel>Don't Add items to other lists automatically</IonLabel>
            <IonRadio value={AddListOptions.dontAddAutomatically} slot="start"></IonRadio>
          </IonItem>
          </IonRadioGroup>
          <IonLabel position="stacked">Other Settings</IonLabel>
          <IonItem key="removesettings">
            <IonLabel>Remove items from all lists when completed</IonLabel>
            <IonCheckbox slot="start" checked={localSettings.removeFromAllLists} onIonChange={(e) => changeSetting("removeFromAllLists",e.detail.checked)}></IonCheckbox>
          </IonItem>
          <IonItem key="dayslog">
            <IonLabel>Days of conflict log to view</IonLabel>
            <IonInput type="number" min="0" max="25" onIonChange={(e: any) => changeSetting("daysOfConflictLog", e.detail.value)} value={Number(localSettings?.daysOfConflictLog)}></IonInput>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
