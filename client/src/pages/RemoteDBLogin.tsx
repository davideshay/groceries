import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonText, useIonAlert, isPlatform, IonIcon } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { eye, eyeOff } from 'ionicons/icons';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { usePouch} from 'use-pouchdb';
import { ConnectionStatus, DBCreds, DBUUIDAction } from '../components/RemoteDBState';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { createNewUser, getTokenInfo, navigateToFirstListID,  } from '../components/RemoteUtilities';
import { cloneDeep } from 'lodash';
import { RemoteDBStateContext, SyncStatus, initialRemoteDBState } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';

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

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>(initRemoteState);
    const [presentAlert] = useIonAlert();
    const { remoteDBState, remoteDBCreds, setRemoteDBState, setRemoteDBCreds, errorCheckCreds, assignDB, setDBCredsValue} = useContext(RemoteDBStateContext);

    // effect for dbuuidaction not none
    useEffect( () => {
      if (remoteDBState.dbUUIDAction !== DBUUIDAction.none) {
        if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_no_uuid_on_server) {
          console.log("ERROR: No database UUID defined in server todos database. Cannot continue");
          presentAlert({
            header: "ERROR",
            message: "The server is incorrectly configured with no unique ID. Please ensure server process is running.",
            buttons: ["OK"]
          });
          exitApp();
          return;
        } else if (remoteDBState.dbUUIDAction === DBUUIDAction.destroy_needed) {
          presentAlert( {
            header: "WARNING",
            message: "The Database identifier on the server is not the same as the local copy. You should delete your local copy in order to continue. App will exit.",
            buttons: [
              {text: "Delete/Exit",handler: () => destroyAndExit()},
              {text: "Cancel/Exit",handler: () => exitApp()}
              ]
          })
        }
      }
    },[remoteDBState.dbUUIDAction])

    useEffect( () => {
      if (remoteDBState.connectionStatus === ConnectionStatus.cannotStart) {
        console.log("Detected cannot start, setting initRemoteState");
        setRemoteState(initRemoteState);
      } else if (remoteDBState.connectionStatus === ConnectionStatus.loginComplete) {
        navigateToFirstListID(db,props.history,remoteDBCreds);
      }

    },[remoteDBState.connectionStatus, db, props.history, remoteDBCreds]);

    async function destroyAndExit() {
      await db.destroy();
      await Preferences.remove({key: 'dbcreds'});
      exitApp();
    }

    function exitApp() {
      if (!(isPlatform("desktop") || isPlatform("electron"))) {App.exitApp()}
      console.log("RESETTING TO INITSTATE");
      setRemoteDBState(initialRemoteDBState);
      window.location.replace('/');
  
    }

    function updateDBCredsFromResponse(response: HttpResponse): DBCreds {
      let newDBCreds=cloneDeep(remoteDBCreds);
      newDBCreds.couchBaseURL  = response?.data.couchdbUrl;
      newDBCreds.database = response?.data.couchdbDatabase;
      newDBCreds.email = response?.data.email;
      newDBCreds.fullName = response?.data.fullname;
      newDBCreds.refreshJWT = response?.data.refreshJWT;
      return newDBCreds;
    }
    
  async function submitForm() {
//    await setPrefsDBCreds();
    let credsCheck = errorCheckCreds(remoteDBCreds,false,false,remoteState.password);
    if (credsCheck.credsError ) {
      setRemoteState(prevState => ({...prevState,formError: String(credsCheck.errorText)}))
      return;
    }
    let response: HttpResponse;
    const options = {
        url: String(remoteDBCreds.apiServerURL+"/issuetoken"),
        method: "POST",
        headers: { 'Content-Type': 'application/json; charset=UTF-8',
                   'Accept': 'application/json'},
        data: { username: remoteDBCreds.dbUsername,
                password: remoteState.password,
                deviceUUID: remoteDBState.deviceUUID},           
    };
    try {response = await CapacitorHttp.post(options)}
    catch(err) {console.log("Error logging in...",err)
                setRemoteState(prevState => ({...prevState, formError: "Cannot contact API server"}));
                setRemoteDBState({...remoteDBState, serverAvailable: false});
                return}
    if (!((response?.status === 200) && (response?.data?.loginSuccessful))) {
        setRemoteState(prevState => ({...prevState, formError: "Invalid Authentication"}))
        return
    }
    let newCreds=updateDBCredsFromResponse(response);
    let tokenInfo = getTokenInfo(response.data.accessJWT);
    setRemoteDBCreds(newCreds);
    setRemoteDBState({...remoteDBState, accessJWT: response.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate});
    await assignDB(response.data.accessJWT);
  }
  
  async function submitCreateForm() {
    let createResponse: any;
    let credsCheck = errorCheckCreds(remoteDBCreds,false,true,remoteState.password,remoteState.verifyPassword);
    if (!credsCheck.credsError) {
      createResponse = await createNewUser(remoteDBState,remoteDBCreds,String(remoteState.password));
      if (!createResponse.data.createdSuccessfully) {
        credsCheck.errorText="";
        if (createResponse.data.invalidData) {credsCheck.errorText = "Invalid Data Entered";} 
        else if (createResponse.data.userAlreadyExists) {credsCheck.errorText = "User Already Exists";}
        setRemoteState(prevState => ({...prevState, formError: credsCheck.errorText}))
        return;
      }
    } else {
      setRemoteState(prevState => ({...prevState, formError: String(credsCheck.errorText)}));
      return;
    }
    let newCreds=updateDBCredsFromResponse(createResponse);
    setRemoteDBCreds(newCreds);
    let tokenInfo = getTokenInfo(createResponse.data.accessJWT);
    setRemoteDBState({...remoteDBState,accessJWT: createResponse.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate});
    await assignDB(createResponse.data.accessJWT);
  }
  
  async function callResetPasswordAPI() {
    const options = {
        url: String(remoteDBCreds.apiServerURL+"/resetpassword"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json'},
        data: { username: remoteDBCreds.dbUsername },           
    };
    await CapacitorHttp.post(options);
//    presentAlert({
//      header: "Password Request Sent",
//      message: "Please check your email for the link to reset your password",
//      buttons: ["OK"]
//    })

  }

  function resetPassword() {
    if (remoteDBCreds.dbUsername == "" || remoteDBCreds.dbUsername == null || remoteDBCreds.dbUsername == undefined) {
      setRemoteState(prevState => ({...prevState, formError: "Must enter username to reset password"}))
    } else {
      presentAlert({
        header: "Request password reset",
        message: "Press reset to receive an email link to reset your password",
        buttons: [ {
          text: "Cancel", role: "cancel"
        }, {
          text: "Reset", role: "confirm", handler: () => callResetPasswordAPI()
        }]
      })
    }
  }

  function setWorkingOffline() {
    setRemoteDBState({...remoteDBState,workingOffline: true,connectionStatus: ConnectionStatus.loginComplete, 
        syncStatus: SyncStatus.offline})
    navigateToFirstListID(db,props.history,remoteDBCreds);    
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

  if (remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) {
    return (<></>)
  }
  
  let formElem;
  if (remoteDBState.serverAvailable) {
    if (!remoteState.inCreateMode) {
      formElem = <><IonItem><IonLabel position="stacked">API Server URL</IonLabel>
      <IonInput type="url" inputmode="url" value={remoteDBCreds.apiServerURL} onIonChange={(e) => {setDBCredsValue("apiServerURL",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem><IonLabel position="stacked">Username</IonLabel>
      <IonInput type="text" autocomplete="username" value={remoteDBCreds.dbUsername} onIonChange={(e) => {setDBCredsValue("dbUsername",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem><IonLabel position="stacked">Password</IonLabel>
      <IonInput autocomplete="current-password" type={remoteState.showMainPassword ? "text" : "password"} value={remoteState.password} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
      </IonInput><IonIcon slot="end"  icon={remoteState.showMainPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showMainPassword: !prevState.showMainPassword}))}}></IonIcon>
      </IonItem>
      </>
    } else {
      formElem = <>
      <IonItem><IonLabel position="stacked">API Server URL</IonLabel>
      <IonInput type="url" inputmode="url" value={remoteDBCreds.apiServerURL} onIonChange={(e) => {setDBCredsValue("apiServerURL:",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem><IonLabel position="stacked">Username</IonLabel>
      <IonInput type="text" autocomplete="username" value={remoteDBCreds.dbUsername} onIonChange={(e) => {setDBCredsValue("dbUsername",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem><IonLabel position="stacked">E-Mail address</IonLabel>
      <IonInput type="email" autocomplete="email" value={remoteDBCreds.email} onIonChange={(e) => {setDBCredsValue("email",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem><IonLabel position="stacked">Full Name</IonLabel>
      <IonInput type="text" value={remoteDBCreds.fullName} onIonChange={(e) => {setDBCredsValue("fullName",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem><IonLabel position="stacked">Password</IonLabel>
      <IonInput autocomplete="current-password" type={remoteState.showMainPassword ? "text" : "password"} value={remoteState.password} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
      </IonInput><IonIcon slot="end"  icon={remoteState.showMainPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showMainPassword: !prevState.showMainPassword}))}}></IonIcon>
      </IonItem>
      <IonItem><IonLabel position="stacked">Confirm Password</IonLabel>
      <IonInput autocomplete="current-password" type={remoteState.showVerifyPassword ? "text" : "password"} value={remoteState.verifyPassword} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, verifyPassword: String(e.detail.value)}))}}>
      </IonInput><IonIcon slot="end"  icon={remoteState.showVerifyPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showVerifyPassword: !prevState.showVerifyPassword}))}}></IonIcon>
      </IonItem>
      </>
    }
  } else {
    formElem = <>
      <IonItem>
        <IonText>
          The database server is not available. You can choose to work offline and your changes will sync when you start the app again and the server is available. The risk for conflicts increases when working offline.
        </IonText>
      </IonItem>
    </>

  }
  let buttonsElem
  if (remoteDBState.serverAvailable) {
    if (!remoteState.inCreateMode) {
      buttonsElem=<>
        <IonItem>
        <IonButton slot="start" onClick={() => submitForm()}>Login</IonButton>
        {/* <IonButton onClick={() => workOffline()}>Work Offline</IonButton> */}        
        <IonButton onClick={() => resetPassword()}>Reset Password</IonButton>
        <IonButton slot="end" onClick={() => setRemoteState(prevState => ({...prevState,inCreateMode: true, formError: ""}))}>Create New User</IonButton>
        </IonItem>
      </>
    } else {
      buttonsElem=<>
        <IonItem>
        <IonButton onClick={() => submitCreateForm()}>Create</IonButton>
        <IonButton onClick={() => setRemoteState(prevState => ({...prevState,inCreateMode: false}))}>Cancel</IonButton>
        </IonItem>
      </>
    }
  } else {
    buttonsElem=<>
      <IonItem>
        <IonButton slot="start" onClick={() => setWorkingOffline()}>Work Offline</IonButton>
      </IonItem>
    </>
  }

  return(
        <IonPage>
            <IonHeader><IonToolbar>
            <IonButtons slot="start"><IonMenuButton /></IonButtons>
            <IonTitle>
            Login Page
            </IonTitle></IonToolbar></IonHeader>
            <IonContent>
            <IonList>
              {formElem}
              {buttonsElem}
                <IonItem>
                  <IonText>{remoteState.formError}</IonText>
                </IonItem>
            </IonList>
            </IonContent>

        </IonPage>
    )
}

export default RemoteDBLogin;