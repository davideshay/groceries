import { IonContent, IonPage, IonButton, IonList, IonInput, IonItem,
  IonText, useIonAlert, IonIcon, useIonLoading, AlertOptions } from '@ionic/react';
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { eye, eyeOff } from 'ionicons/icons';
import { Capacitor, CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { ConnectionStatus, DBCreds, DBUUIDAction, LoginType } from '../components/RemoteDBState';
import { App } from '@capacitor/app';
import { createNewUser, getTokenInfo, navigateToFirstListID, errorCheckCreds, isServerAvailable, JWTMatchesUser, CreateResponse, createResponseInit, isDBServerAvailable, getDeviceID } from '../components/RemoteUtilities';
import { cloneDeep } from 'lodash-es';
import { RemoteDBStateContext, SyncStatus, initialRemoteDBState } from '../components/RemoteDBState';
import { HistoryProps} from '../components/DataTypes';
import { apiConnectTimeout, PrefsLastUsernameKey } from '../components/Utilities';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/PageHeader';
import log from "../components/logger";
import { GlobalStateContext, initialGlobalState } from '../components/GlobalState';
import { useHistory } from 'react-router';
import { DataReloadStatus, useGlobalDataStore } from '../components/GlobalData';
import { Preferences } from '@capacitor/preferences';

enum LoginOptions {
  Unknown = "U",
  AttemptLogin = "AL",
  Login = "LI",
  Logout = "LO",
  AskOffline = "AO",
  MustStayOffline = "MSO",
  NoCachedCreds = "NCC"
}

export type RemoteState = {
  password: string | undefined,
  verifyPassword: string | undefined,
  httpResponse: HttpResponse | undefined,
  inCreateMode: boolean,
  loginByPassword: boolean,
  formError: string,
  showMainPassword: boolean,
  showVerifyPassword: boolean
}

export const initRemoteState = {
  password: "",
  verifyPassword: "",
  httpResponse: undefined,
  inCreateMode: false,
  loginByPassword: false,
  formError: "",
  showMainPassword: false,
  showVerifyPassword: false
}

export type FormState = {
  apiServerURL: string | null, 
  dbUsername: string | null,
  email: string | null,
  fullName: string | null
}

export const initFormState = {
  apiServerURL: "",
  dbUsername: "",
  email: "",
  fullName: ""
}

/* 
Three logic paths: 

1) Come in with remoteDBState.dbuuidaction not = none
    Exit app if set to exit.
    Prompt and destroy if set to destroy

2) No or invalid creds
    Show login form
    validate creds syntax
    if syntax error, show again
    http call to api:/issuetoken
    if successful, store creds, otherwise back to form
    one async call: (assignDBAndSync)
    failure means credsError and DBUUIDAction set
       
3) Create User
    show new user form
    validate creds syntax
    if syntax error, show again
    http call to api:/createnewuser
    if successful, store creds, otherwise back to form
    assign db, proceed to sync

states to support:
  (all useeffects do nothing on credserror)

  init (do nothing other than display form)
        API call will be made with await (either create new user or issue token)
          and if errors, will not proceed beyond init 
          if successful, populate and store creds and then await assigndb / sync
 */

const RemoteDBLogin: React.FC<HistoryProps> = (props: HistoryProps) => {
    const [remoteState,setRemoteState]=useState<RemoteState>(initRemoteState);
    const [formState,setFormState]=useState<FormState>(initFormState);
    const showingVersionAlert = useRef(false);
    const [presentAlert, dismissAlert] = useIonAlert();
    const { remoteDBState, remoteDBCreds, setRemoteDBState, setRemoteDBCreds, removeUserInfoDBCreds, stopSyncAndCloseRemote,
      assignDB, setDBCredsValue, setLoginType, attemptFullLogin} = useContext(RemoteDBStateContext);
    const db = useGlobalDataStore((state) => state.db);
    const dataReloadStatus = useGlobalDataStore((state) => state.dataReloadStatus);
    const waitForReload = useGlobalDataStore((state) => state.waitForReload);
    const listRows = useGlobalDataStore((state) => state.listRows);
    const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
    const isLoading = useGlobalDataStore((state) => state.isLoading);
    const listCombinedRows = useGlobalDataStore((state) => state.listCombinedRows);
    const { globalState, setGlobalState} = useContext(GlobalStateContext);
    const [ present, dismiss ]= useIonLoading();
    const { t } = useTranslation();
    const history = useHistory();
    const lastDbUsernameFromPrefs = useRef<string>("");
    const exitApp = useCallback( async () => {
      if (Capacitor.isNativePlatform()) {
        App.exitApp()
      } else {
        setRemoteDBState(initialRemoteDBState);
        window.location.replace('about:blank');  
      }
    },[setRemoteDBState])

    const destroyAndExit = useCallback(async () => {
      if (db !== null) await db.destroy();
      log.debug("PouchDB destroyed...");
      await removeUserInfoDBCreds(true);
      await Preferences.remove({key: PrefsLastUsernameKey});
      exitApp();
    },[db,exitApp,removeUserInfoDBCreds])  

    // useEffect for initial page launch
    useEffect( () => {
      async function loadNameFromPrefs() {
        let {value} = await Preferences.get({key: PrefsLastUsernameKey});
        if (value !== null && value !== "") {
          lastDbUsernameFromPrefs.current = value;
        }
      }
      if (remoteDBState.credsError) {
        setRemoteState(prevState => ({...prevState,formError: remoteDBState.credsErrorText}))
      }
      setFormState(prevState=> ({...prevState,apiServerURL: remoteDBCreds.apiServerURL, dbUsername: remoteDBCreds.dbUsername}))
      setLoginType(LoginType.loginFromLoginPage);
      loadNameFromPrefs();
// eslint-disable-next-line react-hooks/exhaustive-deps 
    },[])

    useEffect( () => {
      async function checkAPIServerAvailable(apiServerURL: string|null) {
          let apiServerAvailable = await isServerAvailable(apiServerURL);
          let dbServerAvailable = true;
          if (apiServerAvailable && remoteDBState.loggedIn) {
            dbServerAvailable = await isDBServerAvailable(remoteDBCreds.refreshJWT,remoteDBCreds.couchBaseURL);
          } else {
            dbServerAvailable = apiServerAvailable.dbServerAvailable;
          }
          log.debug("API Server Available: ",apiServerAvailable);
          log.debug("dbServer Available:", dbServerAvailable);
          let validJWTMatch = JWTMatchesUser(remoteDBCreds.refreshJWT,remoteDBCreds.dbUsername);
          if (apiServerAvailable.apiServerAvailable) {
            setRemoteDBState(prevState =>({...prevState,apiServerAvailable: apiServerAvailable.apiServerAvailable, apiServerVersion: apiServerAvailable.apiServerAppVersion,dbServerAvailable: apiServerAvailable.dbServerAvailable, offlineJWTMatch: validJWTMatch}))
          } else {
            setRemoteDBState(prevState =>({...prevState,apiServerAvailable: apiServerAvailable.apiServerAvailable, dbServerAvailable: dbServerAvailable, offlineJWTMatch: validJWTMatch}))
          }  
      }
      log.debug("checking is API server is available in useeffect...");
      checkAPIServerAvailable(remoteDBCreds.apiServerURL);
    },[remoteDBCreds.apiServerURL,setRemoteDBState,remoteDBCreds.refreshJWT,remoteDBCreds.dbUsername, remoteDBCreds.couchBaseURL, remoteDBState.loggedIn])

    const showLoading = useCallback( async() => {
      await present( {
        message: t("general.loading")
      })
    },[present,t])
  
    const continueDifferentVersion = useCallback( async () => {
      await dismissAlert();
      await showLoading();
      setRemoteDBState(prevState => ({...prevState,dbUUIDAction: DBUUIDAction.none,ignoreAppVersionWarning: true}));
      await assignDB(remoteDBState.accessJWT);
    },[setRemoteDBState,dismissAlert,showLoading,assignDB,remoteDBState.accessJWT])
  
    // effect for dbuuidaction not none
    useEffect( () => {
      async function presentAndExit(alertObject: AlertOptions) {
        await presentAlert(alertObject);
        setRemoteDBState(prevState =>({...prevState,dbUUIDAction: DBUUIDAction.none}))
      };
      async function processDBUUIDAction() {
        if (remoteDBState.dbUUIDAction !== DBUUIDAction.none) {
          if (remoteDBState.dbUUIDAction === DBUUIDAction.warning_app_version_mismatch) {
            if (!showingVersionAlert.current) {
              showingVersionAlert.current = true;
              log.error("Mismatched app versions on client and server");
              presentAlert({
                header: t("error.warning"),
                subHeader: t("error.different_server_local_app_versions"),
                buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                            handler: () => {exitApp()}},
                            { text: t("general.continue_ignore"), role: "confirm",
                            handler: async () => {await dismissAlert(); continueDifferentVersion();}}]
              });
              return;
            }
          }
          if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_app_schema_mismatch) {
            log.error("Schema too new, not supported with this app version. Upgrade.");
            presentAndExit({
              header: t("error.error") as string,
              message: t("error.app_not_support_newer_schema") as string,
              buttons: [{text:t("general.ok"),handler: () => exitApp()}]
            });
            return;
          }
          if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_local_remote_schema_mismatch) {
            log.error("Local/Remote schema mismatch. Must destroy local Databse.");
            presentAlert( {
              header: t("error.warning"),
              message: t("error.different_database_schema"),
              buttons: [
                {text: t("general.delete_exit"),handler: () => destroyAndExit()},
                {text: t("general.cancel_exit"),handler: () => exitApp()}
                ]
            })
            return;
          }
          if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_no_uuid_on_server) {
            log.error("No database UUID defined in server database. Cannot continue");
            presentAndExit({
              header: t("error.error") as string,
              message: t("error.server_no_unique_id") as string,
              buttons: [
                {text: t("general.ok"),handler: () => exitApp()}]
            });
            return;
          }
          if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_different_uuids) {
            presentAlert( {
              header: t("error.warning"),
              message: t("error.different_database_unique_id"),
              buttons: [
                {text: t("general.delete_exit"),handler: () => destroyAndExit()},
                {text: t("general.cancel_exit"),handler: () => exitApp()}
                ]
            })
            return;
          }
          if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_different_username) {
            presentAlert( {
              header: t("error.warning"),
              message: t("error.different_database_username"),
              buttons: [
                {text: t("general.delete_exit"),handler: () => destroyAndExit()},
                {text: t("general.cancel_exit"),handler: () => exitApp()}
                ]
            })
            return;            
          }
        }
      };
      if (remoteDBState.dbUUIDAction !== DBUUIDAction.none && remoteDBState.dbUUIDAction !== DBUUIDAction.warning_app_version_mismatch) {
        dismiss();
      }
      processDBUUIDAction();
      }
    ,[remoteDBState.dbUUIDAction,destroyAndExit,dismiss,dismissAlert,exitApp,presentAlert,setRemoteDBState,t,continueDifferentVersion])

    useEffect( () => {
      if (remoteDBState.initialSyncComplete) {
          waitForReload()
      }
    },[remoteDBState.initialSyncComplete,waitForReload])

    useEffect( () => {
      async function doNav() {
        await dismiss();
        navigateToFirstListID(history,listRows,listCombinedRows , globalState.settings.savedListID);
        setRemoteDBState(prevState =>({...prevState,initialNavComplete: true}));
      }
      if (listRowsLoaded && !isLoading) {
        if (remoteDBState.connectionStatus === ConnectionStatus.cannotStart) {
          log.error("Detected cannot start, setting initRemoteState");
          setRemoteState(initRemoteState);
        } else if (remoteDBState.loggedIn && remoteDBState.initialNavComplete) {
          return;
        } else if (remoteDBState.connectionStatus === ConnectionStatus.loginComplete && globalState.settingsLoaded && ((remoteDBState.initialSyncComplete && dataReloadStatus === DataReloadStatus.ReloadComplete) || remoteDBState.workingOffline)) {
          doNav();
        }
      }
    },[remoteDBState.initialNavComplete, remoteDBState.initialSyncComplete ,remoteDBState.loggedIn, remoteDBState.workingOffline, remoteDBState.connectionStatus, db, listRows, listCombinedRows, listRowsLoaded, isLoading, dataReloadStatus,dismiss, setRemoteDBState, globalState.settings, globalState.settingsLoaded, history]);

    function updateDBCredsFromResponse(response: CreateResponse): DBCreds {
      let newDBCreds=cloneDeep(remoteDBCreds);
      newDBCreds.couchBaseURL  = response.couchdbUrl;
      newDBCreds.database = response.couchdbDatabase;
      newDBCreds.email = response.email;
      newDBCreds.fullName = response.fullname;
      newDBCreds.refreshJWT = response.refreshJWT;
      return newDBCreds;
    }

  async function submitForm() {
    await showLoading();
    setRemoteState(prevState => ({...prevState,formError: ""}));
    setRemoteDBState(prevState =>({...prevState,credsError: false, credsErrorText: ""}));
    setDBCredsValue("apiServerURL",formState.apiServerURL);
    setDBCredsValue("dbUsername",formState.dbUsername);    
    let credsCheck = errorCheckCreds({credsObj: remoteDBCreds,background:false,creatingNewUser:false,password: remoteState.password});
    if (credsCheck.credsError ) {
      setRemoteState(prevState => ({...prevState,formError: String(credsCheck.errorText)}))
      await dismiss();
      return;
    }
    let response: HttpResponse;
    const options : HttpOptions = {
        url: String(remoteDBCreds.apiServerURL+"/issuetoken"),
        method: "POST",
        headers: { 'Content-Type': 'application/json; charset=UTF-8',
                   'Accept': 'application/json'},
        connectTimeout: apiConnectTimeout,              
        data: { username: remoteDBCreds.dbUsername,
                password: remoteState.password,
                deviceUUID: remoteDBState.deviceUUID},  
      
    };
    try {response = await CapacitorHttp.post(options)}
    catch(err) {log.error("Error logging in...",err)
                setRemoteState(prevState => ({...prevState, formError: t("error.could_not_contact_api_server")}));
                setRemoteDBState(prevState=>({...prevState, apiServerAvailable: false}));
                await dismiss();
                return}
    log.debug("Did API /issuetoken : result: ", cloneDeep(response));            
    if (!((response?.status === 200) && (response?.data?.loginSuccessful))) {
        if (response?.data?.dbServerAvailable) {
            setRemoteState(prevState => ({...prevState, formError: t("error.invalid_authentication")}))
        } else {
            setRemoteState(prevState => ({...prevState, formError: t("error.database_server_not_available")}))
            setRemoteDBState(prevState=>({...prevState, dbServerAvailable: false}));
        }
        await dismiss();
        return
    }
    if (formState.dbUsername !== lastDbUsernameFromPrefs.current && lastDbUsernameFromPrefs.current !== "") {
//      setRemoteState(prevState => ({...prevState, formError: t("error.username_changed_must_refresh")}));
      await dismiss();
      presentAlert( {
          header: t("error.warning"),
          message: t("error.different_database_username"),
          buttons: [
            {text: t("general.delete_exit"),handler: () => destroyAndExit()},
            {text: t("general.cancel_exit"),handler: () => exitApp()}
            ]
      });
      return;
    } else {
      await Preferences.set({key: PrefsLastUsernameKey,value: String(formState.dbUsername)})
    }
    let newResponse = cloneDeep(createResponseInit);
    newResponse = Object.assign(newResponse,response.data);
    let newCreds=updateDBCredsFromResponse(newResponse);
    let tokenInfo = getTokenInfo(response.data.accessJWT, true);
    setRemoteDBCreds(newCreds);
    setRemoteDBState(prevState=>({...prevState, accessJWT: response.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate, loggedIn: true, forceShowLoginScreen: false , credsError: false, credsErrorText: ""}));
    await assignDB(response.data.accessJWT);
  }
  
  async function submitCreateForm() {
    await showLoading();
    setRemoteState(prevState => ({...prevState,formError: ""}));
    setRemoteDBState(prevState=>({...prevState,credsError: false, credsErrorText: ""}));
    setDBCredsValue("apiServerURL",formState.apiServerURL);
    setDBCredsValue("dbUsername",formState.dbUsername);    
    setDBCredsValue("email",formState.email);
    setDBCredsValue("fullName",formState.fullName);
    let createResponse: CreateResponse;
    let credsCheck = errorCheckCreds({credsObj: remoteDBCreds,background: false,creatingNewUser: true,password: remoteState.password,verifyPassword: remoteState.verifyPassword});
    if (!credsCheck.credsError) {
      createResponse = await createNewUser(remoteDBState,remoteDBCreds,String(remoteState.password));
      if (createResponse.apiError) { 
        setRemoteDBState(prevState=>({...prevState,apiServerAvailable: false}));
        setRemoteState(prevState => ({...prevState, formError: t("error.creating_user")}));
        await dismiss();
        return;
      }
      if (createResponse.creationDisabled) {
        credsCheck.errorText=(t("error.account_creation_disabled"));
        setRemoteState(prevState => ({...prevState, formError: credsCheck.errorText}))
        await dismiss();
        return;
      }
      if (!createResponse.createdSuccessfully) {
        credsCheck.errorText="";
        if (createResponse.invalidData) {credsCheck.errorText = t("error.invalid_data_entered");} 
        else if (createResponse.userAlreadyExists) {credsCheck.errorText = t("error.user_already_exists");}
        setRemoteState(prevState => ({...prevState, formError: credsCheck.errorText}))
        await dismiss();
        return;
      }
    } else {
      setRemoteState(prevState => ({...prevState, formError: String(credsCheck.errorText)}));
      await dismiss();
      return;
    }
    if (formState.dbUsername !== lastDbUsernameFromPrefs.current && lastDbUsernameFromPrefs.current !== "") {
//      setRemoteState(prevState => ({...prevState, formError: t("error.username_changed_must_refresh")}));
      await dismiss();
      presentAlert( {
          header: t("error.warning"),
          message: t("error.different_database_username"),
          buttons: [
            {text: t("general.delete_exit"),handler: () => destroyAndExit()},
            {text: t("general.cancel_exit"),handler: () => exitApp()}
            ]
      });
      return;
    } else {
      await Preferences.set({key: PrefsLastUsernameKey,value: String(formState.dbUsername)})
    }
    let newCreds=updateDBCredsFromResponse(createResponse);
    setRemoteDBCreds(newCreds);
    let tokenInfo = getTokenInfo(createResponse.accessJWT,true);
    setRemoteDBState(prevState=>({...prevState,accessJWT: createResponse.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate, loggedIn: true, forceShowLoginScreen: false}));
    await assignDB(createResponse.accessJWT);
    await dismiss();
  }
  
  async function callResetPasswordAPI() {
    const options: HttpOptions = {
        url: String(formState.apiServerURL+"/resetpassword"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json'},
        data: { username: formState.dbUsername },   
        connectTimeout: apiConnectTimeout        
    };
    try {
      let resp=await CapacitorHttp.post(options);
      if (resp.status !== 200) {
        setRemoteState(prevState=>({...prevState,formError: t("error.api_server_error_resetting_password")}))
      } else {
        if (resp.data.error) {
          setRemoteState(prevState=>({...prevState,formError: resp.data.error}));
        } else {
          setRemoteState(prevState=>({...prevState,formError: t("general.password_reset_email_sent")}));
        }
      }

    } catch(err) {log.error("Resetting password",err);
                setRemoteDBState(prevState=>({...prevState,apiServerAvailable: false}))}
//    presentAlert({
//      header: "Password Request Sent",
//      message: "Please check your email for the link to reset your password",
//      buttons: ["OK"]
//    })
  }

  function resetPassword() {
    if (formState.dbUsername === "" || formState.dbUsername === null || formState.dbUsername === undefined) {
      setRemoteState(prevState => ({...prevState, formError: t("error.must_enter_username_reset_password")}))
    } else {
      presentAlert({
        header: t("general.request_password_reset"),
        message: t("general.press_reset_receive_email"),
        buttons: [ {
          text: t("general.cancel"), role: "cancel"
        }, {
          text: t("general.reset"), role: "confirm", handler: () => callResetPasswordAPI()
        }]
      })
    }
  }

  function setWorkingOffline() {
    log.debug("Working Offline Now...");
    setRemoteDBState(prevState=>({...prevState,workingOffline: true,loggedIn: true  ,initialNavComplete: true, 
        syncStatus: SyncStatus.offline, dbServerAvailable: false ,credsError: false, credsErrorText:""}));
    setRemoteState(prevState=>({...prevState,formError:""}));
    log.debug("naving to first list ID because working offline");
    navigateToFirstListID(history, listRows, listCombinedRows, globalState.settings.savedListID);    
  }

/*   function workOffline() {
    presentAlert({
      header: "Choose to work offline",
      message: "You can choose to work offline with your locally replicated data. Please be aware that your changes will not be synchronized back to the server until you restart the app and login again. The chance for conflicts also increases.",
      buttons: [ {
        text: "Cancel", role: "cancel" },
        { text: "Work Offline", role: "confirm", handler: () => setWorkingOffline()}
      ]})      
  }
 */

//  if (remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) {
//    return (<></>)
//  }

  async function logout() {
    await stopSyncAndCloseRemote();
    await removeUserInfoDBCreds(false);
//    if (!(isPlatform("desktop") || isPlatform("electron"))) {App.exitApp()}
    if (Capacitor.isNativePlatform()) {App.exitApp()}
    setRemoteDBState(initialRemoteDBState);
    setFormState(prevState => ({...prevState,dbUsername: "",email: "", fullName: ""}));
    //window.location.replace('/');
    return false;
  }

  function logoutPopup() {
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
        handler: () => {logout()}}
        ]
    })
  }

  async function attemptLogin() {
    setLoginType(LoginType.autoLoginFromRoot);
    setRemoteState(prevState=>({...prevState,formError: ""}));
    setRemoteDBState(prevState=>({...prevState,syncStatus: SyncStatus.init, connectionStatus: ConnectionStatus.onLoginScreen, initialSyncStarted: false,
        initialSyncComplete: false,credsError: false, credsErrorText: "",apiServerAvailable: true, dbServerAvailable: true, workingOffline: false, loggedIn: false}))
    const [loginSuccess,loginError] = await attemptFullLogin();
    if (!loginSuccess) {
      setRemoteState(prevState=>({...prevState,formError: loginError}))
    }
  }
  
  function switchToCreateMode() {
    let curCreds=remoteDBCreds;
    curCreds.dbUsername = "";
    curCreds.email = "";
    curCreds.fullName = "";
    curCreds.refreshJWT = "";
    setRemoteDBCreds(curCreds);
    setRemoteState(prevState => ({...prevState,inCreateMode: true, formError: ""}));
    setRemoteDBState(prevState =>({...prevState,credsError: false, credsErrorText: ""}));
  }

  async function forceLogin() {
    setRemoteDBState(initialRemoteDBState);
    let devID = await getDeviceID();
    setRemoteDBState(prevState => ({...prevState,forceShowLoginScreen: true, deviceUUID: devID}));
    setGlobalState(initialGlobalState);
  }

  function getLoginOption() {
    if (remoteDBState.forceShowLoginScreen) {
      return LoginOptions.Login;
    }
    let lo : LoginOptions = LoginOptions.Login
    let decTbl: any =[]
    for (let a = 0; a < 2; a++) {
      decTbl[a] = []
      for (let b = 0; b<2; b++) {
        decTbl[a][b] = [];
        for (let c = 0; c<2; c++) {
          decTbl[a][b][c] = [];
          for (let d = 0; d<2; d++) {
            decTbl[a][b][c][d] = []
            for (let e = 0; e<2; e++) {
              decTbl[a][b][c][d][e] = LoginOptions.Unknown } } } } }
    // table dimensions: Api Avail, DB Avail, Logged In, Working Offline, JWT Match
    //     A  D  L  O  J
    decTbl[1][1][1][1][1] = LoginOptions.AttemptLogin;
    decTbl[1][1][1][1][0] = LoginOptions.Login;
    decTbl[1][1][1][0][1] = LoginOptions.Logout;
    decTbl[1][1][1][0][0] = LoginOptions.Logout;
    decTbl[1][1][0][1][1] = LoginOptions.Unknown;
    decTbl[1][1][0][1][0] = LoginOptions.Unknown;
    decTbl[1][1][0][0][1] = LoginOptions.Login;
    decTbl[1][1][0][0][0] = LoginOptions.Login;
    decTbl[1][0][1][1][1] = LoginOptions.MustStayOffline;
    decTbl[1][0][1][1][0] = LoginOptions.NoCachedCreds;
    decTbl[1][0][1][0][1] = LoginOptions.AskOffline;
    decTbl[1][0][1][0][0] = LoginOptions.NoCachedCreds;
    decTbl[1][0][0][1][1] = LoginOptions.Unknown;
    decTbl[1][0][0][1][0] = LoginOptions.Unknown;
    decTbl[1][0][0][0][1] = LoginOptions.AskOffline;
    decTbl[1][0][0][0][0] = LoginOptions.NoCachedCreds;
    decTbl[0][1][1][1][1] = LoginOptions.MustStayOffline;
    decTbl[0][1][1][1][0] = LoginOptions.NoCachedCreds;
    decTbl[0][1][1][0][1] = LoginOptions.AskOffline;
    decTbl[0][1][1][0][0] = LoginOptions.NoCachedCreds;
    decTbl[0][1][0][1][1] = LoginOptions.Unknown;
    decTbl[0][1][0][1][0] = LoginOptions.Unknown;
    decTbl[0][1][0][0][1] = LoginOptions.AskOffline;
    decTbl[0][1][0][0][0] = LoginOptions.NoCachedCreds;
    decTbl[0][0][1][1][1] = LoginOptions.MustStayOffline;
    decTbl[0][0][1][1][0] = LoginOptions.NoCachedCreds;
    decTbl[0][0][1][0][1] = LoginOptions.AskOffline;
    decTbl[0][0][1][0][0] = LoginOptions.NoCachedCreds;
    decTbl[0][0][0][1][1] = LoginOptions.Unknown;
    decTbl[0][0][0][1][0] = LoginOptions.Unknown;
    decTbl[0][0][0][0][1] = LoginOptions.AskOffline;
    decTbl[0][0][0][0][0] = LoginOptions.NoCachedCreds;
    lo = decTbl[+remoteDBState.apiServerAvailable][+remoteDBState.dbServerAvailable][+remoteDBState.loggedIn][+remoteDBState.workingOffline][+remoteDBState.offlineJWTMatch];
    return lo;
  }

  let loginOption: LoginOptions = getLoginOption();
  
  let formElem;
  switch (loginOption) {
    case LoginOptions.Login:
      if (remoteState.inCreateMode) {
        formElem = <>
        <IonItem>
        <IonInput label={t("general.api_server_url") as string} labelPlacement="stacked" type="url" inputmode="url"
                  value={formState.apiServerURL}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }} }
                  onIonInput={(e) => {setFormState(prevState=>({...prevState,apiServerURL:String(e.detail.value)}))}}>
        </IonInput>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.username") as string} labelPlacement="stacked" type="text" autocomplete="username"
                  value={formState.dbUsername}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }} }
                  onIonInput={(e) => {setFormState(prevState=>({...prevState,dbUsername:String(e.detail.value)}))}}>
        </IonInput>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.email_address") as string} labelPlacement="stacked" type="email" autocomplete="email"
                  value={formState.email}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }} }
                  onIonInput={(e) => {setFormState(prevState=>({...prevState,email:String(e.detail.value)}))}}>
        </IonInput>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.fullname") as string} labelPlacement="stacked"  type="text" value={formState.fullName}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }} }
                  onIonInput={(e) => {setFormState(prevState=>({...prevState,fullName:String(e.detail.value)}))}}>
        </IonInput>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.password") as string} labelPlacement="stacked" autocomplete="current-password"
                  type={remoteState.showMainPassword ? "text" : "password"} value={remoteState.password}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }} }
                  onIonInput={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
        </IonInput><IonIcon slot="end"  icon={remoteState.showMainPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showMainPassword: !prevState.showMainPassword}))}}></IonIcon>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.confirm_password") as string} labelPlacement="stacked" autocomplete="current-password"
                  type={remoteState.showVerifyPassword ? "text" : "password"} value={remoteState.verifyPassword}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }} }
                  onIonInput={(e) => {setRemoteState(prevstate => ({...prevstate, verifyPassword: String(e.detail.value)}))}}>
        </IonInput><IonIcon slot="end"  icon={remoteState.showVerifyPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showVerifyPassword: !prevState.showVerifyPassword}))}}></IonIcon>
        </IonItem>
        </>
      } else {
        formElem = <><IonItem>
        <IonInput label={t("general.api_server_url") as string} labelPlacement="stacked" type="url" inputmode="url"
                  value={formState.apiServerURL}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }}  }
                  onIonInput={(e) => {setFormState(prevState=>({...prevState,apiServerURL:String(e.detail.value)}))}}>
        </IonInput>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.username") as string} labelPlacement="stacked"  type="text" autocomplete="username"
                  value={formState.dbUsername}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }}  }
                  onIonInput={(e) => {setFormState(prevState=>({...prevState,dbUsername:String(e.detail.value)}))}}>
        </IonInput>
        </IonItem>
        <IonItem>
        <IonInput label={t("general.password") as string} labelPlacement="stacked" autocomplete="current-password"
                  type={remoteState.showMainPassword ? "text" : "password"} value={remoteState.password}
                  onKeyUp={(e) => {if (e.key === "Enter") {submitFunc() }}  }
                  onIonInput={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
        </IonInput><IonIcon slot="end"  icon={remoteState.showMainPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showMainPassword: !prevState.showMainPassword}))}}></IonIcon>
        </IonItem>
        </>  
  
      }
      break;
    case LoginOptions.AskOffline:
      formElem = <>
      <IonItem>
        <IonText>
          {t("error.database_server_not_available_choose_work_offline")}
        </IonText>
      </IonItem>
      <IonItem>  
        <IonText>
          {t("error.press_button_work_offline_as_user")+" "+remoteDBCreds.dbUsername}
        </IonText>
      </IonItem>
      </>
      break;
    case LoginOptions.NoCachedCreds:
      formElem = <>
      <IonItem>
        <IonText>
          {t("error.server_not_available_nor_cached_creds")}
        </IonText>
      </IonItem>
      </>    
      break;
    case LoginOptions.AttemptLogin:
      formElem = <>
        <IonItem>{t("general.logged_in")+":"+t("general.working_offline")+" "+t("general.as_user")+" "+remoteDBCreds.dbUsername}</IonItem>
        <IonItem><IonText></IonText></IonItem>
      </>  
      break;
    case LoginOptions.Logout:
      formElem = <IonItem>{t("general.logged_in")+": "+t("general.online")+" "+t("general.as_user")+" "+remoteDBCreds.dbUsername}</IonItem>
      break;
    case LoginOptions.MustStayOffline:
      formElem = <>
      <IonItem>{t("general.logged_in")+":"+t("general.working_offline")+" "+t("general.as_user")+" "+remoteDBCreds.dbUsername}</IonItem>
      <IonItem>{t("general.must_stay_offline")}</IonItem>
      </>
      break;
    case LoginOptions.Unknown:
      formElem = <IonItem><IonText>{t("error.unknown_login_state")}</IonText></IonItem>  
      break;
    default:
      break;
  }

  function submitFunc() {
    switch (loginOption) {
      case LoginOptions.Login:
        if (remoteState.inCreateMode) {
          return submitCreateForm()
        } else {
          return submitForm()
        }
    }
  }

  let buttonsElem
  switch (loginOption) {
    case LoginOptions.AskOffline:
      buttonsElem=
      <IonItem>
        <IonButton size="small" slot="start" onClick={() => setWorkingOffline()}>{t("general.work_offline")}</IonButton>
        <IonButton size="small" slot="end" onClick={() => forceLogin()}>{t("general.relogin")}</IonButton>
      </IonItem>
      break;
    case LoginOptions.AttemptLogin:
      buttonsElem=<IonButton size="small" onClick={() => attemptLogin()}>{t("general.attempt_login_again")}</IonButton>
      break;
    case LoginOptions.Login:
      if (remoteState.inCreateMode) {
        buttonsElem=<>
        <IonButton size="small" fill="outline" onClick={() => setRemoteState(prevState => ({...prevState,inCreateMode: false}))}>{t("general.cancel")}</IonButton>
        <IonButton size="small" type="submit" onClick={() => submitFunc()}>{t("general.create")}</IonButton>
        </>
      } else {
        buttonsElem=<>
        <IonButton size="small" slot="start" type="submit" onClick={() => submitFunc()}>{t("general.login")}</IonButton>
        <IonButton size="small" onClick={() => resetPassword()}>{t("general.reset_password")}</IonButton>
        <IonButton size="small" slot="end" onClick={() => switchToCreateMode()}>{t("general.create_account")}</IonButton>
        </>
      } 
      break;
    case LoginOptions.Logout:
      buttonsElem=<IonButton size="small" onClick={() => logoutPopup()}>{t("general.logout")}</IonButton>
      break;  
    case LoginOptions.NoCachedCreds:
    case LoginOptions.MustStayOffline:
      buttonsElem=
        <IonItem>
          <IonButton size="small" onClick={() => forceLogin()}>{t("general.relogin")}</IonButton>
        </IonItem>
      break;
    default:
      break;
  }

  return(
        <IonPage>
            <PageHeader title={t("general.login_page")} />
            <IonContent>
            <IonList className="ion-no-padding">
              {formElem}
              <IonItem>
                  <IonText>{remoteState.formError}</IonText>
              </IonItem>
              {buttonsElem}
            </IonList>
            </IonContent>
        </IonPage>
    )
}

export default RemoteDBLogin;