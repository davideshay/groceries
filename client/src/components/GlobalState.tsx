import React, { createContext, useEffect, useState} from "react";
import { Preferences } from '@capacitor/preferences';
import { pick,cloneDeep } from "lodash";
import { isJsonString, logger } from "./Utilities";
import { LogLevel, RowType } from "./DataTypes";
import { GlobalSettings, AddListOptions } from "./DBSchema";

export type GlobalState = {
    itemMode?: string,
    newItemName?: string,
    newItemGlobalItemID : string | null,
    callingListID?: string,
    callingListType: RowType,
    settings: GlobalSettings,
    settingsLoaded: boolean
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    setGlobalState: React.Dispatch<React.SetStateAction<GlobalState>>,
    setStateInfo: (key: string, value: string | null | RowType) => void,
    updateSettingKey: (key: string, value: AddListOptions | boolean | number) => Promise<boolean>
}

export const initSettings: GlobalSettings = {
    addListOption: AddListOptions.addToAllListsAutomatically,
    removeFromAllLists: true,
    completeFromAllLists: true,
    daysOfConflictLog: 2
}

const initialState: GlobalState = {
    itemMode: "none",
    newItemName: undefined,
    newItemGlobalItemID: null,
    callingListID: undefined,
    callingListType: RowType.list,
    settings: initSettings,
    settingsLoaded: false
}

const initialContext = {
    globalState: initialState,
    setGlobalState: (state: GlobalState ) => {},
    setStateInfo: (key: string, value: string | null | RowType) => {},
    updateSettingKey: async (key: string, value: AddListOptions | boolean | number) => {return false}
}

export const GlobalStateContext = createContext(initialContext)

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState(initialState);
    const [settingsRetrieved,setSettingsRetrieved] = useState(false);

    function setStateInfo(key: string,value: string | null | RowType) {
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    }

    async function updateSettingKey(key: string, value: AddListOptions | boolean | number): Promise<boolean> {
        setGlobalState(prevState => ({...prevState,settings: {...prevState.settings, [key]: value}}))
        let settingsStr = JSON.stringify({...globalState.settings,[key]: value})
        try { await Preferences.set({key: 'settings', value: settingsStr}) }
        catch(err) {logger(LogLevel.ERROR,"ERROR setting prefs:",err); return false;}
        return true;
    }

    async function getSettings() {
        let { value: settingsStr } = await Preferences.get({ key: 'settings'});
        let settingsObj: GlobalSettings = cloneDeep(initSettings);
        if (settingsStr != null && isJsonString(String(settingsStr))) {
            settingsObj=JSON.parse(String(settingsStr));
            let settingsObjFiltered=pick(settingsObj,"addListOption","removeFromAllLists","completeFromAllLists","daysOfConflictLog");
            setGlobalState(prevState => ({...prevState,settings: settingsObjFiltered}))
            settingsObj = settingsObjFiltered;
        } else {
            await Preferences.set({key: 'settings', value: JSON.stringify(initSettings)})
        }
        let needUpdate=false;
        if (settingsObj == null) {settingsObj = initSettings; needUpdate = true;}
        if (!settingsObj.hasOwnProperty('addListOption')) {
            settingsObj.addListOption = initSettings.addListOption;
            needUpdate = true;
        }
        if (!settingsObj.hasOwnProperty('removeFromAllLists')) {
            settingsObj.removeFromAllLists = initSettings.removeFromAllLists;
            needUpdate = true;
        }
        if (!settingsObj.hasOwnProperty('completeFromAllLists')) {
            settingsObj.completeFromAllLists = initSettings.completeFromAllLists;
            needUpdate = true;
        }
        if (!settingsObj.hasOwnProperty('daysOfConflictLog')) {
            settingsObj.daysOfConflictLog = initSettings.daysOfConflictLog;
            needUpdate = true;
        }
        if (needUpdate) {
            await Preferences.set({key: 'settings', value: JSON.stringify(settingsObj)})
            setGlobalState(prevState => ({...prevState,settings: settingsObj}));
        }
        setSettingsRetrieved(true);
        setGlobalState(prevState => ({...prevState,settingsLoaded: true}));
        return (settingsObj);
    }

    useEffect( () => {
        if (!settingsRetrieved) {
            getSettings()
        }
    },[])


    let value: GlobalStateContextType = {globalState, setGlobalState, setStateInfo, updateSettingKey};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



