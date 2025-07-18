import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { CategoryDocs, ConflictDocs, FriendDocs, GenericBaseGroceryDoc, GlobalItemDocs, InitSettingsDoc, ItemDoc, ItemDocs, ListDoc, ListDocs, ListGroupDocs, RecipeDoc, SettingsDoc, UomDoc } from "./DBSchema";
import { ListCombinedRows, ListRow } from "./DataTypes";
import { getListRows } from "./GlobalDataUtilities";
import { translatedCategoryName, translatedItemName, translatedUOMName } from "./translationUtilities";
import log from './logger';
import { DBCreds, RemoteDBState } from './RemoteDBState';
import { isEqual } from 'lodash';

export enum DataReloadStatus {
    ReloadNeeded = "N",
    ReloadInProcess = "I",
    ReloadComplete = "C"
}

export interface GlobalDataState {
    itemDocs: ItemDocs;
    globalItemDocs: GlobalItemDocs;
    listDocs: ListDocs;
    listGroupDocs: ListGroupDocs;
    recipeListGroup: string | null;
    categoryDocs: CategoryDocs;
    uomDocs: UomDoc[];
    recipeDocs: RecipeDoc[];
    settingsDoc: SettingsDoc;
    friendDocs: FriendDocs;
    conflictDocs: ConflictDocs;
    listRowsLoaded: boolean;
    listRows: ListRow[];
    listCombinedRows: ListCombinedRows;
    dataReloadStatus: DataReloadStatus;
    isLoading: boolean;
    error: PouchDB.Core.Error | null;
    
    // Database reference
    db: PouchDB.Database | null;
    remoteDBCreds: DBCreds | null;
    remoteDBState: RemoteDBState | null;

    // optimized updates
    lastUpdatedDoc: GenericBaseGroceryDoc | null;
}

export interface GlobalDataActions {
    // Initialize the store with database and credentials
    initialize: (db: PouchDB.Database, remoteDBCreds: DBCreds, remoteDBState: RemoteDBState) => void;
    
    // Load all data from PouchDB
    loadAllData: () => Promise<void>;
    
    // Data reload management
    waitForReload: () => void;
    
    // Parse all documents and organize by type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseAllDocuments: (docs: any[]) => void;
    
    // Update list rows after data changes
    updateListRows: () => void;
    
    // Cleanup function
    cleanup: () => void;

    // optimistic update
    optimisticUpdate: (id: string, rev: string, doc: GenericBaseGroceryDoc) => Promise<boolean>;
}

export type GlobalDataStore = GlobalDataState & GlobalDataActions;

const initialState: GlobalDataState = {
    itemDocs: [],
    globalItemDocs: [],
    listDocs: [],
    listGroupDocs: [],
    recipeListGroup: null,
    categoryDocs: [],
    uomDocs: [],
    recipeDocs: [],
    settingsDoc: InitSettingsDoc,
    friendDocs: [],
    conflictDocs: [],
    listRowsLoaded: false,
    listRows: [],
    listCombinedRows: [],
    dataReloadStatus: DataReloadStatus.ReloadNeeded,
    isLoading: false,
    error: null,
    db: null,
    remoteDBCreds: null,
    remoteDBState: null,
    lastUpdatedDoc: null
};

