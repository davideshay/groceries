import { IonContent,  IonPage, IonList, IonItem } from '@ionic/react';
import { useRef } from 'react';
import { useItems } from '../components/Usehooks';
import { HistoryProps, RowType} from '../components/DataTypes';
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

  return (
    <IonPage>
      <PageHeader title="All Items" />
      <IonContent>
        {itemRows.length === 0 ? (<IonList><IonItem>No Items Available</IonItem></IonList>) : <></> }
        {itemRows.map(ir => (
          <IonItem button key={ir._id} class="list-button" routerLink={("/item/edit/" + ir._id)}>{ir.name}</IonItem>
        ))}
      </IonContent>
    </IonPage>
  );
};

export default AllItems;
