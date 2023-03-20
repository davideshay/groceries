import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonLoading } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { useRef } from 'react';
import { useLists, useItems } from '../components/Usehooks';
import SyncIndicator from '../components/SyncIndicator';
import { GlobalItemDocs, HistoryProps, ItemDoc, ListCombinedRow, ListRow, RowType } from '../components/DataTypes';
import './AllItems.css';
import ErrorPage from './ErrorPage';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const GlobalItems: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { docs: globalItemDocs, loading: globalItemsLoading, error: globalItemsError} = useFind({
    index: { fields: [ "type","name"]},
    selector: { type: "globalitem","name": { $exists: true}}  })

  const screenLoading = useRef(true);


  if (globalItemsError ) { return (
    <ErrorPage errorText="Error Loading Global Item Information... Restart."></ErrorPage>
    )}

  if (globalItemsLoading) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current = false;}}
                message="Loading Data..." />
    <IonContent></IonContent></IonPage>
  )}
  
  screenLoading.current = false;

  let gotARow = false;
  (globalItemDocs as GlobalItemDocs).sort((a,b) => (
    a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase())
  ));
  let itemsElem:any = [];
  (globalItemDocs as GlobalItemDocs).forEach((gi) => {
      gotARow = true;
      itemsElem.push(
        <IonItem key={gi._id} >
          <IonButton slot="start" class="textButton" fill="clear" routerLink={("/globalitem/edit/" + gi._id)}>{gi.name}</IonButton>
        </IonItem>  
      )
  });

  if (!gotARow) return (<IonPage><IonHeader><IonTitle>Global Items</IonTitle></IonHeader>
    <IonContent><IonList><IonItem>No Global Items Available</IonItem></IonList></IonContent></IonPage>)

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle class="ion-no-padding">Global Items</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList lines="full">
          {itemsElem}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default GlobalItems;
