import { IonContent,IonPage, IonButton, IonList,
  IonItem, IonLabel, IonFooter, IonTextarea, NavContext } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useGetOneDoc} from '../components/Usehooks';
import { useContext, useRef } from 'react';
import { isEqual, pull } from 'lodash';
import { HistoryProps } from '../components/DataTypes';
import { ConflictDoc } from '../components/DBSchema';
import './Category.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';

const ConflictItem: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { id: routeID } = useParams<{ id: string}>();
  const { t } = useTranslation()

  const { doc: conflictDoc, loading: conflictLoading, dbError: conflictError } = useGetOneDoc(routeID);

  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);

  if (conflictError) { return (
    <ErrorPage errorText={t("error.loading_conflict_info") as string}></ErrorPage>
    )}

  if ( conflictLoading  )  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_conflict_item")} /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;
  const localDate = (new Date(conflictDoc.updatedAt)).toLocaleString();
  const winnerText = JSON.stringify(conflictDoc.winner,null,4);
  const losersText = JSON.stringify(conflictDoc.losers,null,4);

  function getObjectDiff(obj1: any, obj2: any) {
    const diff = Object.keys(obj1).reduce((result, key) => {
        if (!obj2.hasOwnProperty(key)) {
            result.push(key);
        } else if (isEqual(obj1[key], obj2[key])) {
            const resultKeyIndex = result.indexOf(key);
            result.splice(resultKeyIndex, 1);
        }
        return result;
    }, Object.keys(obj2));

    return diff;
  }

  const mainPropsDifferent= new Set();
  (conflictDoc as ConflictDoc).losers.forEach((loser) => {
    let initDiffs=getObjectDiff(conflictDoc.winner,loser);
    pull(initDiffs,'_rev','updatedAt','_conflicts');
    initDiffs.forEach(element => {
      mainPropsDifferent.add(element);  
    });
  });

  const mainDiffsText = Array.from(mainPropsDifferent).join(',')

  return (
    <IonPage>
      <PageHeader title={t("general.conflict_item")+" "+(conflictDoc as ConflictDoc).docType +" " + t("general.from") + " " +localDate} />
      <IonContent> 
          <IonList className="ion-no-padding">
            <IonItem key="maindiffs">
              <IonLabel position="stacked">{t("general.main_differences")}</IonLabel>
              <IonTextarea>{mainDiffsText}</IonTextarea>
            </IonItem>
            <IonItem key="winner">
              <IonLabel position="stacked">{t("general.winner")}</IonLabel>
              <IonTextarea>{winnerText}</IonTextarea>
            </IonItem>
            <IonItem key="losers">
              <IonLabel position="stacked">{t("general.losers")}</IonLabel>
              <IonTextarea>{losersText}</IonTextarea>
            </IonItem>
          </IonList>
          <IonButton onClick={() => goBack("/conflictlog")}>{t("general.return")}</IonButton>
      </IonContent>
      <IonFooter>
      </IonFooter>
    </IonPage>
  );
};

export default ConflictItem;
