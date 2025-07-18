import { IonHeader, IonPage, IonTitle, IonToolbar, IonLoading, IonContent, IonText } from '@ionic/react';
import { isPlatform } from '@ionic/core';
import { useContext, useEffect, useRef} from 'react';
import { ConnectionStatus, LoginType, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';
import ErrorPage from './ErrorPage';
import { History } from 'history';
import { useTranslation } from 'react-i18next';
import log from "../components/logger";
import { GlobalStateContext } from '../components/GlobalState';
import { useHistory } from 'react-router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { DataReloadStatus, useGlobalDataStore } from '../components/GlobalData';

type InitialLoadProps = {
  history : History
}

const InitialLoad: React.FC<InitialLoadProps> = () => {
    const { remoteDBState, remoteDBCreds, remoteDB, setLoginType, setRemoteDBState} = useContext(RemoteDBStateContext);
    const db = useGlobalDataStore((state) => state.db);
    const error = useGlobalDataStore((state) => state.error);
    const isLoading = useGlobalDataStore((state) => state.isLoading);
    const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
    const listRows = useGlobalDataStore((state) => state.listRows);
    const listCombinedRows = useGlobalDataStore((state) => state.listCombinedRows);
    const dataReloadStatus = useGlobalDataStore((state) => state.dataReloadStatus);
    const { globalState, setGlobalState } = useContext(GlobalStateContext);
    const screenLoading = useRef(true);
    const history = useHistory();
    const { t } = useTranslation();
  
    if (globalState.initialLoadCompleted && Capacitor.isNativePlatform()) {
        App.exitApp();
    }

    useEffect(() => {
        log.debug("setting to auto login from root...");
        setLoginType(LoginType.autoLoginFromRoot);
// eslint-disable-next-line react-hooks/exhaustive-deps 
    },[])

    useEffect(() => {
        async function initialStartup() {
            screenLoading.current=false;
            log.debug("In Initial Load, naving to first list id. Saved:",globalState.settings.savedListID);
            await navigateToFirstListID(history,listRows,listCombinedRows, globalState.settings.savedListID);
            setRemoteDBState(prevState => ({...prevState,initialNavComplete: true}));
            setGlobalState(prevState => ({...prevState,initialLoadCompleted: true}));
        }
        if (listRowsLoaded && !isLoading) {
            if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete && globalState.settingsLoaded && dataReloadStatus === DataReloadStatus.ReloadComplete)) {
                initialStartup();
            } 
        }      
    },[db, remoteDB, listRows, listCombinedRows, history, remoteDBCreds.dbUsername, remoteDBState.connectionStatus, listRowsLoaded, isLoading, setRemoteDBState, dataReloadStatus, globalState.settings, globalState.settingsLoaded, setGlobalState])   

    useEffect(() => {
        async function dismissToLogin() {
            screenLoading.current = false;
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.onLoginScreen}));
            setGlobalState(prevState => ({...prevState,initialLoadCompleted: true}));
            history.push("/login");
        }
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) {
            dismissToLogin();
        }
    },[remoteDBState.connectionStatus,history,setRemoteDBState, setGlobalState])

    if (error) {return (
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
