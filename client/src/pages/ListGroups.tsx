import { IonContent,  IonPage,  IonList, IonItem,  
  IonButton, IonFab, IonFabButton, IonIcon} from '@ionic/react';
import { useContext, useRef } from 'react';
import { add } from 'ionicons/icons';
import { ListCombinedRow, RowType } from '../components/DataTypes';
import './ListGroups.css';
import ErrorPage from './ErrorPage';
import Loading  from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { GlobalDataContext } from '../components/GlobalDataProvider';

const ListGroups: React.FC = () => {

  const { listRowsLoaded, listCombinedRows, listError} = useContext(GlobalDataContext);
  const screenLoading = useRef(false);

  if (listError) { return(
    <ErrorPage errorText="Error Loading List Groups Information... Restart."></ErrorPage>
  )}

  if (!listRowsLoaded) { 
    screenLoading.current = true;
    return ( <Loading isOpen={screenLoading.current} message="Loading List Groups"  />
//    setIsOpen={() => {screenLoading.current = false}} />
  )}

  screenLoading.current=false;

  return (
    <IonPage>
      <PageHeader title="List Groups" />
      <IonContent>
        <IonList lines="full">
               {listCombinedRows.map((row: ListCombinedRow) => { 
                  if (row.rowType === RowType.listGroup) { return (
                  (<IonItem button class="list-button" key={row.rowKey} routerLink={("/listgroup/edit/" + row.listGroupID)}>{row.rowName}</IonItem>))} }
        )}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/listgroup/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default ListGroups;
