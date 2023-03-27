import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon, IonLoading} from '@ionic/react';
import { useContext, useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps, ListCombinedRow, RowType } from '../components/DataTypes';
import './ListGroups.css';
import ErrorPage from './ErrorPage';
import Loading  from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { GlobalDataContext } from '../components/GlobalDataProvider';

const ListGroups: React.FC<HistoryProps> = (props: HistoryProps) => {

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
                  (<IonItem key={row.rowKey} >
                    <IonButton slot="start" class="textButton" fill="clear" routerLink={("/listgroup/edit/" + row.listGroupID)}>{row.rowName}</IonButton>
                  </IonItem>))} }
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
