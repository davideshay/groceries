import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonButton, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useFind } from 'use-pouchdb';
import './Lists.css';
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

  if (loading) { console.log("Loading...")}

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Shopping Lists</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Shopping Lists</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
               {docs.map((doc) => (
                  <IonItem key={(doc as any)._id} routerLink={("/items/" + (doc as any)._id)}>
                    <IonLabel>{(doc as any).name}</IonLabel>
                    <IonButton href="/categories" slot="end"></IonButton>
                  </IonItem>  
            ))}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Lists;
