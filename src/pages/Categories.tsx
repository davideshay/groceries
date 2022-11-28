import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import './Categories.css';

const Categories: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Category Editor : Acme</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Aisle Editor: Acme</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
          <IonItem href="#">
            <IonLabel>Bakery</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Produce</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Dairy</IonLabel>
          </IonItem>
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

export default Categories;
