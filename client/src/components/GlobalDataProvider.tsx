import React, { createContext, useState, useEffect, useContext, useCallback} from "react";
import { useFind} from 'use-pouchdb';
import { CategoryDocs, GlobalItemDocs, ItemDocs, ListDocs, ListGroupDocs, RecipeDoc, UomDoc } from "./DBSchema";
import { ListCombinedRows, ListRow } from "./DataTypes";
import { getListRows } from "./GlobalDataUtilities";
import { RemoteDBStateContext } from "./RemoteDBState";
import { translatedCategoryName, translatedItemName, translatedUOMName } from "./translationUtilities";
import {log} from './Utilities';
import { cloneDeep } from "lodash-es";

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
    recipeListGroup: string | null,
    categoryDocs: CategoryDocs,
    categoryLoading: boolean,
    categoryError: PouchDB.Core.Error | null,
    uomDocs: UomDoc[],
    uomLoading: boolean,
    uomError: PouchDB.Core.Error | null,
    recipeDocs: RecipeDoc[],
    recipesLoading: boolean,
    recipesError: PouchDB.Core.Error | null,
    listRowsLoaded: boolean,
    listRows: ListRow[],
    listCombinedRows: ListCombinedRows,
    dataReloadStatus: DataReloadStatus,
    waitForReload: () => void
}

export enum DataReloadStatus {
    ReloadNeeded = "N",
    ReloadInProcess = "I",
    ReloadComplete = "C"
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
    recipeListGroup: null,
    categoryDocs: [],
    categoryLoading: false,
    categoryError: null,
    uomDocs: [],
    uomLoading: false,
    uomError: null,
    recipeDocs: [],
    recipesLoading: false,
    recipesError: null,
    listRowsLoaded: false,
    listRows: [],
    listCombinedRows: [],
    dataReloadStatus: DataReloadStatus.ReloadNeeded,
    waitForReload: () => {}
}

export const GlobalDataContext = createContext(initialGlobalDataState)

type GlobalDataProviderProps = {
    children: React.ReactNode;
}

