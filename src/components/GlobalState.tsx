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

enum StateActionKind {
    SETITEMMODE = "setItemMode",
    SETNEWITEMNAME = "setNewItemName",
    SETCALLINGLISTID = "setCallingListID"
  }

interface StateAction {
    type: StateActionKind,
    payload: string
} 

const initialState = {
    itemMode: "none",
    newItemName: undefined,
    callingListID: undefined
}

const initialContext = {
    globalState: initialState,
    setGlobalState: (state: GlobalState ) => {},
    setStateInfo: (key: string, value: any) => {}
}

export const GlobalStateContext = createContext(initialContext)

function globalStateReducer(state: GlobalState , action: StateAction) {
    switch(action.type) {
        case "setItemMode" : {return { ...state, itemMode: action.payload}}
            break;
        case "setNewItemName" : {return { ...state, newItemName: action.payload}}
            break;
        case "setCallingListID" : {return { ...state, callingListID: action.payload}}
            break;
        default: return state;    
        }
    }

type GlobalStateProviderProps = {
    children: React.ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = (props: GlobalStateProviderProps) => {
    const [globalState,setGlobalState] = useState(initialState);

    function setStateInfo(key: string,value: any) {
        console.log("about to update state with",{key, value});
        setGlobalState({ ...globalState, [key]: value})
    }
    let value: any = {globalState, setGlobalState, setStateInfo};
    return (
        <GlobalStateContext.Provider value={value}>{props.children}</GlobalStateContext.Provider>
      );
}



