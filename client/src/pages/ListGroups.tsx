import { IonContent,  IonPage,  IonList, IonItem,  
   IonFab, IonFabButton, IonIcon} from '@ionic/react';
import { useContext, useRef } from 'react';
import { add } from 'ionicons/icons';
import { ListCombinedRow, RowType } from '../components/DataTypes';
import './ListGroups.css';
import ErrorPage from './ErrorPage';
import Loading  from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';

const ListGroups: React.FC = () => {
  const { listRowsLoaded, listCombinedRows, listError} = useContext(GlobalDataContext);
  const screenLoading = useRef(false);
  const { t } = useTranslation();

  if (listError) { return(
    <ErrorPage errorText={t("error.loading_listgroups") as string}></ErrorPage>
  )}

  if (!listRowsLoaded) { 
    screenLoading.current = true;
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_listgroups")}  />
//    setIsOpen={() => {screenLoading.current = false}} />
  )}

  screenLoading.current=false;

  return (
    <IonPage>
      <PageHeader title={t('general.listgroups')} />
      <IonContent>
        <IonList lines="full">
               { listCombinedRows.filter((lcr) => (lcr.rowType === RowType.listGroup)).map((row: ListCombinedRow) =>  
                  (<IonItem button className="list-button" key={row.rowKey} routerLink={("/listgroup/edit/" + row.listGroupID)}>{row.rowName}</IonItem>))}
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
