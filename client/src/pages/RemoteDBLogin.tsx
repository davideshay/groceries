import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonLoading, NavContext, IonText, IonTextarea, IonItemDivider } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { usePouch, useFind } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import { DBCreds } from '../components/DataTypes';
import { Preferences } from '@capacitor/preferences';
import { isJsonString, DEFAULT_DB_NAME, DEFAULT_DB_URL_PREFIX, DEFAULT_API_URL } from '../components/Utilities'; 
import { GlobalStateContext, SyncStatus } from '../components/GlobalState';
import { createNewUser, RemoteState, CredsStatus, ConnectionStatus } from '../components/RemoteUtilities';
import { cloneDeep, pick } from 'lodash';

const RemoteDBLogin: React.FC = () => {

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>({
      dbCreds: {apiServerURL: undefined ,couchBaseURL: undefined, database: undefined, dbUsername: undefined, email: undefined, fullName: undefined, JWT: undefined},
      password: undefined,
      credsStatus: CredsStatus.needLoaded,
      connectionStatus: ConnectionStatus.cannotStart,
      httpResponse: undefined,
      showLoginForm: false,
      loginByPassword: false,
      createNewUser: false,
      formSubmitted: false,
      formError: "",
      firstListID: null,
      gotListID: false
    });
    const [remoteDB, setRemoteDB]=useState<any>();

    const {navigate} = useContext(NavContext);
    const { globalState, setGlobalState, setStateInfo} = useContext(GlobalStateContext);

    const { docs: listDocs, loading: listLoading, error: listError } = useFind({
      index: { fields: ["type","name"] },
      selector: { type: "list", name: { $exists: true }},
      sort: [ "type", "name" ]})

    useEffect(() => {
      console.log("cs ",remoteState.connectionStatus);
      if (remoteState.credsStatus === CredsStatus.needLoaded) {
        getPrefsDBCreds();
      } 
    },[remoteState.credsStatus])

    useEffect(() => {
      console.log("cs ",remoteState.connectionStatus);
      if (!remoteState.gotListID && !listLoading)
        if (listDocs.length > 0) {
          setRemoteState(prevstate => ({...remoteState,firstListID: listDocs[0]._id, gotListID: true}));
        } else {
          setRemoteState(prevstate => ({...remoteState,firstListID: null, gotListID: true}));
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
      console.log("Checking creds...", {remoteState});
      setRemoteState(prevState => ({...prevState,formError:""}));
      if ((remoteState.dbCreds.JWT == undefined || remoteState.dbCreds.JWT == "") && (!remoteState.showLoginForm)) {
        setRemoteState(prevState => ({...prevState,formError: "No existing credentials found"}));
        return false;
      }
      if (remoteState.dbCreds.apiServerURL == undefined || remoteState.dbCreds.apiServerURL == "") {
        setRemoteState(prevState => ({...prevState,formError: "No API server URL entered"}));
        return false;
      }
      if ((!remoteState.showLoginForm) && (remoteState.dbCreds.couchBaseURL == undefined || remoteState.dbCreds.couchBaseURL == "")) {
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
        setRemoteState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,apiServerURL: prevState.dbCreds.apiServerURL?.slice(0,-1)}}))
      }
      if (String(remoteState.dbCreds.couchBaseURL).endsWith("/")) {
        setRemoteState(prevState => ({...prevState,dbCreds: {...prevState.dbCreds,couchBaseURL: prevState.dbCreds.couchBaseURL?.slice(0,-1)}}))
      }
      if ((!remoteState.showLoginForm) && (remoteState.dbCreds.database == undefined || remoteState.dbCreds.database == "")) {
        setRemoteState(prevState => ({...prevState,formError: "No database entered"}));
        return false;
      }
      if (remoteState.dbCreds.dbUsername == undefined || remoteState.dbCreds.dbUsername == "") {
        setRemoteState(prevState => ({...prevState,formError: "No database user name entered"}));
        return false;
      }
      if ((remoteState.createNewUser) && (remoteState.dbCreds.email == undefined || remoteState.dbCreds.email == "")) {
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
      return true;
    }

    useEffect( () => {
      console.log("cs ",remoteState.connectionStatus);
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
      console.log("cs ",remoteState.connectionStatus);
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
      console.log("cs ",remoteState.connectionStatus);

      if (remoteState.connectionStatus === ConnectionStatus.JWTResponseFound) {
        console.log("JWTResponse Found", remoteState.httpResponse);
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse.data?.userCtx?.name != null)) {
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid,showLoginForm: true, loginByPassword: true,  formError: "Invalid Authentication provided"}));
        }
      }
    },[remoteState.connectionStatus])

    useEffect( () => {
      console.log("cs ",remoteState.connectionStatus);

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
      newDBCreds.database = remoteState.httpResponse?.data.couchdbDatabase;
      newDBCreds.email = remoteState.httpResponse?.data.email;
      newDBCreds.JWT = remoteState.httpResponse?.data.loginJWT;
      let credsObj = JSON.stringify(newDBCreds);
      console.log("in update DB CredsFromResponse, newcreds:",{newDBCreds});
      Preferences.set({key: 'dbcreds', value: credsObj})
      setRemoteState(prevState => ({...prevState, dbCreds: newDBCreds}))
    }

    useEffect( () => {
      console.log("cs ",remoteState.connectionStatus);

      if (remoteState.connectionStatus === ConnectionStatus.tokenResponseFound) {
        console.log("password response found: ", {remoteState})
        if ((remoteState.httpResponse?.status == 200) && (remoteState.httpResponse?.data?.loginSuccessful)) {
          updateDBCredsFromResponse()
          console.log("updated DB creds, about to set to remoteDBNeedsAssigned");
          setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}));
        } else {
          setRemoteState(prevState => ({...prevState,connectionStatus: ConnectionStatus.JWTInvalid,showLoginForm: true, loginByPassword: true,  formError: "Invalid Authentication provided"}));
        }
      }
    },[remoteState.connectionStatus])

    useEffect(() => {
      console.log("cs ",remoteState.connectionStatus);

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
      console.log("cs ",remoteState.connectionStatus);

      // assign effect
      if (remoteDB == null && (remoteState.connectionStatus === ConnectionStatus.remoteDBNeedsAssigned)) {
        console.log("about to set RemoteDB...");
        setRemoteDB(new PouchDB(remoteState.dbCreds.couchBaseURL+"/"+remoteState.dbCreds.database, 
          { fetch: (url, opts: any) => ( 
               fetch(url, { ...opts, credentials: 'include', headers:
                { ...opts.headers, 'Authorization': 'Bearer '+remoteState.dbCreds.JWT, 'Content-type': 'application/json' }})
                )} ));
        setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.attemptToSync}));
      }
    }, [db,remoteDB,remoteState.connectionStatus])


    useEffect(() => {
      console.log("cs ",remoteState.connectionStatus);

      console.log("remote DB is : ", remoteDB);
      // sync effect
      if (remoteDB !== undefined && (remoteState.connectionStatus === ConnectionStatus.attemptToSync)) {
        console.log("about to create sync link");
        console.log("current creds:",remoteState.dbCreds);
        setPrefsDBCreds();
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
      if (remoteState.connectionStatus == ConnectionStatus.startingCreateUser) {}
    },[remoteState.connectionStatus]);


    useEffect(() => {
      console.log("cs ",remoteState.connectionStatus);
      console.log("gotlistid ",{globalState,remoteState});
      if ((globalState.syncStatus === SyncStatus.active || globalState.syncStatus === SyncStatus.paused) && (remoteState.connectionStatus !== ConnectionStatus.loginComplete) && (remoteState.gotListID)) {
        setRemoteState(prevState => ({...prevState, connectionStatus: ConnectionStatus.loginComplete}))
        setGlobalState({...globalState, dbCreds: remoteState.dbCreds});
        console.log("about to navigate", remoteState.firstListID);
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
    let credsObj: DBCreds = { apiServerURL: undefined ,couchBaseURL: undefined, database: undefined, dbUsername: undefined, email: undefined, fullName: undefined, JWT: undefined};
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUserName','email','fullName','JWT'])
      setRemoteState(prevstate => ({...prevstate,dbCreds: credsObjFiltered, credsStatus: CredsStatus.loaded}))
    }
    if (credsObj == null || (credsObj as any).apiServerURL == undefined) {
        setRemoteState(prevstate => ({...prevstate, dbCreds: {
            apiServerURL: DEFAULT_API_URL,
            couchBaseURL: DEFAULT_DB_URL_PREFIX,
            database: DEFAULT_DB_NAME,
            dbUsername:"",
            JWT:"",
            email: "",
            fullName: ""
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
      setRemoteState(prevState => ({...prevState,showLoginForm: true, loginByPassword: true,  connectionStatus: ConnectionStatus.cannotStart}))
    } 
  }
  
  async function submitCreateForm() {
    console.log("in create form");
    setPrefsDBCreds();
    console.log("error check creds...", errorCheckCreds());
    let createResponse: any;
    if (errorCheckCreds()) {
      console.log("Creds Checked out OK");
      createResponse = await createNewUser(remoteState);
      console.log(createResponse);
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
  

  if (globalState.syncStatus === SyncStatus.active || globalState.syncStatus === SyncStatus.paused) {
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