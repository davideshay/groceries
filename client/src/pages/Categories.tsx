import { IonContent, IonPage, IonList, IonItem, IonFab,
     IonFabButton, IonIcon } from '@ionic/react';
import { useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps } from '../components/DataTypes';
import { CategoryDoc } from '../components/DBSchema';
import './Categories.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName } from '../components/translationUtilities';
import { useGlobalDataStore } from '../components/GlobalData';

const Categories: React.FC<HistoryProps> = (props: HistoryProps) => {
  const error = useGlobalDataStore((state) => state.error);
  const loading = useGlobalDataStore((state) => state.isLoading);
  const categoryDocs = useGlobalDataStore((state) => state.categoryDocs);
  const screenLoading=useRef(true);
  const { t } = useTranslation();

  if (error !== null) { return (
    <ErrorPage errorText={t('error.loading_category_info') as string}></ErrorPage>
  )}

  if (loading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_categories")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  (categoryDocs as CategoryDoc[]).sort(function(a,b) {
    return translatedCategoryName(a._id,a.name).toLocaleUpperCase().localeCompare(translatedCategoryName(b._id,b.name).toLocaleUpperCase())
  })

  return (
    <IonPage>
      <PageHeader title={t("general.categories")} />
      <IonContent>
        <IonList className="ion-no-padding" lines="full">
               {(categoryDocs as CategoryDoc[]).map((doc) => (
                  <IonItem className="list-button" key={doc._id} routerLink={("/category/edit/" + doc._id)}>
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
