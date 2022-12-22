import React, { createContext, useState} from "react";
import { usePouch, useFind } from 'use-pouchdb';
import PouchDB from 'pouchdb';

export type RemoteDBState = {
    remoteDB: PouchDB.Database | undefined,
    syncStatus?: SyncStatus
}

export interface RemoteDBStateContextType {
    remoteDBState: RemoteDBState,
    setRemoteDBState: React.SetStateAction<RemoteDBState>,
    startSync: any 
}

export enum SyncStatus {
    init = 0,
    active = 1,
    paused = 2,
    error = 3,
    denied = 4,
    offline = 5
  }
  
const initialState: RemoteDBState = {
    remoteDB: undefined ,
    syncStatus: SyncStatus.init,
}

const initialContext = {
    remoteDBState: initialState,
    setRemoteDBState: (state: RemoteDBState ) => {},
    startSync: () => {}
}

export const RemoteDBStateContext = createContext(initialContext)

type RemoteDBStateProviderProps = {
    children: React.ReactNode;
}

export const RemoteDBStateProvider: React.FC<RemoteDBStateProviderProps> = (props: RemoteDBStateProviderProps) => {
    const [remoteDBState,setRemoteDBState] = useState<RemoteDBState>(initialState);
    const db=usePouch();

    function setSyncStatus(status: number) {
        setRemoteDBState(prevState => ({...prevState,syncStatus: status}))
    }

    function startSync() {
        const sync = db.sync((remoteDBState.remoteDB as PouchDB.Database), {
            back_off_function: function(delay) {
                console.log("going offline");
                setSyncStatus(SyncStatus.offline);
                if (delay===0) {return 1000};
                if (delay < 60000) {return delay*2.5} else {return 60000};
            },
            retry: true,
            live: true,
          }).on('paused', () => { setSyncStatus(SyncStatus.paused)})
            .on('active', () => { setSyncStatus(SyncStatus.active)})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied); console.log("sync denied: ",{err})})
            .on('error', (err) => { console.log ("error state",{err}) ; 
                              setSyncStatus(SyncStatus.error)})
        console.log("sync started");
    }

    let value: any = {remoteDBState, setRemoteDBState, startSync};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}



