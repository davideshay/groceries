import { IonContent, IonPage, IonList, IonItem,
        IonButton, useIonAlert, IonInput,
        IonRadioGroup, IonRadio, IonCheckbox, isPlatform, IonItemDivider, IonSelect, IonSelectOption, IonButtons, IonToolbar, IonText, IonIcon, IonGrid, IonRow, IonCol } from '@ionic/react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';        
import { closeCircle, checkmarkCircle } from 'ionicons/icons';
import { usePouch } from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import { InitSettings } from '../components/DBSchema';
import { GlobalStateContext } from '../components/GlobalState';
import { initialRemoteDBState, RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps, UserInfo, initUserInfo } from '../components/DataTypes';
import { maxAppSupportedSchemaVersion, appVersion , GlobalSettings, AddListOptions} from '../components/DBSchema';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { languageDescriptions } from '../i18n';
import { isEmpty, isEqual } from 'lodash';
import { checkUserByEmailExists, emailPatternValidation, fullnamePatternValidation, secondsToDHMS, updateUserInfo } from '../components/Utilities';
import { cloneDeep } from 'lodash';
import Loading from '../components/Loading';
import { getTokenInfo, isDBServerAvailable, isServerAvailable } from '../components/RemoteUtilities';
import log from 'loglevel';

type ErrorInfo = {
  isError: boolean,
  fullNameError: string,
  emailError: string,
  formError: string
}

const ErrorInfoInit: ErrorInfo = {
  isError: false,
  fullNameError: "",
  emailError: "",
  formError: ""
}

