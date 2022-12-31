import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, NavContext, useIonLoading } from '@ionic/react';
import { useContext, useEffect, useState } from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';    

    
const InitialLoad: React.FC = () => {
    const { remoteDBState, setRemoteDBState, startSync} = useContext(RemoteDBStateContext);
    const [showLoading, setShowLoading] = useState(true);
    const {navigate} = useContext(NavContext);
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
          navigate("lists")
        } else {
          navigate("/items/"+firstListID)
        }  
      }
  
    useEffect(() => { 
        if ((remoteDBState.connectionStatus == ConnectionStatus.loginComplete)) {
            setShowLoading(false);
            dismiss();
            setRemoteDBState({...remoteDBState,connectionStatus: ConnectionStatus.initialNavComplete});
            // should do logic here around navigating to first list
            navigateToFirstListID();
        } else {
            present({message: "Please wait, logging into server...", duration: 500})
        }   
    },[remoteDBState.connectionStatus])   

    useEffect(() => {
        if (remoteDBState.connectionStatus == ConnectionStatus.navToLoginScreen) {
            setRemoteDBState({...remoteDBState,connectionStatus: ConnectionStatus.onLoginScreen});
            navigate("/login");
        }

    },[remoteDBState.connectionStatus])

    return (
        <IonPage>
        <IonHeader><IonToolbar>
        <IonTitle>Loading...</IonTitle>
        </IonToolbar></IonHeader>
    <IonContent>
        
    </IonContent>
    </IonPage>

    )

}

export default InitialLoad;
