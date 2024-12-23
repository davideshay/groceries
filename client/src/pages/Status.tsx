import { IonContent, IonPage, IonList, IonItem,
        IonButton, useIonAlert, 
        IonItemDivider, IonLabel, IonButtons, IonToolbar, IonText, IonIcon, IonGrid, IonRow, IonCol, IonPopover, IonTitle } from '@ionic/react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';        
import { closeCircle, checkmarkCircle, helpCircleOutline } from 'ionicons/icons';
import { usePouch } from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import './Settings.css';
import { InitSettings } from '../components/DBSchema';
import { GlobalStateContext } from '../components/GlobalState';
import { initialRemoteDBState, RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps, UserInfo, initUserInfo } from '../components/DataTypes';
import { maxAppSupportedSchemaVersion, appVersion , GlobalSettings } from '../components/DBSchema';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { secondsToDHMS } from '../components/Utilities';
import { cloneDeep } from 'lodash';
import Loading from '../components/Loading';
import { getTokenInfo, isDBServerAvailable, isServerAvailable } from '../components/RemoteUtilities';
import { log } from "../components/Utilities";
import { Capacitor } from '@capacitor/core';

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

const Status: React.FC<HistoryProps> = (props: HistoryProps) => {
  const db = usePouch();
  const [presentAlert] = useIonAlert();
  const {globalState, settingsLoading} = useContext(GlobalStateContext);
  const { remoteDBCreds, remoteDBState, setRemoteDBState } = useContext(RemoteDBStateContext);
  const [ ,setLocalSettings] = useState<GlobalSettings>(InitSettings)
  const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>(initUserInfo);
  const [errorInfo] = useState<ErrorInfo>(cloneDeep(ErrorInfoInit));
  const { t } = useTranslation();
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
    if (Capacitor.isNativePlatform()) {App.exitApp();}
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

  const accessSecondsToExpire = remoteDBState.accessJWTExpirationTime === 0 ? 0 : Number(remoteDBState.accessJWTExpirationTime) - (Math.round(Date.now() / 1000));
  const refreshJWTInfo = getTokenInfo(String(remoteDBCreds.refreshJWT),false);
  const refreshSecondsToExpire = Number(refreshJWTInfo.expireDate) - Math.round(Date.now() / 1000);

  return (
    <IonPage>
      <PageHeader title={t("general.status")} />
      <IonContent fullscreen>
        <IonPopover className="server-info-popover" trigger="server-info-trigger" triggerAction="hover">
          <IonTitle>App and DB Server Info</IonTitle>
          <IonItem className="shorter-item-some-padding">
            <IonGrid class="ion-no-padding"><IonRow>
              <IonCol>{t("general.api_server_status")}</IonCol>
              <IonCol>{remoteDBCreds.apiServerURL}</IonCol>
            </IonRow></IonGrid>
          </IonItem>
          <IonItem className="shorter-item-some-padding">
            <IonGrid class="ion-no-padding"><IonRow>
              <IonCol>{t("general.db_server_status")}</IonCol>
              <IonCol>{remoteDBCreds.couchBaseURL}</IonCol>
            </IonRow></IonGrid>
          </IonItem>
          <IonItem className="shorter-item-some-padding">
            <IonGrid class="ion-no-padding"><IonRow>
              <IonCol>Database</IonCol>
              <IonCol>{remoteDBCreds.database}</IonCol>
            </IonRow></IonGrid>
          </IonItem>
        </IonPopover>
        <IonList lines="none" className="ion-no-padding">
          <IonItemDivider className="category-divider">{t("general.app_info")}</IonItemDivider>
          <IonItem className="shorter-item-some-padding">{t("general.app_version")} : {appVersion}</IonItem>
          <IonItem className="shorter-item-some-padding">{t("general.database_schema_version")}: {maxAppSupportedSchemaVersion}</IonItem>
          <IonItem className="shorter-item-some-padding">
          </IonItem>
          <IonItem className="shorter-item-some-padding">
            <IonGrid class="ion-no-padding">
              <IonRow><IonCol size="4">{t("general.api_server_status")}</IonCol>
              <IonCol size="1">{remoteDBState.apiServerAvailable ? <IonIcon icon={checkmarkCircle} className="online-indicator"></IonIcon> :
                                <IonIcon icon={closeCircle} className="offline-indicator"></IonIcon> }</IonCol>
              <IonCol size="4">{t("general.db_server_status")}</IonCol>
              <IonCol size="1">{remoteDBState.dbServerAvailable ? <IonIcon icon={checkmarkCircle} className="online-indicator"></IonIcon> :
                                <IonIcon icon={closeCircle} className="offline-indicator"></IonIcon> }</IonCol>
              <IonCol size="1"><IonIcon id="server-info-trigger" icon={helpCircleOutline}></IonIcon></IonCol></IonRow>
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
              <IonRow>
                <IonCol size="5">{t("general.user_id")}</IonCol>
                <IonCol size="7">{userInfo.name}</IonCol>
              </IonRow>
            </IonGrid>
          </IonItem>                                      
          <IonItem><IonText>{errorInfo.formError}</IonText></IonItem>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="solid" size="small" color="danger" onClick={() => destroyDBPopup()} key="deletedb">{t("general.delete_local_data")}</IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonButton routerLink='/conflictlog' fill="solid" size="small" color="tertiary" key="conflictlog">{t("general.conflict_log")}</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Status;
