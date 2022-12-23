import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, NavContext, IonText, useIonAlert } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { usePouch} from 'use-pouchdb';
import { DBCreds, DBUUIDAction } from '../components/RemoteDBState';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { GlobalStateContext } from '../components/GlobalState';
import { createNewUser,  } from '../components/RemoteUtilities';
import { cloneDeep } from 'lodash';
import { RemoteDBState, RemoteDBStateContext, RemoteDBStateContextType, SyncStatus } from '../components/RemoteDBState';

export type RemoteState = {
  password: string | undefined,
  verifyPassword: string | undefined,
  httpResponse: HttpResponse | undefined,
  inCreateMode: boolean,
  loginByPassword: boolean,
  formError: string,
}

/* 

Three logic paths:  (should these be 3 conditional components?)

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

const RemoteDBLogin: React.FC = () => {

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>({
      password: undefined,
      verifyPassword: undefined,
      httpResponse: undefined,
      inCreateMode: false,
      loginByPassword: false,
      formError: ""
    });
    const [presentAlert] = useIonAlert();
    const {navigate} = useContext(NavContext);
    const { globalState, setGlobalState, setStateInfo} = useContext(GlobalStateContext);
    const { remoteDBState, setRemoteDBState, errorCheckCreds, assignDBAndSync, setDBCredsValue} = useContext(RemoteDBStateContext);

    console.log("did I even get to RemoteDBLogin??");


    // effect for dbuuidaction not none
    useEffect( () => {
      if (remoteDBState.dbUUIDAction !== DBUUIDAction.none) {
        if (remoteDBState.dbUUIDAction == DBUUIDAction.exit_no_uuid_on_server) {
          console.log("ERROR: No database UUID defined in server todos database. Cannot continue");
          presentAlert({
            header: "ERROR",
            message: "The server is incorrectly configured with no unique ID. Please ensure server process is running.",
            buttons: ["OK"]
          });
          App.exitApp();
          return;
        } else if (remoteDBState.dbUUIDAction == DBUUIDAction.destroy_needed) {
          presentAlert( {
            header: "WARNING",
            message: "The Database identifier on the server is not the same as the local copy. You should delete your local copy in order to continue. App will exit.",
            buttons: [
              {text: "Delete/Exit",handler: () => destroyAndExit()},
              {text: "Cancel/Exit",handler: () => App.exitApp()}
              ]
          })
        }
      }
    },[remoteDBState.dbUUIDAction])

    async function destroyAndExit() {
      await db.destroy();
      await Preferences.remove({key: 'dbcreds'});
      App.exitApp();
    }

    function updateDBCredsFromResponse(response: HttpResponse): DBCreds {
      let newDBCreds=cloneDeep(remoteDBState.dbCreds);
      newDBCreds.couchBaseURL  = response?.data.couchdbUrl;
      newDBCreds.database = response?.data.couchdbDatabase;
      newDBCreds.email = response?.data.email;
      newDBCreds.fullName = response?.data.fullname;
      newDBCreds.JWT = response?.data.jwt;
      return newDBCreds;
    }
    
  async function submitForm() {
//    setPrefsDBCreds();
    console.log("in submit form");
    let credsCheck = errorCheckCreds(remoteDBState.dbCreds,false,false,remoteState.password);
    console.log(credsCheck);
    if (credsCheck.credsError ) {
      setRemoteState(prevState => ({...prevState,formError: String(credsCheck.credsError)}))
      console.log("error found, exiting submit");
      return;
    }
    let response: HttpResponse;
    const options = {
        url: String(remoteDBState.dbCreds.apiServerURL+"/issuetoken"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json'},
        data: { username: remoteDBState.dbCreds.dbUsername,
                password: remoteState.password},           
    };
    response = await CapacitorHttp.post(options);
    console.log("got http response",{response});
    if (!((response?.status == 200) && (response?.data?.loginSuccessful))) {
        setRemoteState(prevState => ({...prevState, formError: "Invalid Authentication"}))
        return
    }
    let newCreds=updateDBCredsFromResponse(response);
    let assignSuccess = assignDBAndSync(newCreds);
    if (!assignSuccess) {
      setRemoteState(prevState => ({...prevState, formError: "Error Starting Sync"}))
    }
  }
  
  async function submitCreateForm() {
//    setPrefsDBCreds();
    let createResponse: any;
    let credsCheck = errorCheckCreds(remoteDBState.dbCreds,false,true,remoteState.password,remoteState.verifyPassword);
    if (!credsCheck.credsError) {
      createResponse = await createNewUser(remoteDBState,String(remoteState.password));
      if (!createResponse.createdSuccessfully) {
        let errorText="";
        if (createResponse.invalidData) {errorText = "Invalid Data Entered";} 
        else if (createResponse.userAlreadyExists) {errorText = "User Already Exists";}
        setRemoteState(prevState => ({...prevState, formError: errorText}))
        return;
      }
    } else {
      setRemoteState(prevState => ({...prevState, formError: String(credsCheck.credsError)}));
    }
    let newCreds=updateDBCredsFromResponse(createResponse);
    let assignSuccess = assignDBAndSync(newCreds);
    if (!assignSuccess) {
      setRemoteState(prevState => ({...prevState, formError: "Error Starting Sync"}));
    }
  }
  

  if (remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) {
    return (<></>)
  }
  
  let formElem;
  if (!remoteState.inCreateMode) {
    formElem = <><IonItem><IonLabel position="stacked">API Server URL</IonLabel>
    <IonInput type="url" inputmode="url" value={remoteDBState.dbCreds.apiServerURL} onIonChange={(e) => {setDBCredsValue("apiServerURL",String(e.detail.value))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Username</IonLabel>
    <IonInput type="text" autocomplete="username" value={remoteDBState.dbCreds.dbUsername} onIonChange={(e) => {setDBCredsValue("dbUsername",String(e.detail.value))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Password</IonLabel>
    <IonInput autocomplete="current-password" type="password" value={remoteState.password} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
    </IonInput>
    </IonItem>
    </>
  } else {
    formElem = <>
    <IonItem><IonLabel position="stacked">API Server URL</IonLabel>
    <IonInput type="url" inputmode="url" value={remoteDBState.dbCreds.apiServerURL} onIonChange={(e) => {setDBCredsValue("apiServerURL:",String(e.detail.value))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Username</IonLabel>
    <IonInput type="text" autocomplete="username" value={remoteDBState.dbCreds.dbUsername} onIonChange={(e) => {setDBCredsValue("dbUsername",String(e.detail.value))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">E-Mail address</IonLabel>
    <IonInput type="email" autocomplete="email" value={remoteDBState.dbCreds.email} onIonChange={(e) => {setDBCredsValue("email",String(e.detail.value))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Full Name</IonLabel>
    <IonInput type="text" value={remoteDBState.dbCreds.fullName} onIonChange={(e) => {setDBCredsValue("fullName",String(e.detail.value))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Password</IonLabel>
    <IonInput autocomplete="current-password" type="password" value={remoteState.password} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Confirm Password</IonLabel>
    <IonInput autocomplete="current-password" type="password" value={remoteState.verifyPassword} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, verifyPassword: String(e.detail.value)}))}}>
    </IonInput>
    </IonItem>
    </>
  }

  let buttonsElem
  if (!remoteState.inCreateMode) {
    buttonsElem=<>
      <IonItem>
      <IonButton slot="start" onClick={() => submitForm()}>Login</IonButton>
      <IonButton slot="end" onClick={() => setRemoteState(prevState => ({...prevState,formError: ""}))}>Create New User</IonButton>
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

  return(
        <IonPage>
            <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton /></IonButtons><IonTitle>
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