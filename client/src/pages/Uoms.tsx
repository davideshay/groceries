import { IonContent, IonPage, IonList, IonItem, IonFab,
     IonFabButton, IonIcon } from '@ionic/react';
import { useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps } from '../components/DataTypes';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedUOMName } from '../components/translationUtilities';
import { useGlobalDataStore } from '../components/GlobalData';

const Uoms: React.FC<HistoryProps> = () => {
  const error = useGlobalDataStore((state) => state.error);
  const isLoading = useGlobalDataStore((state) => state.isLoading);
  const uomDocs = useGlobalDataStore((state) => state.uomDocs);
  const screenLoading=useRef(true);
  const { t } = useTranslation();

  if (error) { return (
    <ErrorPage errorText={t('error.loading_uom_info') as string}></ErrorPage>
  )}

  if (isLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_uoms")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  return (
    <IonPage>
      <PageHeader title={t("general.uoms")} />
      <IonContent>
        <IonList lines="full" className="ion-no-padding">
               {(uomDocs).map((doc) => (
                  <IonItem className="list-button" key={doc._id} routerLink={("/uom/edit/" + doc._id)}>
                    {translatedUOMName(doc._id as string,doc.description,doc.pluralDescription)}
                  </IonItem>
            ))}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/uom/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Uoms;
