import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { useContext } from 'react';
import { useFind } from 'use-pouchdb';
import SyncIndicator from '../components/SyncIndicator';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import './Categories.css';
import { useConflicts } from '../components/Usehooks';

const ConflictLog: React.FC = () => {
  const { remoteDBState,setDBCredsValue } = useContext(RemoteDBStateContext);
  const { conflictDocs, conflictsLoading } = useConflicts();
  
  if (conflictsLoading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )}

  function setConflictsAsViewed() {
    const curDateStr = (new Date()).toISOString();
    console.log("setting to ",curDateStr);
    setDBCredsValue("lastConflictsViewed",curDateStr);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Conflict Log</IonTitle>
          <IonButton slot="end" onClick={() => {setConflictsAsViewed()}}>Set As Viewed</IonButton>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList lines="full">
               {conflictDocs.map((doc: any) => (
                  <IonItem key={doc._id} >
                    <IonButton slot="start" class="textButton" fill="clear" routerLink={("/conflictitem/" + doc._id)}>{doc.docType} {doc.updatedAt}</IonButton>
                  </IonItem>  
            ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ConflictLog;
