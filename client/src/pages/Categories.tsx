import { IonContent, IonPage, IonList, IonItem, IonFab,
     IonFabButton, IonIcon } from '@ionic/react';
import { useContext, useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps } from '../components/DataTypes';
import { CategoryDoc } from '../components/DBSchema';
import './Categories.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName } from '../components/translationUtilities';

const Categories: React.FC<HistoryProps> = (props: HistoryProps) => {
  const globalData = useContext(GlobalDataContext);
  const screenLoading=useRef(true);
  const { t } = useTranslation();

  if (globalData.categoryError !== null) { return (
    <ErrorPage errorText={t('error.loading_category_info') as string}></ErrorPage>
  )}

  if (globalData.categoryLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_categories")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  (globalData.categoryDocs as CategoryDoc[]).sort(function(a,b) {
    return translatedCategoryName(a._id,a.name).toLocaleUpperCase().localeCompare(translatedCategoryName(b._id,b.name).toLocaleUpperCase())
  })

  return (
    <IonPage>
      <PageHeader title={t("general.categories")} />
      <IonContent>
        <IonList lines="full">
               {(globalData.categoryDocs as CategoryDoc[]).map((doc) => (
                  <IonItem class="list-button" key={doc._id} routerLink={("/category/edit/" + doc._id)}>
                    {translatedCategoryName(doc._id as string,doc.name)}
                  </IonItem>
            ))}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/category/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Categories;