export const GlobalDataProvider: React.FC<GlobalDataProviderProps> = (props: GlobalDataProviderProps) => {
    const [ listRows, setListRows ] = useState<ListRow[]>([]);
    const [ listCombinedRows, setListCombinedRows] = useState<ListCombinedRows>([]);
    const [ listRowsLoaded, setListRowsLoaded] = useState(false);
    const [ recipeListGroup, setRecipeListGroup] = useState<string|null>(null);
    const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
    const [ dataReloadStatus, setDataReloadStatus] = useState<DataReloadStatus>(DataReloadStatus.ReloadNeeded);

    const { docs: globalItemDocs, loading: globalItemsLoading, error: globalItemError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "globalitem",
            "name": { "$exists": true } 
            }
        });

    const { docs: listGroupDocs, loading: listGroupsLoading, error: listGroupError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "listgroup",
            "name": { "$exists": true },
            "$or": [
                { "listGroupOwner": remoteDBCreds.dbUsername },
                { "sharedWith": {"$elemMatch" : {"$eq" : remoteDBCreds.dbUsername}}}
            ] 
            }
        });

    const { docs: categoryDocs, loading: categoryLoading, error: categoryError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "category",
            "name": { "$exists": true },
            "$or": [
                {"listGroupID": "system" },
                {"listGroupID": {"$in": (listGroupDocs.map(lg => (lg._id)))}}
            ]
            }
        });

    const { docs: listDocs, loading: listsLoading, error: listError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "list",
            "name": { "$exists": true },
            "listGroupID": {"$in": (listGroupDocs.map(lg => (lg._id)))}
            }
        });

    const { docs: recipeDocs, loading: recipesLoading, error: recipesError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "recipe",
            "name": { "$exists": true },
            "listGroupID": {"$in": (listGroupDocs.map(lg => (lg._id)))}
            }
        });
    
        const { docs: itemDocs, loading: itemsLoading, error: itemError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "item",
            "name": { "$exists": true },
            "listGroupID": {"$in": (listGroupDocs.map(lg => (lg._id)))}
            }
            });
        
    const { docs: uomDocs, loading: uomLoading, error: uomError} = useFind({
        index: "stdTypeName",
        selector: { 
            "type": "uom",
            "name": { "$exists": true }, 
            "$or": [
                {"listGroupID": "system" },
                {"listGroupID": {"$in": (listGroupDocs.map(lg => (lg._id)))}}
            ]
            }
        });

    useEffect( () => {
//        log.debug("Global Data change: ",{listsLoading, listDocs, offline: remoteDBState.workingOffline, syncomplete: remoteDBState.initialSyncComplete})
        if (!listsLoading && !listGroupsLoading && 
                (remoteDBState.initialSyncComplete || !remoteDBState.dbServerAvailable)) {
            setListRowsLoaded(false);
            const { listRows: localListRows, listCombinedRows: localListCombinedRows, recipeListGroup: localRecipeListGroup} = getListRows(listDocs as ListDocs,listGroupDocs as ListGroupDocs,remoteDBCreds)
            setListRows(localListRows);
            setListCombinedRows(localListCombinedRows);
            setRecipeListGroup(localRecipeListGroup);
            setListRowsLoaded(true);
        }
    },[listsLoading, listDocs, listGroupDocs, listGroupsLoading, remoteDBCreds, remoteDBState.workingOffline, remoteDBState.initialSyncComplete, remoteDBState.dbServerAvailable])

    useEffect( () => {
        if (dataReloadStatus === DataReloadStatus.ReloadNeeded) {
            log.debug("Global data reload initiated");
            setDataReloadStatus(DataReloadStatus.ReloadInProcess);
            return
        }
        if (dataReloadStatus === DataReloadStatus.ReloadInProcess) {
            if (! (itemsLoading || globalItemsLoading || listsLoading || listGroupsLoading || categoryLoading || uomLoading)) {
                log.debug("Global data reload complete")
                setDataReloadStatus(DataReloadStatus.ReloadComplete);
            }
        }
    },[itemsLoading,globalItemsLoading,listsLoading,listGroupsLoading,categoryLoading,uomLoading,dataReloadStatus])


    const waitForReload = useCallback( () => {
        log.debug("Wait for Reload Triggered")
        setDataReloadStatus(DataReloadStatus.ReloadNeeded);
    },[setDataReloadStatus])

    useEffect( () => {
        if (globalItemError || listGroupError || categoryError || listError || recipesError || itemError || uomError) {
            log.error("Error retrieving global data:",cloneDeep({globalItemError,listGroupError,categoryError,listError,recipesError,itemError,uomError}))
        }    
    },[globalItemError,listGroupError,categoryError,listError,recipesError,itemError,uomError])

    let value: GlobalDataState = {
            itemDocs: itemDocs as ItemDocs,
            itemsLoading,
            itemError,
            globalItemDocs: (globalItemDocs as GlobalItemDocs).sort(function (a,b) {
                return translatedItemName(String(a._id),a.name,a.name).toLocaleUpperCase().localeCompare(translatedItemName(String(b._id),b.name,b.name).toLocaleUpperCase())
            }),
            globalItemsLoading,
            globalItemError,
            listDocs: listDocs as ListDocs,
            listsLoading,
            listError,
            listGroupDocs: (listGroupDocs as ListGroupDocs).sort(function (a,b) {
                return a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase())
            }),
            listGroupsLoading,
            listGroupError,
            recipeListGroup,
            categoryDocs: (categoryDocs as CategoryDocs).sort(function (a,b) {
                return translatedCategoryName(a._id,a.name).toUpperCase().localeCompare(translatedCategoryName(b._id,b.name).toUpperCase())
            }),
            categoryLoading,
            categoryError,
            uomDocs: (uomDocs as UomDoc[]).sort(function(a,b) {
                return translatedUOMName(a._id as string,a.description,a.pluralDescription).toUpperCase().localeCompare(translatedUOMName(b._id as string,b.description,b.pluralDescription).toUpperCase())
            }),
            uomLoading,
            uomError,
            recipeDocs: (recipeDocs as RecipeDoc[]).sort(function(a,b) {
                return a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase())
            }),
            recipesLoading,
            recipesError,
            listRows: listRows as ListRow[],
            listRowsLoaded,
            listCombinedRows: listCombinedRows as ListCombinedRows,
            dataReloadStatus: dataReloadStatus,
            waitForReload: waitForReload
        };
    return (
        <GlobalDataContext.Provider value={value}>{props.children}</GlobalDataContext.Provider>
      );
}