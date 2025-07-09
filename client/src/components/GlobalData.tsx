import { create } from 'zustand';
import { CategoryDocs, ConflictDocs, FriendDocs, GlobalItemDocs, InitSettingsDoc, ItemDocs, ListDocs, ListGroupDocs, RecipeDoc, SettingsDoc, UomDoc } from "./DBSchema";
import { ListCombinedRows, ListRow } from "./DataTypes";
import { getListRows } from "./GlobalDataUtilities";
import { translatedCategoryName, translatedItemName, translatedUOMName } from "./translationUtilities";
import log from './logger';

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
    remoteDBCreds: any;
    remoteDBState: any;
    
    // Change listener reference for cleanup
    changeListener: PouchDB.Core.Changes<{}> | null;
}

export interface GlobalDataActions {
    // Initialize the store with database and credentials
    initialize: (db: PouchDB.Database, remoteDBCreds: any, remoteDBState: any) => () => void;
    
    // Load all data from PouchDB
    loadAllData: () => Promise<void>;
    
    // Data reload management
    waitForReload: () => void;
    
    // Parse all documents and organize by type
    parseAllDocuments: (docs: any[]) => void;
    
    // Update list rows after data changes
    updateListRows: () => void;
    
    // Cleanup function
    cleanup: () => void;
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
    changeListener: null,
};

export const useGlobalDataStore = create<GlobalDataStore>() ((set,get) => ({
        ...initialState,
        
        initialize: (db, remoteDBCreds, remoteDBState) => {
            console.log("initialize called...");
            const state = get();
            
            // Cleanup existing listener if any
            if (state.changeListener) {
                state.changeListener.cancel();
            }
            
            set({ db, remoteDBCreds, remoteDBState });
            
            // Start initial data load
            get().loadAllData();
            
            // Set up change listener
            const changes = db.changes({
                since: 'now',
                live: true,
                include_docs: true
            });
            
            changes.on('change', (change) => {
                console.debug('Database change detected:', change.id);
                // Reload all data when any change occurs
                get().loadAllData();
            });
            
            changes.on('error', (error) => {
                console.error('Database changes error:', error);
                set({ error: error as PouchDB.Core.Error });
            });
            
            set({ changeListener: changes });
            
            // Return cleanup function
            return () => {
                changes.cancel();
                set({ changeListener: null });
            };
        },
        
        loadAllData: async () => {
            const { db } = get();
            if (!db) return;
            
            set({ 
                isLoading: true, 
                error: null,
                dataReloadStatus: DataReloadStatus.ReloadInProcess 
            });
            
            try {
                console.debug('Loading all documents from database');
                
                const result = await db.allDocs({
                    include_docs: true
                });
                
                const docs = result.rows
                    .map(row => row.doc)
                    .filter(doc => doc && !doc._id.startsWith('_design/'));
                
                log.debug(`Loaded ${docs.length} documents from database`);
                
                get().parseAllDocuments(docs);
                get().updateListRows();
                
                set({ 
                    isLoading: false,
                    dataReloadStatus: DataReloadStatus.ReloadComplete 
                });
                
            } catch (error) {
                console.error('Error loading all data:', error);
                set({ 
                    error: error as PouchDB.Core.Error,
                    isLoading: false,
                    dataReloadStatus: DataReloadStatus.ReloadNeeded 
                });
            }
        },
        
        parseAllDocuments: (docs) => {
            const { remoteDBCreds, remoteDBState } = get();
            if (!remoteDBCreds) return;
            
            console.debug('Parsing documents by type');
            
            // Initialize arrays for each document type
            const globalItems: any[] = [];
            const listGroups: any[] = [];
            const categories: any[] = [];
            const lists: any[] = [];
            const recipes: any[] = [];
            let settings: SettingsDoc = InitSettingsDoc;
            const items: any[] = [];
            const uoms: any[] = [];
            const friends: any[] = [];
            const conflicts: any[] = [];
             
            console.log("processing all documents. remoteDB creds:",{remoteDBCreds,remoteDBState});

            // Parse all documents by type
            docs.forEach(doc => {
                if (!doc || !doc.type || !doc.name) return;
                
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
                }
            });
            
            // Get allowed list group IDs for filtering
            const allowedListGroupIds = listGroups.map(lg => lg._id);
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
            
            console.debug('Parsed documents:', {
                globalItems: sortedGlobalItems.length,
                listGroups: sortedListGroups.length,
                categories: filteredAndSortedCategories.length,
                lists: filteredLists.length,
                recipes: filteredAndSortedRecipes.length,
                settings,
                items: filteredItems.length,
                uoms: filteredAndSortedUoms.length,
                friends: friends.length,
                conflicts: conflicts.length
            });
            
            // Update the store with parsed and sorted data
            set({
                globalItemDocs: sortedGlobalItems as GlobalItemDocs,
                listGroupDocs: sortedListGroups as ListGroupDocs,
                categoryDocs: filteredAndSortedCategories as CategoryDocs,
                listDocs: filteredLists as ListDocs,
                recipeDocs: filteredAndSortedRecipes as RecipeDoc[],
                settingsDoc: settings,
                itemDocs: filteredItems as ItemDocs,
                uomDocs: filteredAndSortedUoms as UomDoc[],
                friendDocs: friends as FriendDocs,
                conflictDocs: conflicts as ConflictDocs
            });
        },
        
        updateListRows: () => {
            const { listDocs, listGroupDocs, remoteDBCreds, remoteDBState } = get();
            
            if (!remoteDBState.initialSyncComplete && remoteDBState.dbServerAvailable) {
                console.debug('Skipping list rows update - sync not complete');
                return;
            }
            
            console.debug('Updating list rows');
            set({ listRowsLoaded: false });
            
            const { listRows, listCombinedRows, recipeListGroup } = getListRows(
                listDocs, 
                listGroupDocs, 
                remoteDBCreds
            );
            
            set({ 
                listRows, 
                listCombinedRows, 
                recipeListGroup, 
                listRowsLoaded: true 
            });
            
            log.debug('List rows updated:', {
                listRows: listRows.length,
                listCombinedRows: listCombinedRows.length,
                recipeListGroup
            });
        },
        
        waitForReload: () => {
            log.debug("Wait for Reload Triggered");
            set({ dataReloadStatus: DataReloadStatus.ReloadNeeded });
            get().loadAllData();
        },
        
        cleanup: () => {
            const { changeListener } = get();
            if (changeListener) {
                changeListener.cancel();
                set({ changeListener: null });
            }
        }
    }));
