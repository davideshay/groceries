import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon, IonLoading} from '@ionic/react';
import { useRef } from 'react';
import { add } from 'ionicons/icons';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps, ListCombinedRow, RowType } from '../components/DataTypes';
import './ListGroups.css';
import { useLists } from '../components/Usehooks';

const ListGroups: React.FC<HistoryProps> = (props: HistoryProps) => {

  const { listRowsLoaded, listCombinedRows} = useLists();
  const screenLoading = useRef(true);

  if (!listRowsLoaded) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent>
    <IonLoading isOpen={screenLoading.current} onDidDismiss={()=>{screenLoading.current=false}}
      message="Loading List Data..."></IonLoading>
    </IonContent></IonPage>
  )}

  screenLoading.current=false;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>List Groups</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
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
