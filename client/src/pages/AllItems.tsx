import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonLoading } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { useRef } from 'react';
import { useLists, useItems } from '../components/Usehooks';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps, ItemDoc, ListCombinedRow, ListRow, RowType } from '../components/DataTypes';
import './AllItems.css';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const AllItems: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { listCombinedRows, listRowsLoaded } = useLists()
  const { itemRowsLoaded, itemRows} = useItems();
  const screenLoading = useRef(true);

  if (!itemRowsLoaded || !listRowsLoaded ) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current = false;}}
                message="Loading Data..." />
    <IonContent></IonContent></IonPage>
  )}
  
  screenLoading.current = false;

  let gotARow = false;
  let itemsElem : any[] = [];
  itemRows.forEach((doc: ItemDoc) => {
      gotARow = true;
      itemsElem.push(
        <IonItem key={doc._id} >
          <IonButton slot="start" class="textButton" fill="clear" routerLink={("/item/edit/" + doc._id)}>{doc.name}</IonButton>
        </IonItem>  
      )
  });

  if (!gotARow) return (<IonPage><IonHeader><IonTitle>All Items</IonTitle></IonHeader>
    <IonContent><IonList><IonItem>No Items Available</IonItem></IonList></IonContent></IonPage>)

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle class="ion-no-padding">All Items</IonTitle>
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

export default AllItems;
