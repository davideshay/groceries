import React, { createContext, useCallback, useContext, useEffect, useState} from "react";
import { Preferences } from '@capacitor/preferences';
import { pick,cloneDeep,isEmpty } from "lodash-es";
import { isJsonString } from "./Utilities";
import { RowType } from "./DataTypes";
import { GlobalSettings, AddListOptions, SettingsDoc, InitSettings, InitSettingsDoc, CategoryColors, LogLevelNumber } from "./DBSchema";
import { useCreateGenericDocument, useUpdateGenericDocument } from "./Usehooks";
import { RemoteDBStateContext } from "./RemoteDBState";
import { useFind } from "use-pouchdb";
import log from "./logger";

export type GlobalState = {
    itemMode?: string,
    newItemName?: string,
    newItemGlobalItemID : string | null,
    callingListID?: string,
    callingListType: RowType,
    settings: GlobalSettings,
    categoryColors: CategoryColors,
    settingsLoaded: boolean,
    initialLoadCompleted: boolean,
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    settingsLoading: boolean,
    setGlobalState: React.Dispatch<React.SetStateAction<GlobalState>>,
    setStateInfo: (key: string, value: string | null | RowType) => void,
    updateSettingKey: (key: string, value: AddListOptions | boolean | number | string | null | LogLevelNumber) => Promise<boolean>,
    updateCategoryColor: (catID: string, color: string) => Promise<boolean>,
    deleteCategoryColor: (catID: string) => Promise<boolean>
}


export const initialGlobalState: GlobalState = {
    itemMode: "none",
    newItemName: undefined,
    newItemGlobalItemID: null,
    callingListID: undefined,
    callingListType: RowType.list,
    settings: InitSettings,
    categoryColors: {},
    settingsLoaded: false,
    initialLoadCompleted: false
}

const initialContext: GlobalStateContextType = {
    globalState: initialGlobalState,
    settingsLoading: false,
    setGlobalState: (prevState => (prevState) ),
    setStateInfo: (key: string, value: string | null | RowType) => {},
    updateSettingKey: async (key: string, value: AddListOptions | boolean | number| string | null) => {return false},
    updateCategoryColor: async (catID: string, color: string) => {return false},
    deleteCategoryColor: async (catID: string) => {return false}
}

