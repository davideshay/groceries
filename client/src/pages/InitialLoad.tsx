import { IonHeader, IonPage, IonTitle, IonToolbar, IonLoading, IonContent, IonText } from '@ionic/react';
import { isPlatform } from '@ionic/core';
import { useContext, useEffect, useRef} from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, LoginType, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';
import { initialSetupActivities } from '../components/Utilities';
import ErrorPage from './ErrorPage';
import { History } from 'history';
import { DataReloadStatus, GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';
import log from 'loglevel';
import { GlobalStateContext } from '../components/GlobalState';

type InitialLoadProps = {
  history : History
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, remoteDBCreds, remoteDB, setLoginType, setRemoteDBState} = useContext(RemoteDBStateContext);
    const { listError ,listRowsLoaded, listRows, listsLoading, listCombinedRows, dataReloadStatus } = useContext(GlobalDataContext)
    const { globalState } = useContext(GlobalStateContext);
    const db=usePouch();
    const screenLoading = useRef(true);
    const { t } = useTranslation();
  
    useEffect(() => {
        log.debug("setting to auto login from root...");
        setLoginType(LoginType.autoLoginFromRoot);
// eslint-disable-next-line react-hooks/exhaustive-deps 
    },[])

    useEffect(() => {
        async function initialStartup() {
            await initialSetupActivities(remoteDB as PouchDB.Database, String(remoteDBCreds.dbUsername));
            screenLoading.current=false;
            log.debug("In Initial Load, naving to first list id");
            await navigateToFirstListID(props.history,listRows,listCombinedRows, globalState.settings.savedListID);
            setRemoteDBState(prevState => ({...prevState,initialNavComplete: true}));
        }
        if (listRowsLoaded && !listsLoading) {
            if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete && globalState.settingsLoaded && dataReloadStatus === DataReloadStatus.ReloadComplete)) {
                initialStartup();
            } 
        }      
    },[db, remoteDB, listRows, listCombinedRows, props.history, remoteDBCreds.dbUsername, remoteDBState.connectionStatus, listRowsLoaded, listsLoading, setRemoteDBState, dataReloadStatus, globalState.settings, globalState.settingsLoaded])   

    useEffect(() => {
        async function dismissToLogin() {
            screenLoading.current = false;
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.onLoginScreen}));
            props.history.push("/login");
        }
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) {
            dismissToLogin();
        }
    },[remoteDBState.connectionStatus,props.history,setRemoteDBState])

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
