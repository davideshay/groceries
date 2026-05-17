import React, { createContext, useCallback, useContext, useEffect, useState} from "react";
import { Preferences } from '@capacitor/preferences';
import { pick,cloneDeep,isEmpty } from "lodash-es";
import { isJsonString } from "./Utilities";
import { RowType } from "./DataTypes";
import { GlobalSettings, AddListOptions, SettingsDoc, InitSettings, InitSettingsDoc, CategoryColors, LogLevelNumber } from "./DBSchema";
import { useUpdateGenericDocument } from "./Usehooks";
import { RemoteDBStateContext } from "./RemoteDBState";
import log from "./logger";
import { useGlobalDataStore } from "./GlobalData";

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
    setStateInfo: () => {},
    updateSettingKey: async () => {return false},
    updateCategoryColor: async () => {return false},
    deleteCategoryColor: async () => {return false}
}

export const GlobalStateContext = createContext(initialContext)

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState<GlobalState>(initialGlobalState);
    const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
    const settingsDoc  = useGlobalDataStore((state) => state.settingsDoc);
    const loading  = useGlobalDataStore((state) => state.isLoading);
    const error = useGlobalDataStore((state) => state.error)
    const globalDataLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
    const updateSettingDoc = useUpdateGenericDocument();

    const getCurrentSettingsDoc = useCallback( () : SettingsDoc | null => {
        const dbSettingsDoc: SettingsDoc = cloneDeep(settingsDoc) as SettingsDoc;
        if (dbSettingsDoc === null || dbSettingsDoc === undefined) {return null;}
        if (dbSettingsDoc.type !== "settings") {return null;}
        if (isEmpty(dbSettingsDoc._id)) {return null;}
        if (dbSettingsDoc.username !== String(remoteDBCreds.dbUsername)) {return null;}
        return dbSettingsDoc;
    },[remoteDBCreds.dbUsername,settingsDoc])

    const setStateInfo = useCallback((key: string,value: string | null | RowType) => {
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    },[])

    const updateSettingKey = useCallback(async (key: string, value: AddListOptions | boolean | number | string | null): Promise<boolean> => {
        const dbSettingsDoc = getCurrentSettingsDoc();
        if (dbSettingsDoc === null) {
            log.error("Could not update setting key, no current settings doc available:",key);
            return false;
        }
        setGlobalState(prevState => ({...prevState,settings: {...prevState.settings, [key]: value}}));
        const newSettingsDoc: SettingsDoc = {...dbSettingsDoc,settings: {...dbSettingsDoc.settings,[key]: value}};
        const updateResponse = await updateSettingDoc(newSettingsDoc);
        if (!updateResponse.successful) {
            log.error("Failed updating settings key:", key, updateResponse.fullError);
            setGlobalState(prevState => ({...prevState,settings: cloneDeep(dbSettingsDoc.settings)}));
            return false;
        }
        return true;
    },[getCurrentSettingsDoc,updateSettingDoc])

    async function updateCategoryColor(catID: string, color: string): Promise<boolean> {
        if (isEmpty(color) || isEmpty(catID)) { return false;}
        const curSettingsDoc = getCurrentSettingsDoc();
        if (curSettingsDoc === null) {
            log.error("Could not update category color, no current settings doc available:",catID);
            return false;
        }
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
        const curSettingsDoc = getCurrentSettingsDoc();
        if (curSettingsDoc === null) {
            log.error("Could not delete category color, no current settings doc available:",catID);
            return false;
        }
        let curCategoryColors: CategoryColors = {}
        if (curSettingsDoc.categoryColors) {
            curCategoryColors = cloneDeep(curSettingsDoc.categoryColors);
        }
        if (Object.prototype.hasOwnProperty.call(curCategoryColors, catID)) {
            delete curCategoryColors[catID];
        }
        curSettingsDoc.categoryColors = curCategoryColors;
        await updateSettingDoc(curSettingsDoc);
        return true;
    }

    function validateSettings(settings: GlobalSettings) : [GlobalSettings, boolean] {
        let updated = false; let newSettings: GlobalSettings = cloneDeep(settings);
        if (newSettings == null) {newSettings = cloneDeep(InitSettings); updated = true;}
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'addListOption')) {
            newSettings.addListOption = InitSettings.addListOption;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'removeFromAllLists')) {
            newSettings.removeFromAllLists = InitSettings.removeFromAllLists;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'completeFromAllLists')) {
            newSettings.completeFromAllLists = InitSettings.completeFromAllLists;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'includeGlobalInSearch')) {
            newSettings.includeGlobalInSearch = InitSettings.includeGlobalInSearch;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'daysOfConflictLog')) {
            newSettings.daysOfConflictLog = InitSettings.daysOfConflictLog;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'savedListID')) {
            newSettings.savedListID = InitSettings.savedListID;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'alexaDefaultListGroup')) {
            newSettings.alexaDefaultListGroup = InitSettings.alexaDefaultListGroup;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'theme')) {
            newSettings.theme = InitSettings.theme;
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'loggingLevel')) {
            newSettings.loggingLevel = InitSettings.loggingLevel
            updated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(newSettings, 'logToFile')) {
            newSettings.logToFile = InitSettings.logToFile
            updated = true;
        }
        return [newSettings, updated]
    }

    const getSettings = useCallback( async () => {
        const dbSettingsDoc = getCurrentSettingsDoc();
        let dbCategoryColors: CategoryColors = {};
        const { value: storageSettingsStr } = await Preferences.get({ key: 'settings'});
        let storageSettings: GlobalSettings = cloneDeep(InitSettings);
        let storageSettingsExist = false;
        if (storageSettingsStr != null && isJsonString(String(storageSettingsStr))) {
            storageSettings=JSON.parse(String(storageSettingsStr));
            const settingsObjFiltered=pick(storageSettings,"addListOption","removeFromAllLists","completeFromAllLists","includeGlobalInSearch","daysOfConflictLog","savedListID","alexaDefaultListGroup");
            storageSettings = settingsObjFiltered;
            storageSettingsExist = true;
        }
        if (storageSettingsExist) {
            [storageSettings, ] = validateSettings(storageSettings);
        }
        let dbUpdated = false;
        if (dbSettingsDoc !== null) {
            [dbSettingsDoc.settings, dbUpdated] = validateSettings(dbSettingsDoc.settings);
            dbCategoryColors = isEmpty(dbSettingsDoc.categoryColors) ? {} : dbSettingsDoc.categoryColors! ;
        }
        let finalSettings: GlobalSettings = cloneDeep(InitSettings);
        if (storageSettingsExist && dbSettingsDoc === null) {
            const newSettingsDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingsDoc._id = "user:settings:" + String(remoteDBCreds.dbUsername);
            newSettingsDoc.username = String(remoteDBCreds.dbUsername);
            newSettingsDoc.settings = cloneDeep(storageSettings);
            log.debug("Created Settings Doc: settings exist in localstorage, not on DB")
            const result = await updateSettingDoc(newSettingsDoc);
            if (!result.successful) {log.error("Error creating settings doc from local storage:",result.fullError)}
            await Preferences.remove({ key: "settings"});
            finalSettings = cloneDeep(newSettingsDoc.settings);
        } else if (!storageSettingsExist && dbSettingsDoc === null) {
            const newSettingsDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingsDoc._id = "user:settings:" + String(remoteDBCreds.dbUsername);
            newSettingsDoc.username = String(remoteDBCreds.dbUsername);
            log.debug("Created Settings Doc: no settings exist at all");
            const result = await updateSettingDoc(newSettingsDoc);
            if (!result.successful) {log.error("Error creating initial settings doc:",result.fullError)}
            finalSettings = cloneDeep(newSettingsDoc.settings);
        } else if (storageSettingsExist && dbSettingsDoc !== null) {
            await Preferences.remove({key : "settings"});
            if (dbUpdated) {
                const newSettingsDoc:SettingsDoc = cloneDeep(dbSettingsDoc);
                newSettingsDoc.settings = cloneDeep(dbSettingsDoc.settings);
                log.debug("Updating settings on DB")
                await updateSettingDoc(newSettingsDoc)
            }
            finalSettings = cloneDeep(dbSettingsDoc.settings);
        } else if (!storageSettingsExist && dbSettingsDoc !== null) {
            finalSettings = dbSettingsDoc.settings;
            if (dbUpdated) {
                const newSettingsDoc: SettingsDoc = cloneDeep(dbSettingsDoc);
                newSettingsDoc.settings = dbSettingsDoc.settings;
                await updateSettingDoc(newSettingsDoc)
            }
        }
        setGlobalState(prevState => ({...prevState,settings: finalSettings, categoryColors: dbCategoryColors}))
        setGlobalState(prevState => ({...prevState,settingsLoaded: true}));
        return (finalSettings);
    },[getCurrentSettingsDoc,remoteDBCreds.dbUsername,updateSettingDoc])

    useEffect( () => {
        if ((remoteDBState.initialSyncComplete || remoteDBState.workingOffline) && globalDataLoaded && (error === null)) {
            getSettings()
        }
    },[remoteDBState.initialSyncComplete, remoteDBState.workingOffline, error,getSettings, settingsDoc,globalDataLoaded])

    useEffect( () => {
        console.log("setting log level to:",globalState.settings.loggingLevel);
        log.setLevel(Number(globalState.settings.loggingLevel) as LogLevelNumber);
    },[globalState.settings.loggingLevel])


    const value: GlobalStateContextType = {globalState, setGlobalState, setStateInfo, updateSettingKey, updateCategoryColor, deleteCategoryColor, settingsLoading: loading};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}
