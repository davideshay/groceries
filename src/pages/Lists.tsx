import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonMenuButton, IonButtons, IonFab, 
  IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useFind } from 'use-pouchdb';
import './Lists.css';
import ListsAll from '../components/ListsAll'
//import { IToDoList } from '../components/DataTypes';

const Lists: React.FC = () => {

  const { docs, loading, error } = useFind({
  index: {
    fields: ["type","name"]
  },
  selector: {
    type: "list",
    name: { $exists: true }
  },
  sort: [ "type", "name" ]
  })

  if (loading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )}

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Shopping Lists</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <ListsAll separatePage={true} />
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/list/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Lists;
