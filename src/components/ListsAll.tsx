import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, 
        IonButton, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useFind } from 'use-pouchdb';
import './ListsAll.css';

const ListsAll: React.FC = () => {
  const { docs, loading, error } = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "list", name: { $exists: true } },
    sort: [ "type", "name" ]
  })

  if (loading) { return (<></>) }
  
  return (
        <IonList lines="full">
               {docs.map((doc) => (
                  <IonItem key={(doc as any)._id} >
                    <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
                    <IonButton routerLink={"/list/edit/" + (doc as any)._id} slot="end">
                      Edit
                    </IonButton>
                  </IonItem>  
            ))}
        </IonList>
  );
};

export default ListsAll;
