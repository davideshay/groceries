import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton } from '@ionic/react';
import { useContext, useRef } from 'react';
import SyncIndicator from '../components/SyncIndicator';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';
import './Categories.css';
import { useConflicts } from '../components/Usehooks';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { ConflictDocs } from '../components/DBSchema';
import { useTranslation } from 'react-i18next';
import log from 'loglevel'

const ConflictLog: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { setDBCredsValue } = useContext(RemoteDBStateContext);
  const { conflictsError, conflictDocs, conflictsLoading } = useConflicts();
  const screenLoading = useRef(true);
  const { t } = useTranslation();

  if (conflictsError) { return (
    <ErrorPage errorText={t("error.loading_conflict_log") as string}></ErrorPage>
    )}

  if (conflictsLoading) { 
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_conflict_log")} /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }
  
    screenLoading.current=false;

  function setConflictsAsViewed() {
    const curDateStr = (new Date()).toISOString();
    log.debug("setting conflicts viewed date to ",curDateStr);
    setDBCredsValue("lastConflictsViewed",curDateStr);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle class="ion-no-padding">{t("general.conflict_log")}</IonTitle>
          <IonButton size="small" slot="end" onClick={() => {setConflictsAsViewed()}}>{t("general.set_as_viewed")}</IonButton>
          <SyncIndicator/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList lines="full">
            {(conflictDocs.length === 0) ? (<IonItem>{t("error.no_items_in_conflict_log")}</IonItem>) : <></>}
               {(conflictDocs as ConflictDocs).map((doc) => (
                  <IonItem class="list-button" button key={doc._id} routerLink={("/conflictitem/" + doc._id)} >{doc.docType} {doc.updatedAt} </IonItem>
            ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ConflictLog;
