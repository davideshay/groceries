import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon, IonLoading } from '@ionic/react';
import { useRef } from 'react';
import { add } from 'ionicons/icons';
import { useFind } from 'use-pouchdb';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps } from '../components/DataTypes';
import './Categories.css';

const Categories: React.FC<HistoryProps> = (props: HistoryProps) => {

  const { docs, loading, error } = useFind({
    index: { fields: ["type","name"]},
    selector: { type: "category", name: { $exists: true }},
    sort: [ "type", "name" ]
  })
  const screenLoading=useRef(true);

  if (loading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonContent><IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false;}}
                            message="Loading Data..."></IonLoading>
    </IonContent></IonPage>
  )}

  screenLoading.current=false;

  docs.sort(function(a: any,b: any) {
    return a.name.toUpperCase().localeCompare(b.name.toUpperCase())
  })

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle class="ion-no-padding">Categories</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList lines="full">
               {docs.map((doc) => (
                  <IonItem key={(doc as any)._id} >
                    <IonButton slot="start" class="textButton" fill="clear" routerLink={("/category/edit/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
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

export default Categories;
