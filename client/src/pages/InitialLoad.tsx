import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, useIonLoading } from '@ionic/react';
import { useContext, useEffect, } from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';
import { initialSetupActivities } from '../components/Utilities';

type InitialLoadProps = {
  history : any
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, remoteDBCreds, setConnectionStatus} = useContext(RemoteDBStateContext);
    const [ present,dismiss] = useIonLoading()
    const db=usePouch();
  
    useEffect(() => {
        async function initialStartup() {
            await initialSetupActivities(db as PouchDB.Database, String(remoteDBCreds.dbUsername));
            await navigateToFirstListID(db,props.history,remoteDBCreds);
            setConnectionStatus(ConnectionStatus.initialNavComplete);
        } 
        if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete)) {
            initialStartup();
        } else {
            present({message: "Please wait, logging into server...", duration: 500})
        }   
    },[remoteDBState.connectionStatus])   

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
