import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem,
        IonMenuButton, IonButtons, IonButton, useIonAlert, IonInput,
        IonRadioGroup,IonLabel, NavContext, IonRadio, IonCheckbox, IonTextarea, isPlatform, getPlatforms} from '@ionic/react';
import { useContext, useEffect, useState } from 'react';        
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import SyncIndicator from '../components/SyncIndicator';
import { GlobalStateContext, initSettings, GlobalSettings, AddListOptions } from '../components/GlobalState';
import { initialRemoteDBState, RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';

const Settings: React.FC<HistoryProps> = (props: HistoryProps) => {
  const [presentAlert] = useIonAlert();
  const {globalState, updateSettingKey} = useContext(GlobalStateContext);
  const { setRemoteDBState } = useContext(RemoteDBStateContext);
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
          <SyncIndicator history={props.history}/>
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
            <IonRadio value={AddListOptions.addToAllListsAutomatically} slot="start">Add Items To All Lists automatically</IonRadio>
          </IonItem>
          <IonItem key="addcategoryauto">
            <IonRadio value={AddListOptions.addToListsWithCategoryAutomatically} slot="start">Add Items to Lists with matching categories automatically</IonRadio>
          </IonItem>
          <IonItem key="dontaddauto">
            <IonRadio value={AddListOptions.dontAddAutomatically} slot="start">Don't Add items to other lists automatically</IonRadio>
          </IonItem>
          </IonRadioGroup>
          <IonLabel position="stacked">Other Settings</IonLabel>
          <IonItem key="removesettings">
            <IonCheckbox slot="start" checked={localSettings.removeFromAllLists} onIonChange={(e) => changeSetting("removeFromAllLists",e.detail.checked)}>Remove items from all lists when completed</IonCheckbox>
          </IonItem>
          <IonTextarea aria-label="NOTE" disabled={true}>NOTE: Adding and removing from all lists is only done with lists that have the same set of shared owners/participants.</IonTextarea>
          <IonItem key="dayslog">
            <IonInput label="Days of conflict log to view:" labelPlacement="start" type="number" min="0" max="25" onIonChange={(e: any) => changeSetting("daysOfConflictLog", e.detail.value)} value={Number(localSettings?.daysOfConflictLog)}></IonInput>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
