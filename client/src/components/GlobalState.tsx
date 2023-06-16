import React, { createContext, useCallback, useContext, useEffect, useState} from "react";
import { Preferences } from '@capacitor/preferences';
import { pick,cloneDeep } from "lodash";
import { isJsonString } from "./Utilities";
import { RowType } from "./DataTypes";
import { GlobalSettings, AddListOptions, SettingsDoc, InitSettings, InitSettingsDoc } from "./DBSchema";
import { useCreateGenericDocument, useUpdateGenericDocument } from "./Usehooks";
import { RemoteDBStateContext } from "./RemoteDBState";
import { useFind } from "use-pouchdb";
import log from "loglevel";

export type GlobalState = {
    itemMode?: string,
    newItemName?: string,
    newItemGlobalItemID : string | null,
    callingListID?: string,
    callingListType: RowType,
    settings: GlobalSettings,
    settingsLoaded: boolean,
    initialLoadCompleted: boolean
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    settingsLoading: boolean,
    setGlobalState: React.Dispatch<React.SetStateAction<GlobalState>>,
    setStateInfo: (key: string, value: string | null | RowType) => void,
    updateSettingKey: (key: string, value: AddListOptions | boolean | number | string) => Promise<boolean>
}


const initialState: GlobalState = {
    itemMode: "none",
    newItemName: undefined,
    newItemGlobalItemID: null,
    callingListID: undefined,
    callingListType: RowType.list,
    settings: InitSettings,
    settingsLoaded: false,
    initialLoadCompleted: false
}

const initialContext: GlobalStateContextType = {
    globalState: initialState,
    settingsLoading: false,
    setGlobalState: (prevState => (prevState) ),
    setStateInfo: (key: string, value: string | null | RowType) => {},
    updateSettingKey: async (key: string, value: AddListOptions | boolean | number| string) => {return false}
}

export const GlobalStateContext = createContext(initialContext)

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState(initialState);
    const [settingsRetrieved,setSettingsRetrieved] = useState(false);
    const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
    const { docs: settingsDocs, loading: settingsLoading, error: settingsError} = useFind({
        selector: {type: "settings", "username": remoteDBCreds.dbUsername}
    })
    const updateSettingDoc = useUpdateGenericDocument();
    const createSettingDoc = useCreateGenericDocument();

    function setStateInfo(key: string,value: string | null | RowType) {
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    }

    async function updateSettingKey(key: string, value: AddListOptions | boolean | number | string): Promise<boolean> {
        setGlobalState(prevState => ({...prevState,settings: {...prevState.settings, [key]: value}}))
        let dbSettingsDoc: SettingsDoc = settingsDocs[0] as SettingsDoc;
        let newSettingsDoc: SettingsDoc = {...dbSettingsDoc,settings: {...dbSettingsDoc.settings,[key]: value}};
        await updateSettingDoc(newSettingsDoc);
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
        return [newSettings, updated]
    }

    const getSettings = useCallback( async () => {
        log.debug("getting settings...");
        let dbSettingsExist = (settingsDocs.length > 0);
        let dbSettingsDoc: SettingsDoc = cloneDeep(settingsDocs[0]);
        let { value: storageSettingsStr } = await Preferences.get({ key: 'settings'});
        let storageSettings: GlobalSettings = cloneDeep(InitSettings);
        let storageSettingsExist = false;
        if (storageSettingsStr != null && isJsonString(String(storageSettingsStr))) {
            storageSettings=JSON.parse(String(storageSettingsStr));
            let settingsObjFiltered=pick(storageSettings,"addListOption","removeFromAllLists","completeFromAllLists","includeGlobalInSearch","daysOfConflictLog","savedListID");
            storageSettings = settingsObjFiltered;
            storageSettingsExist = true;
        }
        if (storageSettingsExist) {
            [storageSettings, ] = validateSettings(storageSettings);
        }
        let dbUpdated = false;
        if (dbSettingsExist) {
            [dbSettingsDoc.settings, dbUpdated] = validateSettings(dbSettingsDoc.settings);
        }
        let finalSettings: GlobalSettings = cloneDeep(InitSettings);
        if (storageSettingsExist && !dbSettingsExist) {
            let newSettingsDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingsDoc.username = String(remoteDBCreds.dbUsername);
            newSettingsDoc.settings = cloneDeep(storageSettings);
            await createSettingDoc(newSettingsDoc);
            await Preferences.remove({ key: "settings"});
            finalSettings = cloneDeep(newSettingsDoc.settings);
        } else if (!storageSettingsExist && !dbSettingsExist) {
            let newSettingsDoc: SettingsDoc = cloneDeep(InitSettingsDoc);
            newSettingsDoc.username = String(remoteDBCreds.dbUsername);
            await createSettingDoc(newSettingsDoc)
            finalSettings = cloneDeep(newSettingsDoc.settings);
        } else if (storageSettingsExist && dbSettingsExist) {
            await Preferences.remove({key : "settings"});
            if (dbUpdated) {
                let newSettingsDoc:SettingsDoc = cloneDeep(settingsDocs[0]);
                newSettingsDoc.settings = cloneDeep(dbSettingsDoc.settings);
                await updateSettingDoc(newSettingsDoc)
            }
            finalSettings = cloneDeep(dbSettingsDoc.settings);
        } else if (!storageSettingsExist && dbSettingsExist) {
            finalSettings = dbSettingsDoc.settings;
            if (dbUpdated) {
                let newSettingsDoc: SettingsDoc = cloneDeep(settingsDocs[0]);
                newSettingsDoc.settings = dbSettingsDoc.settings;
                await updateSettingDoc(newSettingsDoc)
            }
        }
        setGlobalState(prevState => ({...prevState,settings: finalSettings}))
        setSettingsRetrieved(true);
        setGlobalState(prevState => ({...prevState,settingsLoaded: true}));
        log.debug("settings retrieved and set: ",finalSettings);
        return (finalSettings);
    },[createSettingDoc,remoteDBCreds.dbUsername,settingsDocs,updateSettingDoc])

    useEffect( () => {
        if (!settingsRetrieved && (remoteDBState.initialSyncComplete || remoteDBState.workingOffline) && !settingsLoading && (settingsError === null)) {
            getSettings()
        }
    },[remoteDBState.initialSyncComplete, remoteDBState.workingOffline, settingsLoading, settingsError,getSettings,settingsRetrieved])


    let value: GlobalStateContextType = {globalState, setGlobalState, setStateInfo, updateSettingKey, settingsLoading: settingsLoading};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



