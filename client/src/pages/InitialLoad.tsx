import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, NavContext, useIonLoading } from '@ionic/react';
import { useContext, useEffect, useState } from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';
import { App as CapacitorApp } from '@capacitor/app';    

type InitialLoadProps = {
  history : any
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, setRemoteDBState, setConnectionStatus} = useContext(RemoteDBStateContext);
    const [present,dismiss] = useIonLoading();
    const db=usePouch();
    
    async function navigateToFirstListID() {
        let listResults = await db.find({
            selector: { "$and": [ 
              {  "type": "list",
                  "name": { "$exists": true } },
              { "$or" : [{"listOwner": remoteDBState.dbCreds.dbUsername},
                          {"sharedWith": { $elemMatch: {$eq: remoteDBState.dbCreds.dbUsername}}}]
              }] },
            sort: [ "type","name"]})
        let firstListID = null;
        if (listResults.docs.length > 0) {
          firstListID = listResults.docs[0]._id;
        }
        if (firstListID == null) {
            props.history.push("/lists");
        } else {
            props.history.push("/items/"+firstListID)
        }  
      }
  
    useEffect(() => { 
        if ((remoteDBState.connectionStatus == ConnectionStatus.loginComplete)) {
            dismiss();
            setConnectionStatus(ConnectionStatus.initialNavComplete);
            navigateToFirstListID();
        } else {
            present({message: "Please wait, logging into server...", duration: 500})
        }   
    },[remoteDBState.connectionStatus])   

    useEffect(() => {
        if (remoteDBState.connectionStatus == ConnectionStatus.navToLoginScreen) {
            setConnectionStatus(ConnectionStatus.onLoginScreen);
            props.history.push("/login");
        }

    },[remoteDBState.connectionStatus])

    return (
        <IonPage>
        <IonHeader><IonToolbar>
        <IonTitle id="initialloadtitle">Loading...</IonTitle>
        </IonToolbar></IonHeader>
    <IonContent>
        
    </IonContent>
    </IonPage>

    )

}

export default InitialLoad;