export const GlobalStateContext = createContext(initialContext)

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState<GlobalState>(initialGlobalState);
    const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
    const { docs: settingsDocs, loading: settingsLoading, error: settingsError} = useFind({
        index: "stdTypeUsername",
        selector: {type: "settings", "username": remoteDBCreds.dbUsername}
    })
    const updateSettingDoc = useUpdateGenericDocument();
    const createSettingDoc = useCreateGenericDocument();

    function setStateInfo(key: string,value: string | null | RowType) {
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    }

    async function updateSettingKey(key: string, value: AddListOptions | boolean | number | string | null): Promise<boolean> {
        setGlobalState(prevState => ({...prevState,settings: {...prevState.settings, [key]: value}}))
        let dbSettingsDoc: SettingsDoc = settingsDocs[0] as SettingsDoc;
        let newSettingsDoc: SettingsDoc = {...dbSettingsDoc,settings: {...dbSettingsDoc.settings,[key]: value}};
        await updateSettingDoc(newSettingsDoc);
        return true;
    }

    async function updateCategoryColor(catID: string, color: string): Promise<boolean> {
        if (isEmpty(color) || isEmpty(catID)) { return false;}
        let curSettingsDoc: SettingsDoc = settingsDocs[0] as SettingsDoc;
        let curCategoryColors: CategoryColors = {}
        if (curSettingsDoc.categoryColors) {
            curCategoryColors = curSettingsDoc.categoryColors;
        }
        curCategoryColors[catID] = color;
        curSettingsDoc.categoryColors = curCategoryColors;
        await updateSettingDoc(curSettingsDoc);
        return true;
    }

    async function deleteCategoryColor(catID: string): Promise<boolean> {
        if (isEmpty(catID)) { return false;}
        let curSettingsDoc: SettingsDoc = settingsDocs[0] as SettingsDoc;
        let curCategoryColors: CategoryColors = {}
        if (curSettingsDoc.categoryColors) {
            curCategoryColors = cloneDeep(curSettingsDoc.categoryColors);
        }
        if (curCategoryColors.hasOwnProperty(catID)) {
            delete curCategoryColors[catID];
        }
        curSettingsDoc.categoryColors = curCategoryColors;
        await updateSettingDoc(curSettingsDoc);
        return true;
    }

    function validateSettings(settings: GlobalSettings) : [GlobalSettings, boolean] {
        let updated = false; let newSettings: GlobalSettings = cloneDeep(settings);
        if (newSettings == null) {newSettings = cloneDeep(InitSettings); updated = true;}
        if (!newSettings.hasOwnProperty('addListOption')) {
            newSettings.addListOption = InitSettings.addListOption;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('removeFromAllLists')) {
            newSettings.removeFromAllLists = InitSettings.removeFromAllLists;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('completeFromAllLists')) {
            newSettings.completeFromAllLists = InitSettings.completeFromAllLists;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('includeGlobalInSearch')) {
            newSettings.includeGlobalInSearch = InitSettings.includeGlobalInSearch;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('daysOfConflictLog')) {
            newSettings.daysOfConflictLog = InitSettings.daysOfConflictLog;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('savedListID')) {
            newSettings.savedListID = InitSettings.savedListID;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('alexaDefaultListGroup')) {
            newSettings.alexaDefaultListGroup = InitSettings.alexaDefaultListGroup;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('theme')) {
            newSettings.theme = InitSettings.theme;
            updated = true;
        }
        if (!newSettings.hasOwnProperty('loggingLevel')) {
            newSettings.loggingLevel = InitSettings.loggingLevel
            updated = true;
        }
        if (!newSettings.hasOwnProperty('logToFile')) {
            newSettings.logToFile = InitSettings.logToFile
            updated = true;
        }
        return [newSettings, updated]
    }

    const getSettings = useCallback( async () => {
        let dbSettingsExist = (settingsDocs.length > 0);
        let dbSettingsDoc: SettingsDoc = cloneDeep(settingsDocs[0]) as SettingsDoc;
        let dbCategoryColors: CategoryColors = {};
        let { value: storageSettingsStr } = await Preferences.get({ key: 'settings'});
        let storageSettings: GlobalSettings = cloneDeep(InitSettings);
        let storageSettingsExist = false;
        if (storageSettingsStr != null && isJsonString(String(storageSettingsStr))) {
            storageSettings=JSON.parse(String(storageSettingsStr));
            let settingsObjFiltered=pick(storageSettings,"addListOption","removeFromAllLists","completeFromAllLists","includeGlobalInSearch","daysOfConflictLog","savedListID","alexaDefaultListGroup");
            storageSettings = settingsObjFiltered;
            storageSettingsExist = true;
        }
        if (storageSettingsExist) {
            [storageSettings, ] = validateSettings(storageSettings);
        }
        let dbUpdated = false;
        if (dbSettingsExist) {
            [dbSettingsDoc.settings, dbUpdated] = validateSettings(dbSettingsDoc.settings);
            dbCategoryColors = isEmpty(dbSettingsDoc.categoryColors) ? {} : dbSettingsDoc.categoryColors! ;
        }
        let finalSettings: GlobalSettings = cloneDeep(InitSettings);
        if (storageSettingsExist && !dbSettingsExist) {
            let newSettingsDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingsDoc.username = String(remoteDBCreds.dbUsername);
            newSettingsDoc.settings = cloneDeep(storageSettings);
            log.debug("Created Settings Doc: settings exist in localstorage, not on DB")
            await createSettingDoc(newSettingsDoc);
            await Preferences.remove({ key: "settings"});
            finalSettings = cloneDeep(newSettingsDoc.settings);
        } else if (!storageSettingsExist && !dbSettingsExist) {
            let newSettingsDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingsDoc.username = String(remoteDBCreds.dbUsername);
            log.debug("Created Settings Doc: no settings exist at all");
            await createSettingDoc(newSettingsDoc)
            finalSettings = cloneDeep(newSettingsDoc.settings);
        } else if (storageSettingsExist && dbSettingsExist) {
            await Preferences.remove({key : "settings"});
            if (dbUpdated) {
                let newSettingsDoc:SettingsDoc = cloneDeep(settingsDocs[0]) as SettingsDoc;
                newSettingsDoc.settings = cloneDeep(dbSettingsDoc.settings);
                log.debug("Updating settings on DB")
                await updateSettingDoc(newSettingsDoc)
            }
            finalSettings = cloneDeep(dbSettingsDoc.settings);
        } else if (!storageSettingsExist && dbSettingsExist) {
            finalSettings = dbSettingsDoc.settings;
            if (dbUpdated) {
                let newSettingsDoc: SettingsDoc = cloneDeep(settingsDocs[0]) as SettingsDoc;
                newSettingsDoc.settings = dbSettingsDoc.settings;
                await updateSettingDoc(newSettingsDoc)
            }
        }
        setGlobalState(prevState => ({...prevState,settings: finalSettings, categoryColors: dbCategoryColors}))
        setGlobalState(prevState => ({...prevState,settingsLoaded: true}));
        return (finalSettings);
    },[createSettingDoc,remoteDBCreds.dbUsername,settingsDocs,updateSettingDoc])

    useEffect( () => {
        if ((remoteDBState.initialSyncComplete || remoteDBState.workingOffline) && !settingsLoading && (settingsError === null)) {
            getSettings()
        }
    },[remoteDBState.initialSyncComplete, remoteDBState.workingOffline, settingsLoading, settingsError,getSettings, settingsDocs])

    useEffect( () => {
        log.setLevel(Number(globalState.settings.loggingLevel) as LogLevelNumber);
    },[globalState.settings.loggingLevel])


    let value: GlobalStateContextType = {globalState, setGlobalState, setStateInfo, updateSettingKey, updateCategoryColor, deleteCategoryColor, settingsLoading: settingsLoading};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



