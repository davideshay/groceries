import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonLoading, NavContext, IonText } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { usePouch, useFind } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import { DBCreds } from '../components/DataTypes';
import { Preferences } from '@capacitor/preferences';
import { isJsonString, DEFAULT_DB_NAME, DEFAULT_DB_URL_PREFIX, DEFAULT_API_URL } from '../components/Utilities'; 
import { GlobalStateContext, SyncStatus } from '../components/GlobalState';
import { cloneDeep } from 'lodash';


type RemoteState = {
  dbCreds: DBCreds,
  password: string | undefined,
  credsStatus: CredsStatus,
  connectionStatus: ConnectionStatus,
  httpResponse: HttpResponse | undefined,
  showLoginForm: boolean,
  loginByPassword: boolean,
  formError: string,
  formSubmitted: boolean,
  firstListID: string | null,
  gotListID: boolean
}

enum CredsStatus {
  needLoaded = 0,
  loading = 1,
  loaded = 2
}

enum ConnectionStatus {
  cannotStart = 0,
  JWTNeedsChecking = 2,
  checkingJWT = 3,
  JWTResponseFound = 4,
  JWTInvalid = 5,
  JWTValid = 6,
  tryIssueToken = 7,
  checkingIssueToken = 8,
  tokenResponseFound = 9,
  remoteDBNeedsAssigned = 10,
  remoteDBAssigned = 11,
  attemptToSync = 12,
  loginComplete = 13
}

