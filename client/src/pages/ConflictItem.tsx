import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, 
  IonButtons, IonMenuButton, IonItem, IonLabel, IonFooter, IonTextarea, NavContext } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useDoc} from 'use-pouchdb';
import { useContext } from 'react';
import { cloneDeep, isEqual, reduce, pull } from 'lodash';
import './Category.css';
import SyncIndicator from '../components/SyncIndicator';

const ConflictItem: React.FC = () => {
  let { id: routeID } = useParams<{ id: string}>();

  const { doc: conflictDoc, loading: conflictLoading } = useDoc<any>(routeID);

  const {goBack} = useContext(NavContext);

  if ( conflictLoading  )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
  
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
  conflictDoc.losers.forEach((loser:any) => {
    let initDiffs=getObjectDiff(conflictDoc.winner,loser);
    pull(initDiffs,'_rev','updatedAt','_conflicts');
    initDiffs.forEach(element => {
      mainPropsDifferent.add(element);  
    });
  });

  console.log({mainPropsDifferent});
  const mainDiffsText = Array.from(mainPropsDifferent).join(',')

  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Conflict Item: {(conflictDoc as any).docType} from {localDate}</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="maindiffs">
              <IonLabel position="stacked">Main differences</IonLabel>
              <IonTextarea>{mainDiffsText}</IonTextarea>
            </IonItem>
            <IonItem key="winner">
              <IonLabel position="stacked">Winner</IonLabel>
              <IonTextarea>{winnerText}</IonTextarea>
            </IonItem>
            <IonItem key="losers">
              <IonLabel position="stacked">Losers</IonLabel>
              <IonTextarea>{losersText}</IonTextarea>
            </IonItem>
          </IonList>
          <IonButton onClick={() => goBack("/conflictlog")}>Return</IonButton>
      </IonContent>
      <IonFooter>
      </IonFooter>
    </IonPage>
  );
};

export default ConflictItem;
