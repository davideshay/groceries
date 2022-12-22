import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, NavContext, IonText, useIonAlert } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { usePouch, useFind } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import { DBCreds, DBCredsInit } from '../components/DataTypes';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { isJsonString, urlPatternValidation, emailPatternValidation,DEFAULT_DB_NAME, DEFAULT_DB_URL_PREFIX, DEFAULT_API_URL } from '../components/Utilities'; 
import { GlobalStateContext } from '../components/GlobalState';
import { createNewUser, RemoteState, CredsStatus, ConnectionStatus } from '../components/RemoteUtilities';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import { RemoteDBState, RemoteDBStateContext, RemoteDBStateContextType, SyncStatus } from '../components/RemoteDBState';

const RemoteDBLogin: React.FC = () => {

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>({
      dbCreds: DBCredsInit,
      password: undefined,
      verifyPassword: undefined,
      credsStatus: CredsStatus.needLoaded,
      connectionStatus: ConnectionStatus.cannotStart,
      httpResponse: undefined,
      showLoginForm: false,
      loginByPassword: false,
      createNewUser: false,
      formSubmitted: false,
      formError: ""
    });
//    const [remoteDB, setRemoteDB]=useState<any>();
    const [presentAlert] = useIonAlert();
    const {navigate} = useContext(NavContext);
    const { globalState, setGlobalState, setStateInfo} = useContext(GlobalStateContext);
    const { remoteDBState, setRemoteDBState, startSync} = useContext(RemoteDBStateContext);
    
    useEffect(() => {
      if (remoteState.credsStatus === CredsStatus.needLoaded) {
        getPrefsDBCreds();
      } 
    },[remoteState.credsStatus])

    function errorCheckCreds() {
      setRemoteState(prevState => ({...prevState,formError:""}));
      if ((remoteState.dbCreds.JWT == null || remoteState.dbCreds.JWT == "") && (!remoteState.showLoginForm)) {
        setRemoteState(prevState => ({...prevState,formError: "No existing credentials found"}));
        return false;
      }
      if (remoteState.dbCreds.apiServerURL == null || remoteState.dbCreds.apiServerURL == "") {
        setRemoteState(prevState => ({...prevState,formError: "No API server URL entered"}));
        return false;
      }
      if ((!remoteState.showLoginForm) && (remoteState.dbCreds.couchBaseURL == null || remoteState.dbCreds.couchBaseURL == "")) {
        setRemoteState(prevState => ({...prevState,formError: "No Base URL entered"}));
        return false;
      }
      if (!urlPatternValidation(remoteState.dbCreds.apiServerURL)) {
        setRemoteState(prevState => ({...prevState,formError: "Invalid API URL"}));
        return false;
      }
      if ((!remoteState.showLoginForm) && (!urlPatternValidation(String(remoteState.dbCreds.couchBaseURL)))) {
        setRemoteState(prevState => ({...prevState,formError: "Invalid DB URL"}));
        return false;
      }
      if (remoteState.dbCreds.apiServerURL.endsWith("/")) {
        setRemoteState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,apiServerURL: String(prevState.dbCreds.apiServerURL?.slice(0,-1))}}))
      }
      if (String(remoteState.dbCreds.couchBaseURL).endsWith("/")) {
        setRemoteState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,couchBaseURL: String(prevState.dbCreds.couchBaseURL?.slice(0,-1))}}))
      }
      if ((!remoteState.showLoginForm) && (remoteState.dbCreds.database == null || remoteState.dbCreds.database == "")) {
        setRemoteState(prevState => ({...prevState,formError: "No database entered"}));
        return false;
      }
      if (remoteState.dbCreds.dbUsername == null || remoteState.dbCreds.dbUsername == "") {
        setRemoteState(prevState => ({...prevState,formError: "No database user name entered"}));
        return false;
      }
      if ((remoteState.createNewUser) && (remoteState.dbCreds.email == null || remoteState.dbCreds.email == "")) {
        setRemoteState(prevState => ({...prevState,formError: "No email entered"}));
        return false;
      }
      if ((remoteState.createNewUser) && (!emailPatternValidation(String(remoteState.dbCreds.email)))) {
        setRemoteState(prevState => ({...prevState,formError: "Invalid email format"}));
        return false;
      }
      if ((remoteState.loginByPassword) && (remoteState.password == undefined || remoteState.password == "")) {
        setRemoteState(prevState => ({...prevState,formError: "No password entered"}));
        return false;
      }
      if ((remoteState.createNewUser) && (remoteState.password != remoteState.verifyPassword)) {
        setRemoteState(prevState => ({...prevState,formError: "Passwords do not match"}));
        return false;
      }
      return true;
    }

    useEffect( () => {
      if (remoteState.credsStatus === CredsStatus.loaded) {
        if ( errorCheckCreds() ) {
          setPrefsDBCreds(); // update creds with filtered list now in dbcreds state
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.checkingJWT}))
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid, showLoginForm: true, loginByPassword: true}))
        }
      }
    },[remoteState.credsStatus])

    useEffect( () => {
      let response: HttpResponse | undefined;
      const checkJWT = async () => {
        const options = {
          url: String(remoteState.dbCreds.couchBaseURL+"/_session"),
          method: "GET",
          headers: { 'Content-Type': 'application/json',
                     'Accept': 'application/json',
                     'Authorization': 'Bearer '+remoteState.dbCreds.JWT },
          webFetchExtra: { credentials: "include" as RequestCredentials, },
        };
        response = await CapacitorHttp.get(options);
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.JWTResponseFound,
                     httpResponse: response}))
      }
      if (remoteState.connectionStatus === ConnectionStatus.JWTNeedsChecking) {
        checkJWT();
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.checkingJWT}));
      }
    },[remoteState.connectionStatus])

    useEffect( () => {
      if (remoteState.connectionStatus === ConnectionStatus.JWTResponseFound) {
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse.data?.userCtx?.name != null)) {
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid,showLoginForm: true, loginByPassword: true,  formError: "Invalid Authentication provided"}));
        }
      }
    },[remoteState.connectionStatus])

    useEffect( () => {
      let response: HttpResponse | undefined;
      const checkPasswordLogin = async () => {
        const options = {
          url: String(remoteState.dbCreds.apiServerURL+"/issuetoken"),
          method: "POST",
          headers: { 'Content-Type': 'application/json',
                     'Accept': 'application/json'},
          data: { username: remoteState.dbCreds.dbUsername,
                  password: remoteState.password},           
        };
        response = await CapacitorHttp.post(options);
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.tokenResponseFound,
                httpResponse: response}))
      }
      if (remoteState.connectionStatus === ConnectionStatus.tryIssueToken) {
        checkPasswordLogin();
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.checkingIssueToken}));
      }

    },[remoteState.connectionStatus])

    function updateDBCredsFromResponse() {
      let newDBCreds=cloneDeep(remoteState.dbCreds);
      newDBCreds.couchBaseURL  = remoteState.httpResponse?.data.couchdbUrl;
      newDBCreds.database = remoteState.httpResponse?.data.couchdbDatabase;
      newDBCreds.email = remoteState.httpResponse?.data.email;
      newDBCreds.fullName = remoteState.httpResponse?.data.fullname;
      newDBCreds.JWT = remoteState.httpResponse?.data.loginJWT;
      let credsObj = JSON.stringify(newDBCreds);
      Preferences.set({key: 'dbcreds', value: credsObj})
      setRemoteState(prevState => ({...prevState, dbCreds: newDBCreds}))
    }

    useEffect( () => {
//      console.log("cs ",remoteState.connectionStatus);
      if (remoteState.connectionStatus === ConnectionStatus.tokenResponseFound) {
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse?.data?.loginSuccessful)) {
          updateDBCredsFromResponse()
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid,showLoginForm: true, loginByPassword: true,  formError: "Invalid Authentication provided"}));
        }
      }
    },[remoteState.connectionStatus])

    useEffect(() => {
      if (remoteState.credsStatus === CredsStatus.loaded) {
        if (remoteState.dbCreds.JWT == undefined || 
            remoteState.dbCreds.JWT == "") {
              setRemoteState(prevstate => ({...prevstate,showLoginForm: true, loginByPassword: true}));
            }
         else {
            setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.JWTNeedsChecking}))
         }   
      }
    },[remoteState.credsStatus])

    useEffect(() => {
      // assign effect
      if (remoteDBState.remoteDB == null && (remoteState.connectionStatus === ConnectionStatus.remoteDBNeedsAssigned)) {
        console.log("about to set RemoteDB...");
        setRemoteDBState({...remoteDBState,remoteDB: new PouchDB(remoteState.dbCreds.couchBaseURL+"/"+remoteState.dbCreds.database, 
        { fetch: (url, opts: any) => ( 
             fetch(url, { ...opts, credentials: 'include', headers:
              { ...opts.headers, 'Authorization': 'Bearer '+remoteState.dbCreds.JWT, 'Content-type': 'application/json' }})
              )} )});

        // setRemoteDB(new PouchDB(remoteState.dbCreds.couchBaseURL+"/"+remoteState.dbCreds.database, 
        //   { fetch: (url, opts: any) => ( 
        //        fetch(url, { ...opts, credentials: 'include', headers:
        //         { ...opts.headers, 'Authorization': 'Bearer '+remoteState.dbCreds.JWT, 'Content-type': 'application/json' }})
        //         )} ));
        setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.checkDBUUID}));
      }
    }, [db,remoteDBState.remoteDB,remoteState.connectionStatus])

    async function destroyAndExit() {
      await db.destroy();
      await Preferences.remove({key: 'dbcreds'});
      App.exitApp();
    }

    async function compareRemoteDBUUID() {
        // find on remoteDB, get 1 doc
      console.log("In Compare Remote DBUUID");
      let UUIDResults = await (remoteDBState.remoteDB as PouchDB.Database).find({
          selector: { "type": { "$eq": "dbuuid"} } })
      let UUIDResult : null|string = null;
      if (UUIDResults.docs.length > 0) {
        UUIDResult = (UUIDResults.docs[0] as any).uuid;
      }
      if (UUIDResult == null) {
        console.log("ERROR: No database UUID defined in server todos database. Cannot continue");
        return;
      }
      console.log("Remote UUID is ", UUIDResult);
      let rs=cloneDeep(remoteState);
      console.log("creds UUID is ", rs.dbCreds.remoteDBUUID);
        // compare to current DBCreds one.
      if (remoteState.dbCreds.remoteDBUUID == UUIDResult) {
        console.log("Compared the same");
        setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.attemptToSync}))
        return;
      } 
      let localDBInfo = null;
      let localHasRecords = false;
      try { localDBInfo = await db.info();} catch(e) {localHasRecords=false};
      if (localDBInfo != null && localDBInfo.doc_count > 0) { localHasRecords = true}
      console.log({localDBInfo,localHasRecords});
      if (localHasRecords) {
        let localDBAllDocs = null;
        try { localDBAllDocs = await db.allDocs({include_docs: true});} catch(e) {console.log(e)};
        console.log(localDBAllDocs);
        if ((localDBAllDocs != null) &&
            (localDBInfo?.doc_count == 1) &&
           ((localDBAllDocs.rows[0]?.doc) as any).language == "query")
           { localHasRecords = false }
      }  

        // if current DBCreds doesn't have one, set it to the remote one.
      if ((remoteState.dbCreds.remoteDBUUID == null || remoteState.dbCreds.remoteDBUUID == "" ) && !localHasRecords) {
        console.log("none defined locally, setting");
        setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.attemptToSync,dbCreds: {...prevState.dbCreds, remoteDBUUID: UUIDResult}}))
        return;
      }
      console.log("need to destroy");
        // if different, destroy the local pouchDB (prompt first?)
      presentAlert( {
        header: "WARNING",
        message: "The Database identifier on the server is not the same as the local copy. You should delete your local copy in order to continue. App will exit.",
        buttons: [
          {text: "Delete/Exit",handler: () => destroyAndExit()},
          {text: "Cancel/Exit",handler: () => App.exitApp()}
        ]
      })
    }

    useEffect(() => {      
      if (remoteDBState.remoteDB !== null && remoteState.connectionStatus == ConnectionStatus.checkDBUUID) {
       compareRemoteDBUUID(); 
      }
    },[db, remoteDBState.remoteDB, remoteState.connectionStatus])

    useEffect(() => {
      // sync effect
      if (remoteDBState.remoteDB !== undefined && (remoteState.connectionStatus === ConnectionStatus.attemptToSync)) {
        setPrefsDBCreds();
        startSync();        
      }
    }, [db,remoteDBState.remoteDB,remoteState.connectionStatus])

    useEffect(() => {
      if (remoteState.connectionStatus == ConnectionStatus.startingCreateUser) {}
    },[remoteState.connectionStatus]);

    async function navigateToFirstListID() {
      let listResults = await db.find({
          selector: { "$and": [ 
            {  "type": "list",
                "name": { "$exists": true } },
            { "$or" : [{"listOwner": remoteState.dbCreds?.dbUsername},
                        {"sharedWith": { $elemMatch: {$eq: remoteState.dbCreds?.dbUsername}}}]
            }] },
          sort: [ "type","name"]})
      let firstListID = null;
      if (listResults.docs.length > 0) {
        firstListID = listResults.docs[0]._id;
      }
      if (firstListID == null) {
        navigate("/lists")
      } else {
        navigate("/items/"+firstListID)
      }  
    }

    useEffect(() => {
      console.log("in nav effect cs = ",remoteState.connectionStatus);
      let rems=cloneDeep(remoteState);
      let gs=cloneDeep(globalState);
      console.log("maybe navigating: gotlistid ",{gs,rems});
      if ((remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) && (remoteState.connectionStatus !== ConnectionStatus.loginComplete) ) {
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.loginComplete}))
        setGlobalState({...globalState, dbCreds: remoteState.dbCreds});
        navigateToFirstListID();
      }
    }, [remoteDBState.syncStatus, remoteState.connectionStatus])

  const setPrefsDBCreds = async() => {
        let credsObj = JSON.stringify(remoteState.dbCreds);
        await Preferences.set({key: 'dbcreds', value: credsObj})
      }
    
  const getPrefsDBCreds = async() => {
    let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
    let credsObj: DBCreds = DBCredsInit;
    const credsOrigKeys = keys(credsObj);
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','JWT',"remoteDBUUID"])
      setRemoteState(prevstate => ({...prevstate,dbCreds: credsObjFiltered, credsStatus: CredsStatus.loaded}))
    }
    const credKeys = keys(credsObj);
    if (credsObj == null || (credsObj as any).apiServerURL == undefined || (!isEqual(credsOrigKeys.sort(),credKeys.sort()))) {
        setRemoteState(prevstate => ({...prevstate, dbCreds: {
            apiServerURL: DEFAULT_API_URL,
            couchBaseURL: DEFAULT_DB_URL_PREFIX,
            database: DEFAULT_DB_NAME,
            dbUsername:"",
            JWT:"",
            email: "",
            fullName: "",
            remoteDBUUID:""
        }, credsStatus: CredsStatus.loaded}))
    }
  }

  function submitForm() {
    setPrefsDBCreds();
    if (errorCheckCreds() ) {
      setRemoteState(prevstate => ({...prevstate,formSubmitted: true, connectionStatus: ConnectionStatus.tryIssueToken}))
    } else {
      setRemoteState(prevState => ({...prevState,showLoginForm: true, loginByPassword: true,  connectionStatus: ConnectionStatus.cannotStart}))
    } 
  }
  
  async function submitCreateForm() {
    setPrefsDBCreds();
    let createResponse: any;
    if (errorCheckCreds()) {
      createResponse = await createNewUser(remoteState);
      if (createResponse.createdSuccessfully) {
        setRemoteState(prevState => ({...prevState,
          dbCreds: {...prevState.dbCreds, couchBaseURL: createResponse.couchdbUrl,
                    database: createResponse.couchdbDatabase, JWT: createResponse.jwt}, 
          connectionStatus: ConnectionStatus.remoteDBNeedsAssigned
        }))
      }
      else {
        let errorText="";
        if (createResponse.invalidData) {errorText = "Invalid Data Entered";} 
        else if (createResponse.userAlreadyExists) {errorText = "User Already Exists";}
        setRemoteState(prevState => ({...prevState,showLoginForm: true, formError: errorText}))
      }
    } else {
      setRemoteState(prevState => ({...prevState,showLoginForm: true, loginByPassword: false}));
    }
    setRemoteState(prevState => ({...prevState,loginByPassword: false}))
  }
  

  if (remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) {
    return (<></>)
  }

  if ((remoteState.credsStatus !== CredsStatus.loaded) || (!remoteState.showLoginForm)) return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Logging Into Remote...</IonTitle></IonToolbar></IonHeader></IonPage>
  )
  
  let formElem;
  if (remoteState.loginByPassword) {
    formElem = <><IonItem><IonLabel position="stacked">API Server URL</IonLabel>
    <IonInput type="url" inputmode="url" value={remoteState.dbCreds.apiServerURL} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,apiServerURL: String(e.detail.value)}}))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Username</IonLabel>
    <IonInput type="text" autocomplete="username" value={remoteState.dbCreds.dbUsername} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,dbUsername: String(e.detail.value)}}))}}>
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
    <IonInput type="url" inputmode="url" value={remoteState.dbCreds.apiServerURL} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,apiServerURL: String(e.detail.value)}}))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Username</IonLabel>
    <IonInput type="text" autocomplete="username" value={remoteState.dbCreds.dbUsername} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,dbUsername: String(e.detail.value)}}))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">E-Mail address</IonLabel>
    <IonInput type="email" autocomplete="email" value={remoteState.dbCreds.email} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,email: String(e.detail.value)}}))}}>
    </IonInput>
    </IonItem>
    <IonItem><IonLabel position="stacked">Full Name</IonLabel>
    <IonInput type="text" value={remoteState.dbCreds.fullName} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,fullName: String(e.detail.value)}}))}}>
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
  if (remoteState.loginByPassword) {
    buttonsElem=<>
      <IonItem>
      <IonButton slot="start" onClick={() => submitForm()}>Login</IonButton>
      <IonButton slot="end" onClick={() => setRemoteState(prevState => ({...prevState,formError: "",  loginByPassword: false, createNewUser: true}))}>Create New User</IonButton>
      </IonItem>
    </>
  } else {
    buttonsElem=<>
      <IonItem>
      <IonButton onClick={() => submitCreateForm()}>Create</IonButton>
      <IonButton onClick={() => setRemoteState(prevState => ({...prevState,loginByPassword: true, createNewUser: false}))}>Cancel</IonButton>
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