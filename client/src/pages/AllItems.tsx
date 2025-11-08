import { IonContent,  IonPage, IonList, IonItem } from '@ionic/react';
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

const AllItems: React.FC<HistoryProps> = () => {
  const { dbError: itemError,  itemRowsLoaded, itemRows} = useItems({selectedListGroupID: null, isReady :true, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const { t } = useTranslation();

  if  (itemError) { return (
    <ErrorPage errorText={t("error.loading_item_info_restart") as string} ></ErrorPage>
    )}

  if (!itemRowsLoaded ) {
    return ( <Loading isOpen={!itemRowsLoaded} message={t("general.loading_all_items")} />
  )}
  
  return (
    <IonPage>
      <PageHeader title={t("general.all_items")} />
      <IonContent>
        <IonList className="ion-no-padding" lines="full">
        {itemRows.length === 0 ? (<IonList><IonItem>{t("error.no_items_available")}</IonItem></IonList>) : <></> }
        {itemRows.map(ir => (
          <IonItem key={ir._id} className="list-button" routerLink={("/item/edit/" + ir._id)}>{translatedItemName(ir.globalItemID,ir.name,ir.pluralName,2)}</IonItem>
        ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default AllItems;
