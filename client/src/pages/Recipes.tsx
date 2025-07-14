import { IonContent, IonPage, IonList, IonItem, IonFab,
     IonFabButton, IonIcon, IonFooter, IonButton } from '@ionic/react';
import { useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps } from '../components/DataTypes';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router';
import { useGlobalDataStore } from '../components/GlobalData';

const Recipes: React.FC<HistoryProps> = () => {
  const screenLoading=useRef(true);
  const { t } = useTranslation();
  const recipeDocs = useGlobalDataStore((state) => state.recipeDocs);
  const isLoading = useGlobalDataStore((state) => state.isLoading);
  const error = useGlobalDataStore((state) => state.error);
  const history = useHistory()

  if (error) { return (
    <ErrorPage errorText={t('error.loading_recipes') as string}></ErrorPage>
  )}

  if (isLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_recipes")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  return (
    <IonPage>
      <PageHeader title={t("general.recipes")} />
      <IonContent>
        <IonList className="ion-no-padding" lines="full">
            {recipeDocs.length === 0 ? <IonItem key="none">{t("error.no_recipes_exist")}</IonItem> : 
               recipeDocs.map((doc) => (
                  <IonItem className="list-button" key={doc._id} routerLink={("/recipe/edit/" + doc._id)}>
                    {doc.name}
                  </IonItem>
            ))}
        </IonList>
      </IonContent>
      <IonFooter>
        <IonButton onClick={() => {history.push('/recipeimport')}}>{t("general.import_new")}</IonButton>
      </IonFooter>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/recipe/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Recipes;
