import { Redirect, Route, } from 'react-router-dom';
import {
  IonApp, IonSplitPane,
  setupIonicReact, IonContent, 
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useState, useContext } from 'react';
import Lists from './pages/Lists';
import List from "./pages/List";
import Items from './pages/Items';
import Item from './pages/Item';
import Categories from './pages/Categories';
import Category from './pages/Category';
import Settings from './pages/Settings';
import Friends from './pages/Friends';
import RemoteDBLogin from './pages/RemoteDBLogin';
import InitialLoad from './pages/InitialLoad';
import AppMenu from './components/AppMenu';
import ConflictLog from './pages/ConflictLog';
import ConflictItem from './pages/ConflictItem';
import { GlobalStateProvider } from './components/GlobalState';
import { RemoteDBStateProvider } from './components/RemoteDBState';

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

/* Theme variables */
import './theme/variables.css';


import { Provider } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import find from 'pouchdb-find';
import AllItems from './pages/AllItems';

setupIonicReact();


const App: React.FC = () => {

  PouchDB.plugin(find);
  const [db, setDB] = useState(() => new PouchDB('local', {revs_limit: 10, auto_compaction: true, size: 250}))

  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('backButton', ({canGoBack}) => {
      if (!canGoBack ) {
        CapacitorApp.exitApp()
      } else {
//        history.goBack();
      }
    })
  }

  return (
  <IonApp>
    <GlobalStateProvider>
    <Provider pouchdb={db}>
    <RemoteDBStateProvider>
    <IonReactRouter>
      <IonSplitPane contentId="main">
      <AppMenu />
        <IonContent id="main">
          <Route exact path="/lists" component={Lists} />
          <Route path="/items/:id" component={Items} />
          <Route path="/item/:mode/:itemid?" component={Item} />
          <Route exact path="/allitems" component={AllItems} />
          <Route exact path="/categories" component={Categories} />
          <Route path="/category/:mode/:id?" component={Category} />
          <Route exact path="/settings" component={Settings} />
          <Route exact path="/friends" component={Friends} />
          <Route exact path="/">
            <Redirect to="/initialload" />
          </Route>
          <Route path="/list/:mode/:id?" component={List} />
          <Route exact path="/login" component={RemoteDBLogin} />
          <Route exact path="/initialload" component={InitialLoad}></Route>
          <Route exact path="/conflictlog" component={ConflictLog}></Route>
          <Route path="/conflictitem/:id" component={ConflictItem}></Route>
        </IonContent>
      </IonSplitPane>
    </IonReactRouter>
    </RemoteDBStateProvider>
    </Provider>    
    </GlobalStateProvider>
  </IonApp>
  )
};

export default App;
