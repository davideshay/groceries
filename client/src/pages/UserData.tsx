import { IonContent, IonPage, IonList, IonItem,
    IonButton, IonInput, IonButtons, IonToolbar, IonText } from '@ionic/react';
import { useContext, useEffect, useRef, useState } from 'react';        
import './Settings.css';
import { InitSettings } from '../components/DBSchema';
import { GlobalStateContext } from '../components/GlobalState';
import { RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps, UserInfo, initUserInfo } from '../components/DataTypes';
import { GlobalSettings } from '../components/DBSchema';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { isEmpty, isEqual, cloneDeep } from 'lodash-es';
import { checkUserByEmailExists, emailPatternValidation, fullnamePatternValidation, updateUserInfo } from '../components/Utilities';
import Loading from '../components/Loading';

type ErrorInfo = {
    isError: boolean,
    fullNameError: string,
    emailError: string,
    formError: string
}

const ErrorInfoInit: ErrorInfo = {
  isError: false,
  fullNameError: "",
  emailError: "",
  formError: ""
}

const UserData: React.FC<HistoryProps> = () => {
    const {globalState, settingsLoading } = useContext(GlobalStateContext);
    const { remoteDBCreds, setDBCredsValue, remoteDBState } = useContext(RemoteDBStateContext);
    const [, setLocalSettings] = useState<GlobalSettings>(InitSettings)
    const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo>(initUserInfo);
    const [errorInfo,setErrorInfo] = useState<ErrorInfo>(cloneDeep(ErrorInfoInit));
    const { t } = useTranslation();
    const screenLoading = useRef(false);

    useEffect( () => {
    if (!localSettingsInitialized && globalState.settingsLoaded) {
        setLocalSettings(globalState.settings);
        setUserInfo({name: String(remoteDBCreds.dbUsername), email: String(remoteDBCreds.email), fullname: String(remoteDBCreds.fullName)})
        setLocalSettingsInitialized(true);
    }
    },[globalState.settings,localSettingsInitialized,globalState.settingsLoaded, remoteDBCreds.fullName, remoteDBCreds.email, remoteDBCreds.dbUsername])

    if ( settingsLoading || !globalState.settingsLoaded || !localSettingsInitialized)  {
        return ( <Loading isOpen={screenLoading.current} message={t("general.loading")} />)
    };

    async function doUpdateUserInfo() {
        let errorFound=false;
        setErrorInfo(prevState=>({...prevState,emailError: "", fullNameError:"",formError: "",isError: false}));
        if (isEmpty(userInfo.email) || !emailPatternValidation(String(userInfo.email))) {
          errorFound=true;setErrorInfo(prevState=>({...prevState,emailError:t("error.invalid_email_format"),isError: true}))
        }
        if (isEmpty(userInfo.fullname) || !fullnamePatternValidation(String(userInfo.fullname))) {
          errorFound=true;setErrorInfo(prevState=>({...prevState,emailError:t("error.invalid_fullname_format"),isError: true}))      
        }
        if (errorFound) return;
        if (isEqual(userInfo,{name: remoteDBCreds.dbUsername, email: remoteDBCreds.email, fullname: remoteDBCreds.fullName})) {
          setErrorInfo(prevState=>({...prevState,formError: "No changes made, not updating"}))
          return;
        }
        if (userInfo.email !== remoteDBCreds.email) {
            const checkExists = await checkUserByEmailExists(userInfo.email,remoteDBCreds);
            if (checkExists.userExists && checkExists.username !== remoteDBCreds.dbUsername) {
              setErrorInfo(prevState=>({...prevState,emailError: "Email already exists under different user", isError: true}));
              return;
            }
        }
        const updateSuccess = await updateUserInfo(String(remoteDBCreds.apiServerURL),remoteDBState.accessJWT,userInfo)
        if (!updateSuccess) {
          setErrorInfo(prevState=>({...prevState,formError: "Error updating user info, retry"}));
          return
        }
        setDBCredsValue("email",userInfo.email);
        setDBCredsValue("fullName",userInfo.fullname);    
        setErrorInfo(prevState=>({...prevState,formError: "User Info Saved"}));
    }

    return (
    <IonPage>
      <PageHeader title={t("general.user_info")} />
      <IonContent fullscreen>
        <IonList lines="none" className="ion-no-padding">
          <IonItem className="shorter-item-no-padding">
            <IonInput className="shorter-input shorter-input2" type="text" disabled={true} labelPlacement="stacked" label={t("general.user_id") as string} value={userInfo.name} />
          </IonItem>
          <IonItem className="shorter-item-no-padding">
            <IonInput type="text" labelPlacement="stacked" label={t("general.name") as string}
                      disabled={!(remoteDBState.apiServerAvailable &&remoteDBState.dbServerAvailable)}
                      value={userInfo.fullname} errorText={errorInfo.fullNameError}
                      className={(errorInfo.isError ? "ion-invalid": "ion-valid")+(" ion-touched shorter-input shorter-input2") }
                      onIonInput={(ev) => {
                        setUserInfo(prevState=>({...prevState,fullname: String(ev.detail.value)}));
                        setErrorInfo(prevState=>({...prevState,isTouched: true}))}} />
          </IonItem>
          <IonItem className="shorter-item-no-padding">
            <IonInput type="text" labelPlacement="stacked" label={t("general.email") as string}
                      disabled={!(remoteDBState.apiServerAvailable &&remoteDBState.dbServerAvailable)}
                      value={userInfo.email} errorText={errorInfo.emailError}
                      className={(errorInfo.isError ? "ion-invalid": "ion-valid")+(" ion-touched shorter-input shorter-input2") }
                      onIonInput={(ev) => {
                        setUserInfo(prevState=>({...prevState,email: String(ev.detail.value)}));
                        setErrorInfo(prevState=>({...prevState,isTouched: true})) }} />
          </IonItem>
          <IonItem><IonText>{errorInfo.formError}</IonText></IonItem>
          <IonToolbar>
            <IonButtons slot="end">
              <IonButton fill="solid" size="small" color="primary" className="primary-button" onClick={() => doUpdateUserInfo()} key="updateuser">{t("general.update_user_info")}</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonList>
      </IonContent>
    </IonPage>
    );
};

export default UserData;