export const useGlobalDataStore = create<GlobalDataStore>() ((set,get) => ({
        ...initialState,
        
        initialize: (db, remoteDBCreds, remoteDBState) => {                        
            set({ db, remoteDBCreds, remoteDBState });
            // Start initial data load
            get().loadAllData();
        },
        
        loadAllData: async () => {
            const { db } = get();
            if (!db) return;
            log.debug("Load All Data started...");
            set({ 
                isLoading: true, 
                error: null,
                dataReloadStatus: DataReloadStatus.ReloadInProcess,
                listRowsLoaded: false 
            });
            
            try {
                
                const result = await db.allDocs({
                    include_docs: true
                });
                const docs = result.rows
                    .map(row => row.doc)
                    .filter(doc => doc && !doc._id.startsWith('_design/'));
                log.debug(`Loaded ${docs.length} documents from database. Parsing now...`);
                get().parseAllDocuments(docs);
                get().updateListRows();
                
                set({ 
                    isLoading: false,
                    dataReloadStatus: DataReloadStatus.ReloadComplete 
                });
                
            } catch (error) {
                log.error('Error loading all data:', error);
                set({ 
                    error: error as PouchDB.Core.Error,
                    isLoading: false,
                    dataReloadStatus: DataReloadStatus.ReloadNeeded 
                });
            }
        },
        
        parseAllDocuments: (docs) => {
            const { remoteDBCreds } = get();
            if (!remoteDBCreds) return;
            
            // Initialize arrays for each document type
            const globalItems: GlobalItemDocs = [];
            const listGroups: ListGroupDocs = [];
            const categories: CategoryDocs = [];
            const lists: ListDocs = [];
            const recipes: RecipeDoc[] = [];
            let settings: SettingsDoc = InitSettingsDoc;
            const items: ItemDocs = [];
            const uoms: UomDoc[] = [];
            const friends: FriendDocs = [];
            const conflicts: ConflictDocs = [];

            // Parse all documents by type
            docs.forEach(doc => {
                if (!doc || !doc.type) return;
                
                switch (doc.type) {
                    case 'globalitem':
                        globalItems.push(doc);
                        break;
                    case 'listgroup':
                        // Filter by ownership and sharing
                        if (doc.listGroupOwner === remoteDBCreds.dbUsername ||
                            (doc.sharedWith && doc.sharedWith.includes(remoteDBCreds.dbUsername))) {
                            listGroups.push(doc);
                        }
                        break;                     
                    case 'category':
                        categories.push(doc);
                        break;
                    case 'list':
                        lists.push(doc);
                        break;
                    case 'recipe':
                        recipes.push(doc);
                        break;
                    case 'settings':
                        settings=structuredClone(doc);
                        break;
                    case 'item':
                        items.push(doc);
                        break;
                    case 'uom':
                        uoms.push(doc);
                        break;
                    case "friend":
                        friends.push(doc);
                        break;
                    case "conflictlog":
                        conflicts.push(doc);
                        break;
                    default:
                }
            });

            // Get allowed list group IDs for filtering
            const allowedListGroupIds: (string|undefined|null)[]= listGroups.map(lg => lg._id);
            const allowedListGroupIdsWithSystem = ['system', ...allowedListGroupIds];
            // Filter and sort each document type
            const sortedGlobalItems = globalItems
                .sort((a, b) => 
                    translatedItemName(String(a._id), a.name, a.name)
                        .toLocaleUpperCase()
                        .localeCompare(translatedItemName(String(b._id), b.name, b.name).toLocaleUpperCase())
                );
            
            const sortedListGroups = listGroups
                .sort((a, b) => a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase()));
            
            const filteredAndSortedCategories = categories
                .filter(doc => allowedListGroupIdsWithSystem.includes(doc.listGroupID))
                .sort((a, b) => 
                    translatedCategoryName(a._id, a.name)
                        .toUpperCase()
                        .localeCompare(translatedCategoryName(b._id, b.name).toUpperCase())
                );
            
            const filteredLists = lists
                .filter(doc => allowedListGroupIds.includes(doc.listGroupID));
            
            const filteredAndSortedRecipes = recipes
                .filter(doc => allowedListGroupIds.includes(doc.listGroupID))
                .sort((a, b) => a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase()));
            
            const filteredItems = items
                .filter(doc => allowedListGroupIds.includes(doc.listGroupID));
            
            const filteredAndSortedUoms = uoms
                .filter(doc => allowedListGroupIdsWithSystem.includes(doc.listGroupID))
                .sort((a, b) => 
                    translatedUOMName(a._id as string, a.description, a.pluralDescription)
                        .toUpperCase()
                        .localeCompare(translatedUOMName(b._id as string, b.description, b.pluralDescription).toUpperCase())
                );

            if (!isEqual(sortedGlobalItems,get().globalItemDocs)) {set({globalItemDocs: sortedGlobalItems})};
            if (!isEqual(sortedListGroups,get().listGroupDocs)) {set({listGroupDocs: sortedListGroups})};
            if (!isEqual(filteredAndSortedCategories,get().categoryDocs)) {set({categoryDocs: filteredAndSortedCategories})};
            if (!isEqual(filteredLists,get().listDocs)) {set({listDocs: filteredLists})};
            if (!isEqual(filteredAndSortedRecipes,get().recipeDocs)) {set({recipeDocs: filteredAndSortedRecipes})};
            if (!isEqual(settings,get().settingsDoc)) {set({settingsDoc: settings})};
            if (!isEqual(filteredItems,get().itemDocs)) {set({itemDocs: filteredItems})};
            if (!isEqual(filteredAndSortedUoms,get().uomDocs)) {set({uomDocs: filteredAndSortedUoms})};
            if (!isEqual(friends,get().friendDocs)) {set({friendDocs: friends})};
            if (!isEqual(conflicts,get().conflictDocs)) {set({conflictDocs: conflicts})};

            log.debug("Data parsed and sorted");
        },
        
        updateListRows: () => {
            log.debug("Starting update of list Rows...");
            const { listDocs, listGroupDocs, remoteDBCreds, remoteDBState } = get();      
            if (!remoteDBState) { log.error("No RemoteDB State yet..."); return;}      
            if (!remoteDBCreds) { log.error("No Remote DB Creds yet..."); return;}
            if (!remoteDBState.initialSyncComplete && remoteDBState.dbServerAvailable) {
                log.debug('Skipping list rows update - sync not complete');
                return;
            }
            set({ listRowsLoaded: false });            
            const { listRows, listCombinedRows, recipeListGroup } = getListRows(
                listDocs, 
                listGroupDocs, 
                remoteDBCreds
            );

            if (!isEqual(listRows,get().listRows)) {set({listRows: listRows})};
            if (!isEqual(listCombinedRows,get().listCombinedRows)) {set({listCombinedRows: listCombinedRows})};
            if (!isEqual(recipeListGroup,get().recipeListGroup)) {set({recipeListGroup: recipeListGroup})};
            set({listRowsLoaded: true});
            log.debug("List Rows Set");
        },
        
        waitForReload: () => {
            log.debug("Wait for Reload Triggered");
            set({ dataReloadStatus: DataReloadStatus.ReloadNeeded });
            get().loadAllData();
        },
        
        cleanup: () => {
        },

// Perform an optimistic update from the database update results directly into the global data array store.
// When the database change itself comes via the trigger, it can be ignored
// Right now, only enabled for item and list changes. Everything else will trigger a full data load, but item changes
// alone account for probably 90% + of all updates
        optimisticUpdate: async (id, rev, doc: GenericBaseGroceryDoc) => {
            if (doc.type === "item") {
                const updDoc = doc as ItemDoc;
                updDoc._rev = rev;
                set({itemDocs: get().itemDocs.map( item => 
                    item._id === id ? (updDoc) : item
                )})
                set({lastUpdatedDoc: updDoc});
            } else if (doc.type === "list") {
                const updDoc = doc as ListDoc;
                updDoc._rev = rev;
                set({listDocs: get().listDocs.map( list =>
                    list._id === id ? (updDoc) : list
                )})
                set({lastUpdatedDoc: updDoc});
                get().updateListRows();
            }
            return true;
        },
    }));

