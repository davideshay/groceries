import React, { createContext, useState} from "react";

export type GlobalState = {
    itemMode?: string,
    newItemName?: string,
    callingListID?: string,
}

export interface GlobalStateContextType {
    globalState: GlobalState,
    setGlobalState: React.SetStateAction<GlobalState>,
    setStateInfo: any 
}

const initialState: GlobalState = {
    itemMode: "none",
    newItemName: undefined,
    callingListID: undefined,
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
        setGlobalState(prevState => ({ ...prevState, [key]: value}))
    }
    let value: any = {globalState, setGlobalState, setStateInfo};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



