import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonLoading, NavContext, IonText } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { CapacitorCookies, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { usePouch, useFind } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import { DBCreds } from '../components/DataTypes';
import { Preferences } from '@capacitor/preferences';
import { isJsonString, DEFAULT_DB_NAME, DEFAULT_DB_URL_PREFIX } from '../components/Utilities'; 
import { GlobalStateContext, SyncStatus } from '../components/GlobalState';

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
  cookieNeedsSet = 1,
  cookieSet = 2,
  checkingCookie = 3,
  cookieResponseFound = 4,
  cookieInvalid = 5,
  cookieValid = 6,
  tryPasswordLogin = 7,
  checkingPasswordLogin = 8,
  passwordResponseFound = 9,
  remoteDBNeedsAssigned = 10,
  remoteDBAssigned = 11,
  attemptToSync = 12,
  loginComplete = 13
}

const RemoteDBLogin: React.FC = () => {

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>({
      dbCreds: {baseURL: undefined, database: undefined, dbUsername: undefined, email: undefined, authCookie: undefined},
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
      const regex = new RegExp('(https?://)?([\\da-z.-]+)\\.([a-z.]{2,6})[/\\w .-]*/?');    
      return regex.test(url);
    };

    function emailPatternValidation(email: string) {
      const emailRegex=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      return emailRegex.test(email);
    };

    function errorCheckCreds() {
      if ((remoteState.dbCreds.authCookie == undefined || remoteState.dbCreds.authCookie == "") && (!remoteState.loginByPassword)) {
        setRemoteState(prevState => ({...prevState,formError: "No existing credentials found"}));
        return false;
      }
      if (remoteState.dbCreds.baseURL == undefined || remoteState.dbCreds.baseURL == "") {
        setRemoteState(prevState => ({...prevState,formError: "No Base URL entered"}));
        return false;
      }
      if (!urlPatternValidation(remoteState.dbCreds.baseURL)) {
        setRemoteState(prevState => ({...prevState,formError: "Invalid database URL"}));
        return false;
      }
      if (remoteState.dbCreds.baseURL.endsWith("/")) {
        setRemoteState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,baseURL: prevState.dbCreds.baseURL?.slice(0,-1)}}))
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
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.cookieNeedsSet}))
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.cookieInvalid, showLoginForm: true, loginByPassword: true}))
        }
      }
    },[remoteState.credsStatus])

    const setCapacitorCookie = async () => {
      await CapacitorCookies.setCookie({
        url: remoteState.dbCreds.baseURL,
        key: 'AuthSession',
        value: String(remoteState.dbCreds.authCookie),
      });
      setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.cookieSet}))
    };

    useEffect( () => {
      if (remoteState.connectionStatus == ConnectionStatus.cookieNeedsSet) {
        setCapacitorCookie();
      }

    },[remoteState.connectionStatus])

    useEffect( () => {
      let response: HttpResponse | undefined;
      const checkCookies = async () => {
        const options = {
          url: String(remoteState.dbCreds.baseURL+"/_session"),
          method: "GET",
          headers: { 'Content-Type': 'application/json',
                     'Accept': 'application/json',
                     'SameSite': 'None' },
          webFetchExtra: { credentials: "include" as RequestCredentials, },
        };
        console.log("about to execute httpget with options: ", {options})
        response = await CapacitorHttp.get(options);
        console.log("got httpget response: ",{response});
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.cookieResponseFound,
                     httpResponse: response}))
      }
      if (remoteState.connectionStatus === ConnectionStatus.cookieSet) {
        checkCookies();
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.checkingCookie}));
      }
    },[remoteState.connectionStatus])

    useEffect( () => {
      if (remoteState.connectionStatus === ConnectionStatus.cookieResponseFound) {
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse.data?.userCtx?.name != null)) {
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.attemptToSync}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.cookieInvalid,showLoginForm: true, formError: "Invalid Authentication provided"}));
        }
      }
    },[remoteState.connectionStatus])

    useEffect( () => {
      let response: HttpResponse | undefined;
      const checkPasswordLogin = async () => {
        const options = {
          url: String(remoteState.dbCreds.baseURL+"/_session"),
          method: "POST",
          headers: { 'Content-Type': 'application/json',
                     'Accept': 'application/json',
                     'SameSite': 'None' },
          data: { username: remoteState.dbCreds.dbUsername,
                  password: remoteState.password},           
          webFetchExtra: { credentials: "include" as RequestCredentials, },
        };
        console.log("about to execute httpget with options: ", {options})
        response = await CapacitorHttp.post(options);
        console.log("got httpget response: ",{response});
        let myCookies = await CapacitorCookies.getCookies()
        console.log("Ma cookies: ",myCookies);
        console.log("doc cookies: ", document.cookie);
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.passwordResponseFound,
                httpResponse: response}))
      }
      if (remoteState.connectionStatus === ConnectionStatus.tryPasswordLogin) {
        console.log("trying password login");
        checkPasswordLogin();
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.checkingPasswordLogin}));
      }

    },[remoteState.connectionStatus])

    useEffect( () => {
      if (remoteState.connectionStatus === ConnectionStatus.passwordResponseFound) {
        console.log("password response found: ", {remoteState})
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse.data?.name != null)) {
          console.log("add code here to set the cookie in localstorage");
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.cookieInvalid,showLoginForm: true, formError: "Invalid Authentication provided"}));
        }
      }
    },[remoteState.connectionStatus])

    useEffect(() => {
      if (remoteState.credsStatus === CredsStatus.loaded) {
        if (remoteState.dbCreds.authCookie == undefined || 
            remoteState.dbCreds.authCookie == "") {
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
        setRemoteDB(new PouchDB(remoteState.dbCreds.baseURL+"/"+remoteState.dbCreds.database, 
        { fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include'}) }));
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
    let credsObj: DBCreds = {baseURL: undefined, database: undefined, dbUsername: undefined, email: undefined, authCookie: undefined};
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      setRemoteState(prevstate => ({...prevstate,dbCreds: credsObj, credsStatus: CredsStatus.loaded}))
    }
    if (credsObj == null || (credsObj as any).baseURL == undefined) {
        setRemoteState(prevstate => ({...prevstate, dbCreds: {
            baseURL: DEFAULT_DB_URL_PREFIX,
            database: DEFAULT_DB_NAME,
            dbUsername:"",
            authCookie:"",
            email: ""
        }, credsStatus: CredsStatus.loaded}))
    }
  }

  function submitForm() {
    console.log("In submit form...");
    setPrefsDBCreds();
    console.log("error check creds...", errorCheckCreds());
    if (errorCheckCreds() ) {
      setRemoteState(prevstate => ({...prevstate,formSubmitted: true, connectionStatus: ConnectionStatus.tryPasswordLogin}))
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
                <IonItem><IonLabel position="stacked">Base URL</IonLabel>
                <IonInput type="url" inputmode="url" value={remoteState.dbCreds.baseURL} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,baseURL: String(e.detail.value)}}))}}>
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