// export type GroceryDocType = "trigger" | "settings" | "recipe" | "friend" | "user" | "listgroup" | "list" | "globalitem" | "image" | "item" | "uom" | "dbuuid" | "category" | "conflictlog"

export function useSyncLocalPouchChangesToGlobalData() {
    const db = useGlobalDataStore((state) => state.db);
    const loadAllData = useGlobalDataStore((state) => state.loadAllData);
    const listenerStarted = useRef(false);

    useEffect(() => {
        if (db === null) {
            log.debug("No DB Available");
            return;
        }

        if (listenerStarted.current) {
            log.error("Change listeners already started...");
            return;
        }

            // Set up change listener
        const changes = db.changes({
            since: 'now',
            live: true,
            return_docs: true,
            include_docs: true
        });

        listenerStarted.current = true;
        
        changes.on('change', (change) => {
            log.debug('Database change detected:', change.id);
            // The easiest approach is to just reload from pouchDB "alldocs" collection. This is taking less than 200ms overall.
            // Although processing a deletion can be done much faster, any change or add would require re-running sorting and other functions
            // It's also impossible to determine the difference between an add and a change in this change emitter, so you need to check
            // if a document exists first to determine whether to add or change. Ultimately not worth it.
            //
            // Certain high-volume updates, like item particularly, could use to be slightly faster, so item and list updates
            // are processed in advance and directly update the arrays. Not true for adds, deletes, or other objects.
            let loadDataNeeded = true;
            if (change.doc) {
                const chgDoc: GenericBaseGroceryDoc = change.doc as GenericBaseGroceryDoc;
                if ((chgDoc.type === "item" || chgDoc.type === "list") && isEqual(chgDoc,useGlobalDataStore.getState().lastUpdatedDoc)) {
                    log.debug("Database change was same item as last optimistic update...");
                    useGlobalDataStore.setState({lastUpdatedDoc: null});
                    loadDataNeeded = false;
                } 
            }
            if (loadDataNeeded) { loadAllData();};
        });
        changes.on('error', (error) => {
            log.error('Database changes error:', error);
            useGlobalDataStore.setState({ error: error as PouchDB.Core.Error });
        });
        // Return cleanup function
        return () => {
            changes.cancel();
            listenerStarted.current = false;
        };
    },[db,loadAllData])
}