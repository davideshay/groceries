import React, { createContext, useState, useEffect, useRef} from "react";
import { usePouch, useFind} from 'use-pouchdb';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import PouchDB from 'pouchdb';
import { CategoryDocs, GlobalItemDocs, ItemDocs, ListDocs, ListGroupDocs, UomDoc } from "./DBSchema";


export type GlobalDataState = {
    itemDocs: ItemDocs,
    itemsLoading:  boolean,
    itemError: PouchDB.Core.Error | null,
    globalItemDocs: GlobalItemDocs,
    globalItemsLoading: boolean,
    globalItemError: PouchDB.Core.Error | null,
    listDocs: ListDocs,
    listsLoading: boolean,
    listError: PouchDB.Core.Error | null,
    listGroupDocs: ListGroupDocs,
    listGroupsLoading: boolean,
    listGroupError: PouchDB.Core.Error | null,
    categoryDocs: CategoryDocs,
    categoryLoading: boolean,
    categoryError: PouchDB.Core.Error | null,
    uomDocs: UomDoc[],
    uomLoading: boolean,
    uomError: PouchDB.Core.Error | null,
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
    globalItemError: null,
    listDocs: [],
    listsLoading: false,
    listError: null,
    listGroupDocs: [],
    listGroupsLoading: false,
    listGroupError: null,
    categoryDocs: [],
    categoryLoading: false,
    categoryError: null,
    uomDocs: [],
    uomLoading: false,
    uomError: null

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

    const { docs: listDocs, loading: listsLoading, error: listError} = useFind({
        index: { fields: ["type","name"] },
        selector: { 
            "type": "list",
            "name": { "$exists": true } 
            }
        });


    const { docs: listGroupDocs, loading: listGroupsLoading, error: listGroupError} = useFind({
        index: { fields: ["type","name"] },
        selector: { 
            "type": "listgroup",
            "name": { "$exists": true } 
            }
        });

    const { docs: categoryDocs, loading: categoryLoading, error: categoryError} = useFind({
        index: { fields: ["type","name"] },
        selector: { 
            "type": "category",
            "name": { "$exists": true } 
            }
        });

    const { docs: uomDocs, loading: uomLoading, error: uomError} = useFind({
        index: { fields: ["type","name"] },
        selector: { 
            "type": "uom",
            "name": { "$exists": true } 
            }
        });

    let value: GlobalDataState = {itemDocs: itemDocs as ItemDocs, itemsLoading, itemError,
            globalItemDocs: globalItemDocs as GlobalItemDocs, globalItemsLoading, globalItemError,
            listDocs: listDocs as ListDocs,listsLoading,listError,
            listGroupDocs: listGroupDocs as ListGroupDocs, listGroupsLoading, listGroupError,
            categoryDocs: categoryDocs as CategoryDocs, categoryLoading, categoryError,
            uomDocs: uomDocs as UomDoc[], uomLoading, uomError
        };
    return (
        <GlobalDataContext.Provider value={value}>{props.children}</GlobalDataContext.Provider>
      );
}