import { IonContent, IonPage, IonItem,
         IonInput,
        IonRadioGroup, IonRadio, IonCheckbox, IonItemDivider, IonSelect, IonSelectOption, 
        IonButton} from '@ionic/react';
import {  useContext, useEffect, useRef, useState } from 'react';        
import './Settings.css';
import { InitSettings, ThemeType } from '../components/DBSchema';
import { GlobalStateContext } from '../components/GlobalState';
import { RemoteDBStateContext,  } from '../components/RemoteDBState';
import { HistoryProps, UserInfo, initUserInfo } from '../components/DataTypes';
import { GlobalSettings, AddListOptions} from '../components/DBSchema';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { languageDescriptions } from '../i18n';
import Loading from '../components/Loading';
import { Capacitor } from '@capacitor/core';
import { prefsLoggingSettings,enableFileLogging,disableFileLogging, setPrefsLoggingLevel, clearLogFile } from '../components/logger';

const Settings: React.FC<HistoryProps> = (props: HistoryProps) => {
  const {globalState, settingsLoading, updateSettingKey} = useContext(GlobalStateContext);
  const { remoteDBCreds, } = useContext(RemoteDBStateContext);
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(InitSettings)
  const [localSettingsInitialized,setLocalSettingsInitialized] = useState(false);
  const [, setUserInfo] = useState<UserInfo>(initUserInfo);
  const { t, i18n } = useTranslation();
  const screenLoading = useRef(false);

  useEffect( () => {
    if (!localSettingsInitialized && globalState.settingsLoaded) {
      setLocalSettings(prevState=>(globalState.settings));
      setUserInfo({name: String(remoteDBCreds.dbUsername), email: String(remoteDBCreds.email), fullname: String(remoteDBCreds.fullName)})
      setLocalSettings(prevState=>({...prevState,logToFile: prefsLoggingSettings.logToFile}));
      setLocalSettingsInitialized(true);
    }
  },[globalState.settings,localSettingsInitialized,globalState.settingsLoaded, remoteDBCreds.fullName, remoteDBCreds.email, remoteDBCreds.dbUsername])

  if ( settingsLoading || !globalState.settingsLoaded || !localSettingsInitialized)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };

  function changeSetting(key: string, value: AddListOptions | boolean | number) {
    updateSettingKey(key,value);
    setLocalSettings(prevState => ({...prevState,[key]: value}));
  }

  function changeLogToFileSetting(value: boolean) {
    setLocalSettings(prevState => ({...prevState,logToFile: value}));
    if (value) {
      enableFileLogging();
    } else {
      disableFileLogging();
    }
  }

  const curLanguage = i18n.resolvedLanguage;
  const isAndroid = Capacitor.getPlatform() === "android";


  return (
    <IonPage>
      <PageHeader title={t("general.settings")} />
      <IonContent fullscreen>
          <IonItemDivider className="category-divider">{t("general.add_other_list_options")}</IonItemDivider> 
          <IonRadioGroup value={localSettings?.addListOption} onIonChange={(e) => changeSetting("addListOption",e.detail.value)}>
            <IonItem className="shorter-item-no-padding settings-item" key="addallauto">
              <IonRadio className="indent-setting" justify="space-between" labelPlacement="start" value={AddListOptions.addToAllListsAutomatically}>{t("general.add_same_group_auto")}</IonRadio>
            </IonItem>
            <IonItem className="shorter-item-no-padding settings-item" key="addcategoryauto">
              <IonRadio className="indent-setting" justify="space-between" labelPlacement="start" value={AddListOptions.addToListsWithCategoryAutomatically}>{t("general.add_same_categories_auto")}</IonRadio>
            </IonItem>
            <IonItem className="shorter-item-no-padding settings-item" key="dontaddauto">
              <IonRadio className="indent-setting" justify="space-between" labelPlacement="start" value={AddListOptions.dontAddAutomatically}>{t("general.dont_add_auto")}</IonRadio>
            </IonItem>
          </IonRadioGroup>
          <IonItemDivider className="category-divider">{t("general.other_settings")}</IonItemDivider>
          <IonItem className="shorter-item-no-padding settings-item" key="theme">
            <IonSelect className="shorter-select shorter-select2" label={t("general.theme") as string} interface="popover" onIonChange={(e) => changeSetting("theme",e.detail.value)} value={localSettings.theme}>
              <IonSelectOption key={"theme-"+ThemeType.auto} value={ThemeType.auto}>{t("general.theme-auto")}</IonSelectOption>
              <IonSelectOption key={"theme-"+ThemeType.dark} value={ThemeType.dark}>{t("general.theme-dark")}</IonSelectOption>
              <IonSelectOption key={"theme-"+ThemeType.light} value={ThemeType.light}>{t("general.theme-light")}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem className="shorter-item-no-padding settings-item" key="language">
            <IonSelect className="shorter-select shorter-select2" label={t("general.language") as string}
                  interface="popover"
                  onIonChange={(e) => i18n.changeLanguage(e.detail.value)} value={curLanguage}>
                      {languageDescriptions.map((lng: any) => (
                          <IonSelectOption key={"language-"+lng.key} value={lng.key}>
                            {lng.name}
                          </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem className="shorter-item-no-padding settings-item" key="removesettings">
            <IonCheckbox justify="space-between" labelPlacement="start"
                checked={localSettings.removeFromAllLists}
                onIonChange={(e) => changeSetting("removeFromAllLists",e.detail.checked)}>
                    {t("general.remove_items_all_lists_purchased")}
            </IonCheckbox>
          </IonItem>
          <IonItem className="shorter-item-no-padding settings-item" key="deletesettings">
            <IonCheckbox justify="space-between" labelPlacement="start"
                checked={localSettings.completeFromAllLists}
                onIonChange={(e) => changeSetting("completeFromAllLists",e.detail.checked)}>
                    {t("general.delete_all_lists_when_deleting_completed")}
            </IonCheckbox>
          </IonItem>
          <IonItem className="shorter-item-no-padding settings-item" key="searchsettings">
            <IonCheckbox justify="space-between" labelPlacement="start"
                checked={localSettings.includeGlobalInSearch}
                onIonChange={(e) => changeSetting("includeGlobalInSearch",e.detail.checked)}>
                    {t("general.include_globalitems_in_search")}
            </IonCheckbox>
          </IonItem>
          <IonItem className="shorter-item-no-padding settings-item" key="dayslog">
            <IonInput className="shorter-input shorter-input2" label={t("general.days_conflict_log_to_view") as string} labelPlacement="start" type="number" min="0" max="25" onIonInput={(e) => changeSetting("daysOfConflictLog", Number(e.detail.value))} value={Number(localSettings?.daysOfConflictLog)}></IonInput>
          </IonItem>
          <IonItem className="shorter-item-no-padding settings-item" key="loglevel">
            <IonSelect className="shorter-select shorter-select2" label={t("general.log_level") as string}
                interface="popover" value={String(localSettings.loggingLevel)}
                onIonChange={
                  (e) => {
                    changeSetting("loggingLevel",Number(e.detail.value));
                    setPrefsLoggingLevel(Number(e.detail.value));
                  }
                  }>
                    <IonSelectOption key={"log-trace"} value="0">{t("general.trace")}</IonSelectOption>
                    <IonSelectOption key={"log-debug"} value="1">{t("general.debug")}</IonSelectOption>
                    <IonSelectOption key={"log-info"} value="2">{t("general.info")}</IonSelectOption>
                    <IonSelectOption key={"log-warn"} value="3">{t("general.warn")}</IonSelectOption>
                    <IonSelectOption key={"log-error"} value="4">{t("general.error")}</IonSelectOption>
                    <IonSelectOption key={"log-silent"} value="5">{t("general.silent")}</IonSelectOption>
              </IonSelect>
          </IonItem>
          {isAndroid ?
            <> 
            <IonItem className="shorter-item-no-padding settings-item" key="logtofile">
              <IonCheckbox justify='space-between' labelPlacement='start'
                    checked={localSettings.logToFile}
                    onIonChange={(e) => changeLogToFileSetting(e.detail.checked)}>
                      {t("general.log_to_file")}
              </IonCheckbox>
            </IonItem>
            <IonItem className="shorter-item-no-padding settings-item" key="clearfile">
              <IonButton onClick={(e) => {clearLogFile()}}>Clear Log File</IonButton>
            </IonItem>
            </>
          : <></>}
          <IonItem className="shorter-item-no-padding" key="helpdocs">
            <IonButton href='https://davideshay.github.io/groceries/userguide/settings/' target='_blank'>{t("general.view_help_docs")}</IonButton>
          </IonItem>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
