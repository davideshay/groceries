import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonMenuButton, IonButtons, IonFab, 
  IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import './Lists.css';
import ListsAll from '../components/ListsAll'
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps } from '../components/DataTypes';

const Lists: React.FC<HistoryProps> = (props: HistoryProps) => {

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Shopping Lists</IonTitle>
          <SyncIndicator history={props.history}/>
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
