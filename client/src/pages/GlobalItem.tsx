import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, 
  IonButtons, IonMenuButton, IonItem, IonLabel, IonFooter, NavContext, IonIcon,
  IonLoading } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind, usePouch } from 'use-pouchdb';
import { useState,  useContext, useRef } from 'react';
import { useGetOneDoc } from '../components/Usehooks';
import './Category.css';
import {  HistoryProps} from '../components/DataTypes';
import { CategoryDoc, UomDoc } from '../components/DBSchema';
import SyncIndicator from '../components/SyncIndicator';
import { closeOutline} from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';

const GlobalItem: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [formError,setFormError] = useState<string>("");
  const { doc: globalItemDoc, loading: globalItemLoading, dbError: globalItemError} = useGetOneDoc(routeID);
  const globalData = useContext(GlobalDataContext);
  const {goBack} = useContext(NavContext);
  const db = usePouch();
  const screenLoading = useRef(true);

  if ( globalItemError || globalData.uomError || globalData.categoryError) { return (
    <ErrorPage errorText="Error Loading Global Item Information... Restart."></ErrorPage>
    )};

console.log(globalData.uomLoading, globalData.categoryLoading);

  if ( globalItemLoading || globalData.uomLoading || globalData.categoryLoading)  {
    return ( <Loading isOpen={screenLoading.current} message="Loading Global Item..."
    setIsOpen={() => {screenLoading.current = false}} /> )
};
  
  screenLoading.current=false;
  let curUOMItem : UomDoc | undefined = (globalData.uomDocs as UomDoc[]).find((uom) => (uom.name == globalItemDoc.defaultUOM));
  let curUOM = (curUOMItem == undefined) ? "Undefined" : curUOMItem.description;
  let curCategoryItem : CategoryDoc | undefined = (globalData.categoryDocs as CategoryDoc[]).find((cat) => (cat._id == globalItemDoc.defaultCategoryID));
  let curCategory = (curCategoryItem == undefined) ? "Undefined" : curCategoryItem.name;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Viewing Global Item: {globalItemDoc.name}</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
          <IonList>
            <IonItem key="name">
              <IonInput disabled={true} label="Name" labelPlacement="stacked" type="text" placeholder="<NEW>" value={globalItemDoc.name}></IonInput>
            </IonItem>
            <IonItem key="cat">
              <IonInput disabled={true} label="Default Category" labelPlacement="stacked" value={curCategory}></IonInput>
            </IonItem>
            <IonItem key="uom">
              <IonInput disabled={true} label="Default Unit of Measure" labelPlacement="stacked" value={curUOM}></IonInput>
            </IonItem>
          </IonList>
          <IonButton class="ion-float-right" fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeOutline}></IonIcon>Go Back</IonButton>
      </IonContent>
      <IonFooter>
        <IonLabel>{formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default GlobalItem;