const RemoteDBLogin: React.FC = () => {

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>({
      dbCreds: {apiServerURL: undefined ,couchBaseURL: undefined, database: undefined, dbUsername: undefined, email: undefined, JWT: undefined},
      password: undefined,
      credsStatus: CredsStatus.needLoaded,
      connectionStatus: ConnectionStatus.cannotStart,
      httpResponse: undefined,
      showLoginForm: false,
      loginByPassword: false,
      formSubmitted: false,
      formError: "",
      firstListID: null,
      gotListID: false
    });
    const [remoteDB, setRemoteDB]=useState<any>();

    const {navigate} = useContext(NavContext);
    const { globalState, setStateInfo} = useContext(GlobalStateContext);

    const { docs: listDocs, loading: listLoading, error: listError } = useFind({
      index: { fields: ["type","name"] },
      selector: { type: "list", name: { $exists: true }},
      sort: [ "type", "name" ]})

    useEffect(() => {
      if (remoteState.credsStatus === CredsStatus.needLoaded) {
        getPrefsDBCreds();
      } 
    },[remoteState.credsStatus])

    useEffect(() => {
      if (!remoteState.gotListID && !listLoading && listDocs.length > 0) {
        setRemoteState(prevstate => ({...remoteState,firstListID: listDocs[0]._id, gotListID: true}));
      }

    },[listDocs, listLoading])

    function urlPatternValidation(url: string) {
      const regex = new RegExp('https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))')
//      const regex = new RegExp('(https?://)?([\\da-z.-]+)\\.([a-z.]{2,6})[/\\w .-]*/?');    
      return regex.test(url);
    };

    function emailPatternValidation(email: string) {
      const emailRegex=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      return emailRegex.test(email);
    };

    function errorCheckCreds() {
      if ((remoteState.dbCreds.JWT == undefined || remoteState.dbCreds.JWT == "") && (!remoteState.loginByPassword)) {
        setRemoteState(prevState => ({...prevState,formError: "No existing credentials found"}));
        return false;
      }
      if (remoteState.dbCreds.apiServerURL == undefined || remoteState.dbCreds.apiServerURL == "") {
        setRemoteState(prevState => ({...prevState,formError: "No API server URL entered"}));
        return false;
      }
      if (remoteState.dbCreds.couchBaseURL == undefined || remoteState.dbCreds.couchBaseURL == "") {
        setRemoteState(prevState => ({...prevState,formError: "No Base URL entered"}));
        return false;
      }
      if (!urlPatternValidation(remoteState.dbCreds.apiServerURL)) {
        setRemoteState(prevState => ({...prevState,formError: "Invalid API URL"}));
        return false;
      }
      if (remoteState.dbCreds.apiServerURL.endsWith("/")) {
        setRemoteState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,apiServerURL: prevState.dbCreds.apiServerURL?.slice(0,-1)}}))
      }
      if (remoteState.dbCreds.database == undefined || remoteState.dbCreds.database == "") {
        setRemoteState(prevState => ({...prevState,formError: "No database entered"}));
        return false;
      }
      if (remoteState.dbCreds.dbUsername == undefined || remoteState.dbCreds.dbUsername == "") {
        setRemoteState(prevState => ({...prevState,formError: "No database user name entered"}));
        return false;
      }
      if (remoteState.dbCreds.email == undefined || remoteState.dbCreds.email == "") {
        setRemoteState(prevState => ({...prevState,formError: "No email entered"}));
        return false;
      }
      if (!emailPatternValidation(remoteState.dbCreds.email)) {
        setRemoteState(prevState => ({...prevState,formError: "Invalid email format"}));
        return false;
      }
      if (remoteState.password == undefined || remoteState.password == "") {
        setRemoteState(prevState => ({...prevState,formError: "No password entered"}));
        return false;
      }
      return true;
    }

    useEffect( () => {
      if (remoteState.credsStatus === CredsStatus.loaded) {
        if ( errorCheckCreds() ) {
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
        console.log("about to execute httpget with options: ", {options})
        response = await CapacitorHttp.get(options);
        console.log("got httpget response: ",{response});
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
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.attemptToSync}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid,showLoginForm: true, formError: "Invalid Authentication provided"}));
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
        console.log("about to execute httpget with options: ", {options})
        response = await CapacitorHttp.post(options);
        console.log("got httpget response: ",{response});
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.tokenResponseFound,
                httpResponse: response}))
      }
      if (remoteState.connectionStatus === ConnectionStatus.tryIssueToken) {
        console.log("trying password login");
        checkPasswordLogin();
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.checkingIssueToken}));
      }

    },[remoteState.connectionStatus])

    function updateDBCredsFromResponse() {
      let newDBCreds=cloneDeep(remoteState.dbCreds);
      newDBCreds.couchBaseURL  = remoteState.httpResponse?.data.couchdbUrl;
      newDBCreds.database= remoteState.httpResponse?.data.couchdbDatabase;
      newDBCreds.email = remoteState.httpResponse?.data.email;
      newDBCreds.JWT= remoteState.httpResponse?.data.JWT;
      let credsObj = JSON.stringify(newDBCreds);
      Preferences.set({key: 'dbcreds', value: credsObj})
      setRemoteState(prevState => ({...prevState, dbCreds: newDBCreds}))
    }

    useEffect( () => {
      if (remoteState.connectionStatus === ConnectionStatus.tokenResponseFound) {
        console.log("password response found: ", {remoteState})
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse?.data?.loginSuccessful)) {
          updateDBCredsFromResponse()
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid,showLoginForm: true, formError: "Invalid Authentication provided"}));
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
            setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}))
         }   
      }
    },[remoteState.credsStatus])

    useEffect(() => {
      // assign effect
      if (remoteDB == null && (remoteState.connectionStatus === ConnectionStatus.remoteDBNeedsAssigned)) {
        setRemoteDB(new PouchDB(remoteState.dbCreds.couchBaseURL+"/"+remoteState.dbCreds.database, 
        { fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include', headers: { ...opts?.headers, 'Authorization': 'Bearer '+remoteState.dbCreds.JWT}})} ));
        setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.attemptToSync}));
      }
    }, [db,remoteDB,remoteState.connectionStatus])


    useEffect(() => {
      // sync effect
      if (remoteDB !== null && (remoteState.connectionStatus === ConnectionStatus.attemptToSync)) {
        const sync = db.sync(remoteDB, {
          retry: true,
          live: true,
        }).on('paused', () => { setStateInfo("syncStatus", SyncStatus.paused)})
          .on('active', () => { setStateInfo("syncStatus", SyncStatus.active)})
          .on('denied', () => { setStateInfo("syncStatus", SyncStatus.denied)})
          .on('error', () => { console.log ("error state") ; 
                            setStateInfo("syncStatus", SyncStatus.error)})
        
        return () => {
          // and cancel syncing whenever our sessionState changes
          console.log("should I cancel sync here?");
          // sync.cancel()
        }
      }
    }, [db,remoteDB,remoteState.connectionStatus])

    useEffect(() => {
      if ((globalState.syncStatus === SyncStatus.active || globalState.syncStatus === SyncStatus.paused) && (remoteState.connectionStatus !== ConnectionStatus.loginComplete) && (remoteState.gotListID)) {
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.loginComplete}))
        if (remoteState.firstListID == null) {
          navigate("/lists")
        } else {
          navigate("/items/"+remoteState.firstListID)
        }  
      }
    }, [globalState.syncStatus,remoteState.gotListID])

  const setPrefsDBCreds = async() => {
        let credsObj = JSON.stringify(remoteState.dbCreds);
        await Preferences.set({key: 'dbcreds', value: credsObj})
      }
    
  const getPrefsDBCreds = async() => {
    let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
    let credsObj: DBCreds = { apiServerURL: undefined ,couchBaseURL: undefined, database: undefined, dbUsername: undefined, email: undefined, JWT: undefined};
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      setRemoteState(prevstate => ({...prevstate,dbCreds: credsObj, credsStatus: CredsStatus.loaded}))
    }
    if (credsObj == null || (credsObj as any).baseURL == undefined) {
        setRemoteState(prevstate => ({...prevstate, dbCreds: {
            apiServerURL: DEFAULT_API_URL,
            couchBaseURL: DEFAULT_DB_URL_PREFIX,
            database: DEFAULT_DB_NAME,
            dbUsername:"",
            JWT:"",
            email: ""
        }, credsStatus: CredsStatus.loaded}))
    }
  }

  function submitForm() {
    console.log("In submit form...");
    setPrefsDBCreds();
    console.log("error check creds...", errorCheckCreds());
    if (errorCheckCreds() ) {
      setRemoteState(prevstate => ({...prevstate,formSubmitted: true, connectionStatus: ConnectionStatus.tryIssueToken}))
    } else {
      setRemoteState(prevState => ({...prevState,showLoginForm: true, connectionStatus: ConnectionStatus.cannotStart}))
    } 
  } 

  if (globalState.syncStatus === SyncStatus.active || globalState.syncStatus === SyncStatus.paused) {
    return (<></>)
  }

  if ((remoteState.credsStatus !== CredsStatus.loaded) || (!remoteState.showLoginForm)) return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Logging Into Remote...</IonTitle></IonToolbar></IonHeader></IonPage>
  )
  
  return(
        <IonPage>
            <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton /></IonButtons><IonTitle>
            Login Page
            </IonTitle></IonToolbar></IonHeader>
            <IonContent>
            <IonItem>
            <IonList>
                <IonItem><IonLabel position="stacked">API Server URL</IonLabel>
                <IonInput type="url" inputmode="url" value={remoteState.dbCreds.apiServerURL} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,apiServerURL: String(e.detail.value)}}))}}>
                </IonInput>
                </IonItem>
                <IonItem><IonLabel position="stacked">Database Name</IonLabel>
                <IonInput value={remoteState.dbCreds.database} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,database: String(e.detail.value)}}))}}>
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
                <IonItem><IonLabel position="stacked">Password</IonLabel>
                <IonInput autocomplete="current-password" type="password" value={remoteState.password} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
                </IonInput>
                </IonItem>
                <IonItem>
                  <IonButton onClick={() => submitForm()}>Login</IonButton>
                </IonItem>
                <IonItem>
                  <IonText>{remoteState.formError}</IonText>
                </IonItem>
            </IonList>
            </IonItem>
            </IonContent>

        </IonPage>
    )
}

export default RemoteDBLogin;