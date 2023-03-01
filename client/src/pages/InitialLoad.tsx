import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, useIonLoading } from '@ionic/react';
import { useContext, useEffect, } from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';

type InitialLoadProps = {
  history : any
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, remoteDBCreds, setConnectionStatus} = useContext(RemoteDBStateContext);
    const [ present,dismiss] = useIonLoading()
    const db=usePouch();
  
    useEffect(() => { 
        if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete)) {
            setConnectionStatus(ConnectionStatus.initialNavComplete);
            navigateToFirstListID(db,props.history,remoteDBCreds);
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
