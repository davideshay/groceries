import React, { createContext, useEffect, useState} from "react";
import { Preferences } from '@capacitor/preferences';
import { keys,pick } from "lodash";
import { isJsonString } from "./Utilities";

export enum AddListOptions {
    dontAddAutomatically,
    addToAllListsAutomatically,
    addToListsWithCategoryAutomatically
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
    settings: GlobalSettings
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    setGlobalState: React.SetStateAction<GlobalState>,
    setStateInfo: any
    updateSettingKey: boolean
}

const initSettings: GlobalSettings = {
    addListOption: AddListOptions.addToAllListsAutomatically,
    removeFromAllLists: true,
    daysOfConflictLog: 2
}

const initialState: GlobalState = {
    itemMode: "none",
    newItemName: undefined,
    callingListID: undefined,
    settings: initSettings
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
        console.log("updating ",key," to ",value);
        let updatedObj=await getSettings();
        updatedObj={...updatedObj, [key]: value}
        let settingsStr = JSON.stringify(updatedObj);
        try { await Preferences.set({key: 'settings', value: settingsStr}) }
        catch(err) {console.log("ERROR setting prefs:",err); return false;}
        return true;
    }

    async function getSettings() {
        let { value: settingsStr } = await Preferences.get({ key: 'settings'});
        let settingsObj: GlobalSettings = initSettings;
        const settingsOrigKeys = keys(settingsObj);
        if (isJsonString(String(settingsStr))) {
            settingsObj=JSON.parse(String(settingsStr));
            let settingsObjFiltered=pick(settingsObj,"addToAllLists","addToListsWithCategory","removeFromAllLists");
            setGlobalState(prevState => ({...prevState,settings: settingsObjFiltered}))
            settingsObj = settingsObjFiltered;
        }
        const settingsKeys=keys(settingsObj);
        if (settingsObj == null || settingsObj.addListOption == undefined || settingsObj.removeFromAllLists == undefined) {
            settingsObj = initSettings;
            setGlobalState(prevState => ({...prevState,settings: settingsObj}));
        }
        setSettingsRetrieved(true);
        return settingsObj;
    }

    useEffect( () => {
//        if (!setSettingsRetrieved) {
//            getSettings()
//        }
    },[settingsRetrieved])


    let value: any = {globalState, setGlobalState, setStateInfo, updateSettingKey};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



