import { IonContent,  IonPage, IonList, IonItem } from '@ionic/react';
import { useRef } from 'react';
import { HistoryProps } from '../components/DataTypes';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )

const ManageData: React.FC<HistoryProps> = () => {
  const screenLoading = useRef(true);
  const { t } = useTranslation();
  
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
