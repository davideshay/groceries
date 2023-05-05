import { IonHeader, IonPage, IonTitle, IonToolbar, IonLoading, IonContent, IonText } from '@ionic/react';
import { isPlatform } from '@ionic/core';
import { useContext, useEffect, useRef} from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';
import { initialSetupActivities } from '../components/Utilities';
import ErrorPage from './ErrorPage';
import { History } from 'history';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';
import { cloneDeep } from 'lodash';
import log from 'loglevel';

type InitialLoadProps = {
  history : History
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, remoteDBCreds, remoteDB,setConnectionStatus} = useContext(RemoteDBStateContext);
    const { listError ,listRowsLoaded, listRows, listsLoading } = useContext(GlobalDataContext)
    const db=usePouch();
    const screenLoading = useRef(true);
    const { t } = useTranslation();
  
    useEffect(() => {
        async function initialStartup() {
            await initialSetupActivities(remoteDB as PouchDB.Database, String(remoteDBCreds.dbUsername));
            screenLoading.current=false;
            log.debug("Calling Nav from initial load",cloneDeep(listRows));
            await navigateToFirstListID(props.history,remoteDBCreds,listRows);
            setConnectionStatus(ConnectionStatus.initialNavComplete);
        }
        if (listRowsLoaded && !listsLoading) {
            if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete)) {
                initialStartup();
            } 
        }      
    },[db, listRows, props.history, remoteDBCreds, remoteDBState.connectionStatus, listRowsLoaded, listsLoading])   

    useEffect(() => {
        async function dismissToLogin() {
            screenLoading.current = false;
            setConnectionStatus(ConnectionStatus.onLoginScreen);
            props.history.push("/login");
        }
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) {
            dismissToLogin();
        }
    },[remoteDBState.connectionStatus])

    if (listError) {return (
        <ErrorPage errorText={t("error.loading_list_info") as string}></ErrorPage>
    )}

    return (
    <IonPage>
        <IonHeader>
            <IonToolbar>
                <IonTitle id="initialloadtitle">{t("general.loading")}</IonTitle>
                {(isPlatform('ipad') || isPlatform('iphone') || isPlatform('ios')) ? 
                    <IonText>t("general.logging_in)</IonText> :
                <IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false;}} 
                            message={t("general.logging_in") as string} /> }
            </IonToolbar>
        </IonHeader>
        <IonContent>

        </IonContent>
    </IonPage>

    )

}

export default InitialLoad;
