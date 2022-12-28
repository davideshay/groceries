import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { useContext } from 'react';
import { useFind } from 'use-pouchdb';
import SyncIndicator from '../components/SyncIndicator';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import './Categories.css';

const ConflictLog: React.FC = () => {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const oneDayOldDate=new Date();
  oneDayOldDate.setDate(oneDayOldDate.getDate()-5);
  const lastConflictsViewed = new Date(String(remoteDBState.dbCreds.lastConflictsViewed))
  const mostRecentDate = (lastConflictsViewed > oneDayOldDate) ? lastConflictsViewed : oneDayOldDate;
  console.log({oneDayOldDate,lastConflictsViewed,mostRecentDate});
  const { docs, loading, error } = useFind({
  index: { fields: ["type","docType","updatedAt"]},
  selector: { type: "conflictlog", docType: { $exists: true }, updatedAt: { $gt: mostRecentDate.toISOString()} },
  sort: [ "type", "docType","updatedAt" ]
  })
  
  if (loading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )}

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Conflict Log</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList lines="full">
               {docs.map((doc: any) => (
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