const Settings: React.FC<HistoryProps> = (props: HistoryProps) => {
  const db = usePouch();
  const [presentAlert] = useIonAlert();
  const {globalState, settingsLoading, updateSettingKey} = useContext(GlobalStateContext);
  const { remoteDBCreds, setDBCredsValue, remoteDBState, setRemoteDBState } = useContext(RemoteDBStateContext);
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(InitSettings)
  const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>(initUserInfo);
  const [errorInfo,setErrorInfo] = useState<ErrorInfo>(cloneDeep(ErrorInfoInit));
  const { t, i18n } = useTranslation();
  const screenLoading = useRef(false);
  const [, forceUpdateState] = useState<{}>();
  const forceUpdate = useCallback(() => forceUpdateState({}), []);



  useEffect( () => {
    async function checkAPIServerAvailable(apiServerURL: string|null) {
      let apiServerAvailable = await isServerAvailable(apiServerURL);
      let dbServerAvailable = await isDBServerAvailable(remoteDBCreds.refreshJWT,remoteDBCreds.couchBaseURL);
      log.debug("API Server Available response:",apiServerAvailable);
      log.debug("DB Server Available response:",dbServerAvailable);
      if (apiServerAvailable.apiServerAvailable) {
        setRemoteDBState(prevState=>({...prevState,apiServerAvailable: apiServerAvailable.apiServerAvailable, dbServerAvailable: apiServerAvailable.dbServerAvailable}))
      } else {
        setRemoteDBState(prevState=>({...prevState,apiServerAvailable: apiServerAvailable.apiServerAvailable, dbServerAvailable: dbServerAvailable}))
      }  
    }

    log.debug("checking is API server is available in useeffect...");
    checkAPIServerAvailable(remoteDBCreds.apiServerURL);
  },[remoteDBCreds.apiServerURL,remoteDBCreds.refreshJWT,remoteDBCreds.couchBaseURL,setRemoteDBState])

  useEffect( () => {
    const refreshInterval = setInterval( () => {forceUpdate()},1000);
    return () => clearInterval(refreshInterval);
  },[forceUpdate])

  useEffect( () => {
    if (!localSettingsInitialized && globalState.settingsLoaded) {
      setLocalSettings(prevState=>(globalState.settings));
      setUserInfo({name: String(remoteDBCreds.dbUsername), email: String(remoteDBCreds.email), fullname: String(remoteDBCreds.fullName)})
      setLocalSettingsInitialized(true);
    }
  },[globalState.settings,localSettingsInitialized,globalState.settingsLoaded, remoteDBCreds.fullName, remoteDBCreds.email, remoteDBCreds.dbUsername])

  if ( settingsLoading || !globalState.settingsLoaded || !localSettingsInitialized)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };

  async function destroyDB() {
    await db.destroy();
    let credsStr=JSON.stringify({});
    await Preferences.set({key: 'dbcreds', value: credsStr})
    if (!(isPlatform("desktop") || isPlatform("electron"))) {App.exitApp()}
    setRemoteDBState(initialRemoteDBState);
    window.location.replace('/');
    return false;
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

  async function doUpdateUserInfo() {
    let errorFound=false;
    setErrorInfo(prevState=>({...prevState,emailError: "", fullNameError:"",formError: "",isError: false}));
    if (isEmpty(userInfo.email) || !emailPatternValidation(String(userInfo.email))) {
      errorFound=true;setErrorInfo(prevState=>({...prevState,emailError:t("error.invalid_email_format"),isError: true}))
    }
    if (isEmpty(userInfo.fullname) || !fullnamePatternValidation(String(userInfo.fullname))) {
      errorFound=true;setErrorInfo(prevState=>({...prevState,emailError:t("error.invalid_fullname_format"),isError: true}))      
    }
    if (errorFound) return;
    if (isEqual(userInfo,{name: remoteDBCreds.dbUsername, email: remoteDBCreds.email, fullname: remoteDBCreds.fullName})) {
      setErrorInfo(prevState=>({...prevState,formError: "No changes made, not updating"}))
      return;
    }
    if (userInfo.email !== remoteDBCreds.email) {
        let checkExists = await checkUserByEmailExists(userInfo.email,remoteDBCreds);
        if (checkExists.userExists && checkExists.username !== remoteDBCreds.dbUsername) {
          setErrorInfo(prevState=>({...prevState,emailError: "Email already exists under different user", isError: true}));
          return;
        }
    }
    let updateSuccess = await updateUserInfo(String(remoteDBCreds.apiServerURL),remoteDBState.accessJWT,userInfo)
    if (!updateSuccess) {
      setErrorInfo(prevState=>({...prevState,formError: "Error updating user info, retry"}));
      return
    }
    setDBCredsValue("email",userInfo.email);
    setDBCredsValue("fullName",userInfo.fullname);    
    setErrorInfo(prevState=>({...prevState,formError: "User Info Saved"}));
  }

  const curLanguage = i18n.resolvedLanguage;
  const accessSecondsToExpire = remoteDBState.accessJWTExpirationTime === 0 ? 0 : Number(remoteDBState.accessJWTExpirationTime) - (Math.round(Date.now() / 1000));
  const refreshJWTInfo = getTokenInfo(String(remoteDBCreds.refreshJWT),false);
  const refreshSecondsToExpire = Number(refreshJWTInfo.expireDate) - Math.round(Date.now() / 1000);

  return (
    <IonPage>
      <PageHeader title={t("general.settings")} />
      <IonContent fullscreen>
        <IonList lines="none">
          <IonItemDivider className="category-divider">{t("general.app_info")}</IonItemDivider>
          <IonItem className="shorter-item-some-padding">{t("general.app_version")} : {appVersion}</IonItem>
          <IonItem className="shorter-item-some-padding">{t("general.database_schema_version")}: {maxAppSupportedSchemaVersion}</IonItem>
          <IonItem className="shorter-item-some-padding">
            <IonGrid class="ion-no-padding">
              <IonRow><IonCol size="4">{t("general.api_server_status")}</IonCol>
              <IonCol size="1">{remoteDBState.apiServerAvailable ? <IonIcon icon={checkmarkCircle} className="online-indicator"></IonIcon> :
                                <IonIcon icon={closeCircle} className="offline-indicator"></IonIcon> }</IonCol>
              <IonCol size="4">{t("general.db_server_status")}:</IonCol>
              <IonCol size="1">{remoteDBState.dbServerAvailable ? <IonIcon icon={checkmarkCircle} className="online-indicator"></IonIcon> :
                                <IonIcon icon={closeCircle} className="offline-indicator"></IonIcon> }</IonCol></IonRow>
              <IonRow><IonCol size="4">{t("general.refresh_token_valid")}</IonCol>
              <IonCol size="1">{refreshSecondsToExpire > 0 ? <IonIcon icon={checkmarkCircle} className="online-indicator"></IonIcon> :
                                <IonIcon icon={closeCircle} className="offline-indicator"></IonIcon> }</IonCol>
              <IonCol size="3">{refreshSecondsToExpire >= 0 ? t("general.expires_in") : t("general.expired_by")}</IonCol>
              <IonCol size="4">{secondsToDHMS(refreshSecondsToExpire)}</IonCol></IonRow>
              <IonRow><IonCol size="4">{t("general.access_token_valid")}</IonCol>
              <IonCol size="1">{accessSecondsToExpire > 0 ? <IonIcon icon={checkmarkCircle} className="online-indicator"></IonIcon> :
                                <IonIcon icon={closeCircle} className="offline-indicator"></IonIcon> }</IonCol>
              <IonCol size="3">{accessSecondsToExpire >= 0 ? t("general.expires_in") : t("general.expired_by")}</IonCol>
              <IonCol size="4">{secondsToDHMS(accessSecondsToExpire)}</IonCol></IonRow>
            </IonGrid>
          </IonItem>                                      
          <IonItemDivider className="category-divider">{t("general.user_info")}</IonItemDivider>
          <IonItem className="shorter-item-no-padding">
            <IonInput className="shorter-input shorter-input2" type="text" disabled={true} labelPlacement="stacked" label={t("general.user_id") as string} value={userInfo.name} />
          </IonItem>
          <IonItem className="shorter-item-no-padding">
            <IonInput type="text" labelPlacement="stacked" label={t("general.name") as string}
                      disabled={!(remoteDBState.apiServerAvailable &&remoteDBState.dbServerAvailable)}
                      value={userInfo.fullname} errorText={errorInfo.fullNameError}
                      className={(errorInfo.isError ? "ion-invalid": "ion-valid")+(" ion-touched shorter-input shorter-input2") }
                      onIonInput={(ev) => {
                        setUserInfo(prevState=>({...prevState,fullname: String(ev.detail.value)}));
                        setErrorInfo(prevState=>({...prevState,isTouched: true}))}} />
          </IonItem>
          <IonItem className="shorter-item-no-padding">
            <IonInput type="text" labelPlacement="stacked" label={t("general.email") as string}
                      disabled={!(remoteDBState.apiServerAvailable &&remoteDBState.dbServerAvailable)}
                      value={userInfo.email} errorText={errorInfo.emailError}
                      className={(errorInfo.isError ? "ion-invalid": "ion-valid")+(" ion-touched shorter-input shorter-input2") }
                      onIonInput={(ev) => {
                        setUserInfo(prevState=>({...prevState,email: String(ev.detail.value)}));
                        setErrorInfo(prevState=>({...prevState,isTouched: true})) }} />
          </IonItem>
          <IonItem><IonText>{errorInfo.formError}</IonText></IonItem>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="solid" size="small" color="danger" onClick={() => destroyDBPopup()} key="deletedb">{t("general.delete_local_data")}</IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonButton fill="solid" size="small" color="primary" onClick={() => doUpdateUserInfo()} key="updateuser">{t("general.update_user_info")}</IonButton>
            </IonButtons>
          </IonToolbar>
          <IonItemDivider className="category-divider">{t("general.add_other_list_options")}</IonItemDivider> 
          <IonRadioGroup value={localSettings?.addListOption} onIonChange={(e) => changeSetting("addListOption",e.detail.value)}>
          <IonItem className="shorter-item-some-padding myindented" key="addallauto">
            <IonRadio className="indent-setting" justify="space-between" labelPlacement="start" value={AddListOptions.addToAllListsAutomatically}>{t("general.add_same_group_auto")}</IonRadio>
          </IonItem>
          <IonItem className="shorter-item-some-padding" key="addcategoryauto">
            <IonRadio className="indent-setting" justify="space-between" labelPlacement="start" value={AddListOptions.addToListsWithCategoryAutomatically}>{t("general.add_same_categories_auto")}</IonRadio>
          </IonItem>
          <IonItem className="shorter-item-some-padding" key="dontaddauto">
            <IonRadio className="indent-setting" justify="space-between" labelPlacement="start" value={AddListOptions.dontAddAutomatically}>{t("general.dont_add_auto")}</IonRadio>
          </IonItem>
          </IonRadioGroup>
          <IonItemDivider className="category-divider">{t("general.other_settings")}</IonItemDivider>
          <IonItem className="shorter-item-no-padding" key="language">
            <IonSelect className="shorter-select shorter-select2" label={t("general.language") as string} interface="popover" onIonChange={(e) => i18n.changeLanguage(e.detail.value)} value={curLanguage}>
                {languageDescriptions.map((lng: any) => (
                    <IonSelectOption key={"language-"+lng.key} value={lng.key}>
                      {lng.name}
                    </IonSelectOption>
                ))}
            </IonSelect>
          </IonItem>
          <IonItem className="shorter-item-some-padding" key="removesettings">
            <IonCheckbox justify="space-between" labelPlacement="start" checked={localSettings.removeFromAllLists} onIonChange={(e) => changeSetting("removeFromAllLists",e.detail.checked)}>{t("general.remove_items_all_lists_purchased")}</IonCheckbox>
          </IonItem>
          <IonItem className="shorter-item-some-padding" key="deletesettings">
            <IonCheckbox justify="space-between" labelPlacement="start" checked={localSettings.completeFromAllLists} onIonChange={(e) => changeSetting("completeFromAllLists",e.detail.checked)}>{t("general.delete_all_lists_when_deleting_completed")}</IonCheckbox>
          </IonItem>
          <IonItem className="shorter-item-some-padding" key="searchsettings">
            <IonCheckbox justify="space-between" labelPlacement="start" checked={localSettings.includeGlobalInSearch} onIonChange={(e) => changeSetting("includeGlobalInSearch",e.detail.checked)}>{t("general.include_globalitems_in_search")}</IonCheckbox>
          </IonItem>
          <IonItem className="shorter-item-no-padding" key="dayslog">
            <IonInput className="shorter-input shorter-input2" label={t("general.days_conflict_log_to_view") as string} labelPlacement="start" type="number" min="0" max="25" onIonInput={(e) => changeSetting("daysOfConflictLog", Number(e.detail.value))} value={Number(localSettings?.daysOfConflictLog)}></IonInput>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
