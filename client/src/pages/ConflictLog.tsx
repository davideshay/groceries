import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonLoading } from '@ionic/react';
import { useContext, useRef } from 'react';
import SyncIndicator from '../components/SyncIndicator';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';
import './Categories.css';
import { useConflicts } from '../components/Usehooks';

const ConflictLog: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { setDBCredsValue } = useContext(RemoteDBStateContext);
  const { conflictsError, conflictDocs, conflictsLoading } = useConflicts();
  const screenLoading = useRef(true);

  if (conflictsError) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Error...</IonTitle></IonToolbar></IonHeader>
    <IonContent><IonItem>Error loading Conflict Data ... Restart.</IonItem></IonContent></IonPage>
  )}

  if (conflictsLoading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonContent><IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false}}
                 message="Loading Data..." >
    </IonLoading></IonContent></IonPage>
    )}
  
    screenLoading.current=false;

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
          <IonTitle class="ion-no-padding">Conflict Log</IonTitle>
          <IonButton size="small" slot="end" onClick={() => {setConflictsAsViewed()}}>Set As Viewed</IonButton>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
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
