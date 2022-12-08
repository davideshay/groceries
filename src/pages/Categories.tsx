import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useFind } from 'use-pouchdb';
import './Categories.css';

const Categories: React.FC = () => {

  const { docs, loading, error } = useFind({
  index: {
    fields: ["type","name"]
  },
  selector: {
    type: "category",
    name: { $exists: true }
  },
  sort: [ "type", "name" ]
  })

  if (loading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )}

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Categories</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Categories</IonTitle>
          </IonToolbar>
        </IonHeader>
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
