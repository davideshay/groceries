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
import { translatedUOMName } from '../components/translationUtilities';

const Uoms: React.FC<HistoryProps> = (props: HistoryProps) => {
  const globalData = useContext(GlobalDataContext);
  const screenLoading=useRef(true);
  const { t } = useTranslation();

  if (globalData.uomError !== null) { return (
    <ErrorPage errorText={t('error.loading_uom_info') as string}></ErrorPage>
  )}

  if (globalData.uomLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_uoms")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  return (
    <IonPage>
      <PageHeader title={t("general.uoms")} />
      <IonContent>
        <IonList lines="full">
               {(globalData.uomDocs).map((doc) => (
                  <IonItem class="list-button" key={doc._id} routerLink={("/uom/edit/" + doc._id)}>
                    {translatedUOMName(doc._id as string,doc.description)}
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
