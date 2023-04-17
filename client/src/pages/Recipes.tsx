import { IonContent, IonPage, IonList, IonItem, IonFab,
     IonFabButton, IonIcon } from '@ionic/react';
import { useContext, useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps } from '../components/DataTypes';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { useRecipes } from '../components/Usehooks';

const Recipes: React.FC<HistoryProps> = (props: HistoryProps) => {
  const globalData = useContext(GlobalDataContext);
  const screenLoading=useRef(true);
  const { t } = useTranslation();
  const { recipeDocs, recipesLoading, recipesError} = useRecipes();

  if (recipesError) { return (
    <ErrorPage errorText={t('error.loading_recipes') as string}></ErrorPage>
  )}

  if (recipesLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_recipes")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  return (
    <IonPage>
      <PageHeader title={t("general.recipes")} />
      <IonContent>
        <IonList lines="full">
            {recipeDocs.length === 0 ? <IonItem key="none">{t("error.no_recipes_exist")}</IonItem> : 
               recipeDocs.map((doc) => (
                  <IonItem class="list-button" key={doc._id} routerLink={("/recipe/edit/" + doc._id)}>
                    {doc.name}
                  </IonItem>
            ))}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/recipe/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Recipes;
