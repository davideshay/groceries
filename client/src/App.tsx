import { IonApp,setupIonicReact} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { GlobalStateProvider } from './components/GlobalState';
import { RemoteDBStateProvider } from './components/RemoteDBState';
import AppContent from "./pages/AppContent";
import "./App.css"

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import '@ionic/react/css/palettes/dark.class.css';
import "./Colors.css"

/* Theme variables */
// import './theme/variables.css';

import PouchDB from 'pouchdb';
import find from 'pouchdb-find';
import { useSyncLocalPouchChangesToGlobalData } from './components/GlobalData';

// import log from 'loglevel';

setupIonicReact({
  swipeBackEnabled: false,
  hardwareBackButton: false
});

const App: React.FC = () => {

  PouchDB.plugin(find);
  const [db, ] = useState(() => new PouchDB('local', {revs_limit: 10, auto_compaction: true, size: 250}))
  useSyncLocalPouchChangesToGlobalData();


  // Back button listener functionality now in RemoteDBState
  
  useEffect( () => {
    db.setMaxListeners(20);
  },[db]);

  return (
  <IonApp>
    <ErrorBoundary>
      <IonReactRouter>
          <RemoteDBStateProvider pouchDB={db}>
            <GlobalStateProvider>
                <AppContent />
            </GlobalStateProvider>
          </RemoteDBStateProvider>
      </IonReactRouter>
    </ErrorBoundary>
  </IonApp>
  )
};

export default App;
