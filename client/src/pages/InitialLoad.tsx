import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, useIonLoading } from '@ionic/react';
import { useContext, useEffect, } from 'react';
import { usePouch } from 'use-pouchdb';
import { useLists } from '../components/Usehooks';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';
import { initialSetupActivities } from '../components/Utilities';
import { cloneDeep } from 'lodash';
import { GlobalStateContext } from '../components/GlobalState';

type InitialLoadProps = {
  history : any
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, remoteDBCreds, setConnectionStatus} = useContext(RemoteDBStateContext);
    const [ present,dismiss] = useIonLoading()
    const { listRowsLoaded, listRows } = useLists()
    const db=usePouch();
  
    useEffect(() => {
        async function initialStartup() {
            await initialSetupActivities(db as PouchDB.Database, String(remoteDBCreds.dbUsername));
            await navigateToFirstListID(db,props.history,remoteDBCreds,listRows);
            setConnectionStatus(ConnectionStatus.initialNavComplete);
        }
        if (listRowsLoaded) {
            if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete)) {
                initialStartup();
            } else {
                present({message: "Please wait, logging into server...", duration: 500})
            }
        }      
    },[db, listRows, props.history, remoteDBCreds, remoteDBState.connectionStatus, listRowsLoaded])   

    useEffect(() => {
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) {
            setConnectionStatus(ConnectionStatus.onLoginScreen);
            props.history.push("/login");
        }
    },[remoteDBState.connectionStatus])

    return (
    <IonPage>
        <IonHeader>
            <IonToolbar>
                <IonTitle id="initialloadtitle">Loading...</IonTitle>
            </IonToolbar>
        </IonHeader>
    </IonPage>

    )

}

export default InitialLoad;
