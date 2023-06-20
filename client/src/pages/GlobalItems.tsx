import { IonContent, IonPage, IonList, IonItem } from '@ionic/react';
import { useContext, useRef } from 'react';
import { HistoryProps} from '../components/DataTypes';
import { GlobalItemDocs } from '../components/DBSchema';
import { useTranslation } from 'react-i18next';
import './GlobalItems.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { translatedItemName } from '../components/translationUtilities';
import { GlobalDataContext } from '../components/GlobalDataProvider';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const GlobalItems: React.FC<HistoryProps> = (props: HistoryProps) => {
  const screenLoading = useRef(true);
  const {globalItemDocs, globalItemsLoading, globalItemError } = useContext(GlobalDataContext)
  const { t } = useTranslation();


  if (globalItemError ) { return (
    <ErrorPage errorText={t("error.loading_global_item") as string}></ErrorPage>
    )}

  if (globalItemsLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_global_items")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }
  
  screenLoading.current = false;

  (globalItemDocs as GlobalItemDocs).sort((a,b) => (
    translatedItemName(a._id!,a.name,a.name,2).toLocaleUpperCase().localeCompare(translatedItemName(b._id!,b.name,b.name,2).toLocaleUpperCase())
  ));

  return (
    <IonPage>
      <PageHeader title={t('general.global_items')} />
      <IonContent>
        <IonList className="ion-no-padding">
          {globalItemDocs.length === 0 ?(<IonItem>{t("error.no_global_items_available")}</IonItem>) : <></> }
          {(globalItemDocs as GlobalItemDocs).map(gi => (
             <IonItem button key={gi._id} className="list-button" routerLink={("/globalitem/edit/" + gi._id)}>{translatedItemName(gi._id!,gi.name,gi.name,2)}</IonItem>
          ))}
        </IonList>  
      </IonContent>
    </IonPage>
  );
};

export default GlobalItems;
