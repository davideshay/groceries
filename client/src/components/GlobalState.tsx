import React, { createContext, useEffect, useState} from "react";
import { Preferences } from '@capacitor/preferences';
import { keys,pick,cloneDeep } from "lodash";
import { isJsonString } from "./Utilities";

export enum AddListOptions {
    dontAddAutomatically = "D",
    addToAllListsAutomatically = "ALL",
    addToListsWithCategoryAutomatically = "CAT"
}

export type GlobalSettings = {
    addListOption: AddListOptions,
    removeFromAllLists: boolean,
    daysOfConflictLog: Number
}

export type GlobalState = {
    itemMode?: string,
    newItemName?: string,
    callingListID?: string,
    settings: GlobalSettings,
    settingsLoaded: boolean
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    setGlobalState: React.SetStateAction<GlobalState>,
    setStateInfo: any
    updateSettingKey: boolean
}

export const initSettings: GlobalSettings = {
    addListOption: AddListOptions.addToAllListsAutomatically,
    removeFromAllLists: true,
    daysOfConflictLog: 2
}

const initialState: GlobalState = {
    itemMode: "none",
    newItemName: undefined,
    callingListID: undefined,
    settings: initSettings,
    settingsLoaded: false
}

const initialContext = {
    globalState: initialState,
    setGlobalState: (state: GlobalState ) => {},
    setStateInfo: (key: string, value: any) => {},
    updateSettingKey: (key: string, value: any) => Promise
}

export const GlobalStateContext = createContext(initialContext)

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState(initialState);
    const [settingsRetrieved,setSettingsRetrieved] = useState(false);

    function setStateInfo(key: string,value: any) {
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    }

    async function updateSettingKey(key: string, value: any) {
        setGlobalState(prevState => ({...prevState,settings: {...prevState.settings, [key]: value}}))
        let settingsStr = JSON.stringify({...globalState.settings,[key]: value})
        try { await Preferences.set({key: 'settings', value: settingsStr}) }
        catch(err) {console.log("ERROR setting prefs:",err); return false;}
        return true;
    }

    async function getSettings() {
        let { value: settingsStr } = await Preferences.get({ key: 'settings'});
        let settingsObj: GlobalSettings = cloneDeep(initSettings);
        const settingsOrigKeys = keys(settingsObj);
        if (settingsStr != null && isJsonString(String(settingsStr))) {
            settingsObj=JSON.parse(String(settingsStr));
            let settingsObjFiltered=pick(settingsObj,"addListOption","removeFromAllLists","daysOfConflictLog");
            setGlobalState(prevState => ({...prevState,settings: settingsObjFiltered}))
            settingsObj = settingsObjFiltered;
        } else {
            await Preferences.set({key: 'settings', value: JSON.stringify(initSettings)})
        }
        if (settingsObj == null || settingsObj.addListOption == undefined || settingsObj.removeFromAllLists == undefined) {
            settingsObj = initSettings;
            setGlobalState(prevState => ({...prevState,settings: settingsObj}));
        }
        setSettingsRetrieved(true);
        setGlobalState(prevState => ({...prevState,settingsLoaded: true}));
        return (settingsObj);
    }

    useEffect( () => {
        console.log("in global state useeffect, already:",settingsRetrieved);
        if (!settingsRetrieved) {
            getSettings()
        }
    },[])


    let value: any = {globalState, setGlobalState, setStateInfo, updateSettingKey};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



