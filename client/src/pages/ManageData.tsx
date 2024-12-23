import { IonContent,  IonPage, IonList, IonItem } from '@ionic/react';
import { useRef } from 'react';
import { useItems } from '../components/Usehooks';
import { HistoryProps, RowType} from '../components/DataTypes';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedItemName } from '../components/translationUtilities';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )

const ManageData: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { dbError: itemError,  itemRowsLoaded, itemRows} = useItems({selectedListGroupID: null, isReady :true, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const screenLoading = useRef(true);
  const { t } = useTranslation();

  if  (itemError) { return (
    <ErrorPage errorText={t("error.loading_item_info_restart") as string} ></ErrorPage>
    )}

  if (itemRowsLoaded ) {
    screenLoading.current = false;
  } else {
    screenLoading.current = true;
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_all_items")} />
//    setIsOpen={() => {screenLoading.current = false}} />
  )}
  
  screenLoading.current = false;

  return (
    <IonPage>
      <PageHeader title={t("general.manage_data")} />
      <IonContent>
        <IonList className="ion-no-padding" lines="full">
          <IonItem routerLink='/listgroups'>{t('general.manage_all_listgroups')}</IonItem>
          <IonItem routerLink="/list/new/new">{t('general.create_new_list')}</IonItem>
          <IonItem routerLink="/categories">{t("general.manage_categories")}</IonItem>
          <IonItem routerLink="/allitems">{t("general.manage_all_items")}</IonItem>
          <IonItem routerLink="/globalitems">{t("general.view_global_items")}</IonItem>
          <IonItem routerLink="/uoms">{t("general.uoms")}</IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};


export default ManageData;
