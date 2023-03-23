import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonLoading } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { useRef } from 'react';
import { useLists, useItems } from '../components/Usehooks';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps} from '../components/DataTypes';
import { ItemDoc } from '../components/DBSchema';
import './AllItems.css';
import ErrorPage from './ErrorPage';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const AllItems: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { dbError: listError, listRowsLoaded } = useLists()
  const { dbError: itemError,  itemRowsLoaded, itemRows} = useItems();
  const screenLoading = useRef(true);


  if (listError || itemError) { return (
    <ErrorPage errorText="Error Loading Item Information... Restart."></ErrorPage>
    )}

  if (!itemRowsLoaded || !listRowsLoaded ) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current = false;}}
                message="Loading Data..." />
    <IonContent></IonContent></IonPage>
  )}
  
  screenLoading.current = false;

  let gotARow = false;
  let itemsElem: any = [];
  itemRows.forEach((doc: ItemDoc) => {
      gotARow = true;
      itemsElem.push(
        <IonItem key={doc._id} >
          <IonButton slot="start" class="textButton" fill="clear" routerLink={("/item/edit/" + doc._id)}>{doc.name}</IonButton>
        </IonItem>  
      )
  });

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
        {gotARow ? (<IonList lines="full">{itemsElem}</IonList>) : (<IonList><IonItem>No Items Available</IonItem></IonList>) }
      </IonContent>
    </IonPage>
  );
};

export default AllItems;
