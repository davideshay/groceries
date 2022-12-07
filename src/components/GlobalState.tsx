import React, { createContext, useState} from "react";

export type GlobalState = {
    itemMode?: string,
    newItemName?: string,
    callingListID?: string
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    setGlobalState: React.SetStateAction<GlobalState>,
    setStateInfo: any 
}

export enum SyncStatus {
    init = 0,
    active = 1,
    paused = 2,
    error = 3,
    denied = 4
  }
  

const initialState = {
    itemMode: "none",
    newItemName: undefined,
    callingListID: undefined,
    syncStatus: SyncStatus.init
}

const initialContext = {
    globalState: initialState,
    setGlobalState: (state: GlobalState ) => {},
    setStateInfo: (key: string, value: any) => {}
}

export const GlobalStateContext = createContext(initialContext)

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState(initialState);

    function setStateInfo(key: string,value: any) {
        console.log("about to update state with",{key, value});
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    }
    let value: any = {globalState, setGlobalState, setStateInfo};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



