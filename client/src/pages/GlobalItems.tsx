import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonLoading } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { useRef } from 'react';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps} from '../components/DataTypes';
import { GlobalItemDocs } from '../components/DBSchema';
import { cloneDeep } from 'lodash';

import './GlobalItems.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';

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

  if (globalItemsLoading) { 
    return ( <Loading isOpen={screenLoading.current} message="Loading Categories..."
    setIsOpen={() => {screenLoading.current = false}} /> )
  }
  
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
        {gotARow ? (<IonList lines="full">{itemsElem}</IonList>) :
        (<IonList><IonItem>No Global Items Available</IonItem></IonList>)}
      </IonContent>
    </IonPage>
  );
};

export default GlobalItems;