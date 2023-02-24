import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useFind } from 'use-pouchdb';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps } from '../components/DataTypes';
import './ListGroups.css';

const ListGroups: React.FC<HistoryProps> = (props: HistoryProps) => {

  const { docs, loading, error } = useFind({
  index: { fields: ["type","name"]},
  selector: { type: "listgroup", name: { $exists: true }},
  sort: [ "type", "name" ]
  })

  if (loading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )}

  docs.sort(function(a: any,b: any) {
    var keyA = a.name.toUpperCase();
    var keyB = b.name.toUpperCase();
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0
  })

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>List Groups</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen id="main">
        <IonList lines="full">
               {docs.map((doc) => (
                  <IonItem key={(doc as any)._id} >
                    <IonButton slot="start" class="textButton" fill="clear" routerLink={("/listgroup/edit/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
                  </IonItem>  
            ))}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/category/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default ListGroups;
