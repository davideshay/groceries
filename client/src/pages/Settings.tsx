import { IonContent, IonPage, IonList, IonItem,
        IonButton, useIonAlert, IonInput,
        IonRadioGroup, IonRadio, IonCheckbox, isPlatform, IonItemDivider, IonSelect, IonSelectOption } from '@ionic/react';
import { useContext, useEffect, useState } from 'react';        
import { usePouch } from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import { GlobalStateContext, initSettings, GlobalSettings, AddListOptions } from '../components/GlobalState';
import { initialRemoteDBState, RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';
import { maxAppSupportedSchemaVersion, appVersion } from '../components/DBSchema';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { languageDescriptions } from '../i18n';

const Settings: React.FC<HistoryProps> = (props: HistoryProps) => {
  const db = usePouch();
  const [presentAlert] = useIonAlert();
  const {globalState, updateSettingKey} = useContext(GlobalStateContext);
  const { remoteDBCreds, setRemoteDBState } = useContext(RemoteDBStateContext);
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(initSettings)
  const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);
  const { t, i18n } = useTranslation();

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
      header: t("error.warning"),
      subHeader: '',
      message: t("general.remove_saved_credentials"),
      buttons: [
        {
          text: t("general.cancel"),
          role: 'cancel',
          handler: () => {}},
        {
        text: t("general.remove"),
        role: 'confirm',
        handler: () => {stopSync()}}
        ]
    })
  }

  function destroyDBPopup() {
    presentAlert({
      header: t("error.warning"),
      subHeader: '',
      message: t("general.want_remove_local_database"),
      buttons: [
        {
          text:t("general.cancel"),
          role: 'cancel',
          handler: () => {}},
        {
        text: t("general.remove"),
        role: 'confirm',
        handler: () => {destroyDB()}}
        ]
    })
  }

  function changeSetting(key: string, value: AddListOptions | boolean | number) {
    updateSettingKey(key,value);
    setLocalSettings(prevState => ({...prevState,[key]: value}));
  }

  const curLanguage = i18n.resolvedLanguage;

  return (
    <IonPage>
      <PageHeader title={t("general.settings")} />
      <IonContent fullscreen>
        <IonList lines="full">
          <IonItemDivider>{t("general.app_info")}</IonItemDivider>
          <IonItem>{t("general.app_version")} : {appVersion}</IonItem>
          <IonItem>{t("general.database_schema_version")}: {maxAppSupportedSchemaVersion}</IonItem>
          <IonItemDivider>{t("general.user_info")}</IonItemDivider>
          <IonItem>{t("general.name")}: {remoteDBCreds.fullName}</IonItem>
          <IonItem>{t("general.user_id")}: {remoteDBCreds.dbUsername}</IonItem>
          <IonItem>{t("general.email")}: {remoteDBCreds.email}</IonItem>
          <IonItem key="logout">
            <IonButton slot="start" onClick={() => stopSyncPopup()} key="stopitall">{t("general.logout")}</IonButton>
            <IonButton slot="end" onClick={() => destroyDBPopup()} key="deletedb">{t("general.delete_local_data")}</IonButton>
          </IonItem>
          <IonItemDivider>{t("general.add_other_list_options")}</IonItemDivider> 
          <IonRadioGroup value={localSettings?.addListOption} onIonChange={(e) => changeSetting("addListOption",e.detail.value)}>
          <IonItem class="myindented" key="addallauto">
            <IonRadio class="myindented" justify="space-between" labelPlacement="start" value={AddListOptions.addToAllListsAutomatically}>{t("general.add_same_group_auto")}</IonRadio>
          </IonItem>
          <IonItem key="addcategoryauto">
            <IonRadio justify="space-between" labelPlacement="start" value={AddListOptions.addToListsWithCategoryAutomatically}>{t("general.add_same_categories_auto")}</IonRadio>
          </IonItem>
          <IonItem key="dontaddauto">
            <IonRadio justify="space-between" labelPlacement="start" value={AddListOptions.dontAddAutomatically}>{t("general.dont_add_auto")}</IonRadio>
          </IonItem>
          </IonRadioGroup>
          <IonItemDivider>{t("general.other_settings")}</IonItemDivider>
          <IonItem key="language">
            <IonSelect label={t("general.language") as string} interface="popover" onIonChange={(e) => i18n.changeLanguage(e.detail.value)} value={curLanguage}>
                {languageDescriptions.map((lng: any) => (
                    <IonSelectOption key={"language-"+lng.key} value={lng.key}>
                      {lng.name}
                    </IonSelectOption>
                ))}
            </IonSelect>
          </IonItem>
          <IonItem key="removesettings">
            <IonCheckbox justify="space-between" labelPlacement="start" checked={localSettings.removeFromAllLists} onIonChange={(e) => changeSetting("removeFromAllLists",e.detail.checked)}>{t("general.remove_items_all_lists_purchased")}</IonCheckbox>
          </IonItem>
          <IonItem key="deletesettings">
            <IonCheckbox justify="space-between" labelPlacement="start" checked={localSettings.completeFromAllLists} onIonChange={(e) => changeSetting("completeFromAllLists",e.detail.checked)}>{t("general.delete_all_lists_when_deleting_completed")}</IonCheckbox>
          </IonItem>
          <IonItem key="dayslog">
            <IonInput label={t("general.days_conflict_log_to_view") as string} labelPlacement="start" type="number" min="0" max="25" onIonInput={(e) => changeSetting("daysOfConflictLog", Number(e.detail.value))} value={Number(localSettings?.daysOfConflictLog)}></IonInput>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
