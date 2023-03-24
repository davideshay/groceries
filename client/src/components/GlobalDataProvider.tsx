import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch, useFind} from 'use-pouchdb';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import PouchDB from 'pouchdb';
import { GlobalItemDocs, ItemDocs } from "./DBSchema";


export type GlobalDataState = {
    itemDocs: ItemDocs,
    itemsLoading:  boolean,
    itemError: PouchDB.Core.Error | null,
    globalItemDocs: GlobalItemDocs,
    globalItemsLoading: boolean,
    globalItemError: PouchDB.Core.Error | null
}

export interface GlobalDataContextType {
    globalDataState: GlobalDataState,
}

export const initialGlobalDataState: GlobalDataState = {
    itemDocs: [],
    itemsLoading: false,
    itemError: null,
    globalItemDocs: [],
    globalItemsLoading: false,
    globalItemError: null
}

export const GlobalDataContext = createContext(initialGlobalDataState)

type GlobalDataProviderProps = {
    children: React.ReactNode;
}

export const GlobalDataProvider: React.FC<GlobalDataProviderProps> = (props: GlobalDataProviderProps) => {
    const { docs: itemDocs, loading: itemsLoading, error: itemError} = useFind({
        index: { fields: ["type","name"] },
        selector: { 
            "type": "item",
            "name": { "$exists": true } 
         }
         });

    const { docs: globalItemDocs, loading: globalItemsLoading, error: globalItemError} = useFind({
        index: { fields: ["type","name"] },
        selector: { 
            "type": "globalitem",
            "name": { "$exists": true } 
            }
        });

    let value: GlobalDataState = {itemDocs: itemDocs as ItemDocs, itemsLoading, itemError,
            globalItemDocs: globalItemDocs as GlobalItemDocs, globalItemsLoading, globalItemError };
    return (
        <GlobalDataContext.Provider value={value}>{props.children}</GlobalDataContext.Provider>
      );
}