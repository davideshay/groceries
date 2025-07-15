import { IonContent, IonPage,IonButton, IonList, IonInput, 
  IonItem, IonFooter, NavContext, IonIcon,
  } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useContext, useRef } from 'react';
import { useGetOneDoc } from '../components/Usehooks';
import {  HistoryProps} from '../components/DataTypes';
import { CategoryDoc, GlobalItemDoc, UomDoc } from '../components/DBSchema';
import { closeCircleOutline} from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName, translatedItemName, translatedUOMName } from '../components/translationUtilities';
import { useGlobalDataStore } from '../components/GlobalData';

const GlobalItem: React.FC<HistoryProps> = () => {
  const { id: routeID } = useParams<{mode: string, id: string}>();
  const { doc: globalItemDoc, loading: globalItemLoading, dbError: globalItemError} = useGetOneDoc(routeID);
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const { t } = useTranslation();
  const error = useGlobalDataStore((state) => state.error);
  const isLoading = useGlobalDataStore((state) => state.isLoading);
  const uomDocs = useGlobalDataStore((state) => state.uomDocs);
  const categoryDocs = useGlobalDataStore((state) => state.categoryDocs);

  if ( globalItemError || error) { return (
    <ErrorPage errorText={t("error.loading_global_item") as string}></ErrorPage>
    )};

  if ( globalItemLoading || isLoading)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_global_item")}    /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
};
  
  screenLoading.current=false;
  const curUOMItem : UomDoc | undefined = (uomDocs as UomDoc[]).find((uom) => (uom.listGroupID=== "system" && uom.name === globalItemDoc.defaultUOM));
  const curUOM = (curUOMItem === undefined) ? t("general.undefined")  :  translatedUOMName(curUOMItem._id as string ,curUOMItem.description, curUOMItem.pluralDescription);
  const curCategoryItem : CategoryDoc | undefined = (categoryDocs as CategoryDoc[]).find((cat) => (cat._id === globalItemDoc.defaultCategoryID));
  const curCategory = (curCategoryItem === undefined) ? t("general.undefined") : translatedCategoryName(curCategoryItem._id,curCategoryItem.name)       ;

  return (
    <IonPage>
      <PageHeader title={t("general.viewing_global_item")+ " " + translatedItemName((globalItemDoc as GlobalItemDoc)._id!, globalItemDoc.name,globalItemDoc.name) } />
      <IonContent>
          <IonList className="ion-no-padding">
            <IonItem key="name">
              <IonInput disabled={true} label={t("general.name") as string} labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string} value={translatedItemName((globalItemDoc as GlobalItemDoc)._id!, globalItemDoc.name,globalItemDoc.name)}></IonInput>
            </IonItem>
            <IonItem key="cat">
              <IonInput disabled={true} label={t("general.default_category") as string} labelPlacement="stacked" value={curCategory}></IonInput>
            </IonItem>
            <IonItem key="uom">
              <IonInput disabled={true} label={t("general.default_uom") as string} labelPlacement="stacked" value={curUOM}></IonInput>
            </IonItem>
          </IonList>
          <IonButton className="ion-float-right" fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.go_back")}</IonButton>
      </IonContent>
      <IonFooter>
      </IonFooter>
    </IonPage>
  );
};

export default GlobalItem;
