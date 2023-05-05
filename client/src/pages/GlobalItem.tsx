import { IonContent, IonPage,IonButton, IonList, IonInput, 
  IonItem, IonFooter, NavContext, IonIcon,
  } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useContext, useRef } from 'react';
import { useGetOneDoc } from '../components/Usehooks';
import './Category.css';
import {  HistoryProps} from '../components/DataTypes';
import { CategoryDoc, GlobalItemDoc, UomDoc } from '../components/DBSchema';
import { closeCircleOutline} from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName, translatedItemName, translatedUOMName } from '../components/translationUtilities';

const GlobalItem: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const { doc: globalItemDoc, loading: globalItemLoading, dbError: globalItemError} = useGetOneDoc(routeID);
  const globalData = useContext(GlobalDataContext);
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const { t } = useTranslation();

  if ( globalItemError || globalData.uomError || globalData.categoryError) { return (
    <ErrorPage errorText={t("error.loading_global_item") as string}></ErrorPage>
    )};

  if ( globalItemLoading || globalData.uomLoading || globalData.categoryLoading)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_global_item")}    /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
};
  
  screenLoading.current=false;
  let curUOMItem : UomDoc | undefined = (globalData.uomDocs as UomDoc[]).find((uom) => (uom.name === globalItemDoc.defaultUOM));
  let curUOM = (curUOMItem === undefined) ? t("general.undefined")  :  translatedUOMName(curUOMItem._id as string ,curUOMItem.description);
  let curCategoryItem : CategoryDoc | undefined = (globalData.categoryDocs as CategoryDoc[]).find((cat) => (cat._id === globalItemDoc.defaultCategoryID));
  let curCategory = (curCategoryItem === undefined) ? t("general.undefined") : translatedCategoryName(curCategoryItem._id,curCategoryItem.name)       ;

  return (
    <IonPage>
      <PageHeader title={t("general.viewing_global_item")+ " " + translatedItemName((globalItemDoc as GlobalItemDoc)._id!, globalItemDoc.name) } />
      <IonContent>
          <IonList>
            <IonItem key="name">
              <IonInput disabled={true} label={t("general.name") as string} labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string} value={translatedItemName((globalItemDoc as GlobalItemDoc)._id!, globalItemDoc.name)}></IonInput>
            </IonItem>
            <IonItem key="cat">
              <IonInput disabled={true} label={t("general.default_category") as string} labelPlacement="stacked" value={curCategory}></IonInput>
            </IonItem>
            <IonItem key="uom">
              <IonInput disabled={true} label={t("general.default_uom") as string} labelPlacement="stacked" value={curUOM}></IonInput>
            </IonItem>
          </IonList>
          <IonButton class="ion-float-right" fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.go_back")}</IonButton>
      </IonContent>
      <IonFooter>
      </IonFooter>
    </IonPage>
  );
};

export default GlobalItem;
