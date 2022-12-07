import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption, NavContext } from '@ionic/react';
import { useState, useEffect, useContext, useRef } from 'react';
import { usePouch, useFind } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import { DBCreds } from '../components/DataTypes';
import { Preferences } from '@capacitor/preferences';
import { isJsonString, DEFAULT_DB_NAME, DEFAULT_DB_URL_PREFIX } from '../components/Utilities'; 
import { GlobalStateContext, SyncStatus } from '../components/GlobalState';

type RemoteState = {
  dbCreds: DBCreds,
  credsStatus: CredsStatus,
  connectionStatus: ConnectionStatus,
  syncStatus: SyncStatus,
  showLoginForm: boolean
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
  remoteDBNeedsAssigned = 1,
  remoteDBAssigned = 2,
  attemptToSync = 3,
  loginComplete = 4
}

const RemoteDBLogin: React.FC = () => {

    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>({
      dbCreds: {baseURL: undefined, database: undefined, username: undefined, password: undefined},
      credsStatus: CredsStatus.needLoaded,
      connectionStatus: ConnectionStatus.cannotStart,
      syncStatus: SyncStatus.init,
      showLoginForm: false,
      formSubmitted: false,
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
      console.log("in dbCreds use effect,", {remoteState})
      if (remoteState.credsStatus === CredsStatus.needLoaded) {
        getPrefsDBCreds();
      } 
    },[remoteState.credsStatus])

    useEffect(() => {
      console.log({listDocs, listLoading, remoteState});
      if (!remoteState.gotListID && !listLoading && listDocs.length > 0) {
        console.log("updating firstlistid");
        setRemoteState(prevstate => ({...remoteState,firstListID: listDocs[0]._id, gotListID: true}));
      }

    },[listDocs, listLoading])

    useEffect(() => {
      if (remoteState.credsStatus == CredsStatus.loaded) {
        if (remoteState.dbCreds.baseURL == undefined || 
            remoteState.dbCreds.database == undefined || 
            remoteState.dbCreds.username == "" ||
            remoteState.dbCreds.password == "") {
              setRemoteState(prevstate => ({...prevstate,showLoginForm: true}));
            }
         else {
            setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}))
         }   
      }
    },[remoteState.credsStatus])

    useEffect(() => {
      // assign effect
      if (remoteDB == null && (remoteState.connectionStatus == ConnectionStatus.remoteDBNeedsAssigned)) {
        console.log("assigning remotedb to new pouchdb instace");
        setRemoteDB(new PouchDB(remoteState.dbCreds.baseURL+"/"+remoteState.dbCreds.database, {
         auth: {username: remoteState.dbCreds.username, password: remoteState.dbCreds.password}}));
        setRemoteState(prevstate => ({...prevstate,connectionStatus: ConnectionStatus.attemptToSync}));
      }
    }, [db,remoteDB,remoteState.connectionStatus])


    useEffect(() => {
      // sync effect
      console.log("connection status:",remoteState.connectionStatus);
      console.log("sync status:", globalState.syncStatus)
      if (remoteDB != null && (remoteState.connectionStatus == ConnectionStatus.attemptToSync)) {
        console.log("about to sync");

        const sync = db.sync(remoteDB, {
          retry: true,
          live: true,
        }).on('paused', () => { setStateInfo("syncStatus", SyncStatus.paused)})
          .on('active', () => { setStateInfo("syncStatus", SyncStatus.active)})
          .on('denied', () => { setStateInfo("syncStatus", SyncStatus.denied)})
          .on('error', () => { console.log ("error state") ; 
                            setStateInfo("syncStatus", SyncStatus.error)})
        
        console.log("sync variable assigned:", sync);
        return () => {
          // and cancel syncing whenever our sessionState changes
          console.log("should I cancel sync here?");
          // sync.cancel()
        }
      }
    }, [db,remoteDB,remoteState.connectionStatus])

    useEffect(() => {
      if ((globalState.syncStatus == SyncStatus.active || globalState.syncStatus == SyncStatus.paused) && (remoteState.connectionStatus != ConnectionStatus.loginComplete) && (remoteState.gotListID)) {
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
    console.log("retrieved credsStr, ",credsStr);
    let credsObj: DBCreds = {baseURL: undefined, database: undefined, username: undefined, password: undefined};
    console.log("isJsonString:", isJsonString(String(credsStr)));
    if (isJsonString(String(credsStr))) {
      credsObj=JSON.parse(String(credsStr));
      setRemoteState(prevstate => ({...prevstate,dbCreds: credsObj, credsStatus: CredsStatus.loaded}))
    }
    console.log("retrieved credsObj:",credsObj)
    if (credsObj == null || (credsObj as any).baseURL == undefined) {
        setRemoteState(prevstate => ({...prevstate, dbCreds: {
            baseURL: DEFAULT_DB_URL_PREFIX,
            database: DEFAULT_DB_NAME,
            username:"",
            password:"",
        }, credsStatus: CredsStatus.loaded}))
    }
  }

  function submitForm() {
    setPrefsDBCreds();
    setRemoteState(prevstate => ({...prevstate,formSubmitted: true, connectionStatus: ConnectionStatus.remoteDBNeedsAssigned}))
  } 

  if (globalState.syncStatus == SyncStatus.active || globalState.syncStatus == SyncStatus.paused) {
    return (<></>)
  }

  if ((remoteState.credsStatus != CredsStatus.loaded) || (!remoteState.showLoginForm)) return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading on the login page...</IonTitle></IonToolbar></IonHeader></IonPage>
  )
  
  return(
        <IonPage>
            <IonHeader><IonToolbar><IonTitle>
            Login Page
            </IonTitle></IonToolbar></IonHeader>
            <IonContent>
            <IonItem>
            <IonList>
                <IonItem><IonLabel>Base URL</IonLabel>
                <IonInput value={remoteState.dbCreds.baseURL} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,baseURL: String(e.detail.value)}}))}}>
                </IonInput>
                </IonItem>
                <IonItem><IonLabel>Database Name</IonLabel>
                <IonInput value={remoteState.dbCreds.database} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,database: String(e.detail.value)}}))}}>
                </IonInput>
                </IonItem>
                <IonItem><IonLabel>Username</IonLabel>
                <IonInput value={remoteState.dbCreds.username} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,username: String(e.detail.value)}}))}}>
                </IonInput>
                </IonItem>
                <IonItem><IonLabel>Password</IonLabel>
                <IonInput value={remoteState.dbCreds.password} onIonChange={(e) => {setRemoteState(prevstate => ({...prevstate, dbCreds: {...prevstate.dbCreds,password: String(e.detail.value)}}))}}>
                </IonInput>
                </IonItem>
                <IonItem>
                  <IonButton onClick={() => submitForm()}>Login</IonButton>
                </IonItem>
            </IonList>
            </IonItem>
            </IonContent>

        </IonPage>
    )
}

export default RemoteDBLogin;