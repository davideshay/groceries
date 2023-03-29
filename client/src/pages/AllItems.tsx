import { IonContent,  IonPage, IonList, IonItem, IonButton  } from '@ionic/react';
import { useRef } from 'react';
import { useItems } from '../components/Usehooks';
import { HistoryProps, RowType} from '../components/DataTypes';
import { ItemDoc } from '../components/DBSchema';
import './AllItems.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const AllItems: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { dbError: itemError,  itemRowsLoaded, itemRows} = useItems({selectedListGroupID: null, isReady :true, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const screenLoading = useRef(true);

  if  (itemError) { return (
    <ErrorPage errorText="Error Loading Item Information... Restart."></ErrorPage>
    )}

  if (itemRowsLoaded ) {
    screenLoading.current = false;
  } else {
    screenLoading.current = true;
    return ( <Loading isOpen={screenLoading.current} message="Loading All Items" />
//    setIsOpen={() => {screenLoading.current = false}} />
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
      <PageHeader title="All Items" />
      <IonContent>
        {gotARow ? (<IonList lines="full">{itemsElem}</IonList>) : (<IonList><IonItem>No Items Available</IonItem></IonList>) }
      </IonContent>
    </IonPage>
  );
};

export default AllItems;
