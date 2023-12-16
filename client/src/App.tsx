import { Redirect, Route, Switch} from 'react-router-dom';
import { IonApp, IonSplitPane,setupIonicReact, IonRouterOutlet} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useState, useEffect } from 'react';
import List from "./pages/List";
import Lists from './pages/Lists';
import Items from './pages/Items';
import Item from './pages/Item';
import GlobalItems from './pages/GlobalItems';
import GlobalItem from './pages/GlobalItem';
import Categories from './pages/Categories';
import Category from './pages/Category';
import ListGroups from './pages/ListGroups';
import ListGroup from './pages/ListGroup';
import Settings from './pages/Settings';
import Friends from './pages/Friends';
import RemoteDBLogin from './pages/RemoteDBLogin';
import InitialLoad from './pages/InitialLoad';
import AppMenu from './components/AppMenu';
import ConflictLog from './pages/ConflictLog';
import ConflictItem from './pages/ConflictItem';
import AllItems from './pages/AllItems';
import Recipes from './pages/Recipes';
import RecipeImport from './pages/RecipeImport';
import Recipe from './pages/Recipe';
import Uoms from './pages/Uoms';
import Uom from './pages/Uom';
import ErrorBoundary from './components/ErrorBoundary';
import { GlobalStateProvider } from './components/GlobalState';
import { RemoteDBStateProvider } from './components/RemoteDBState';
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

/* Theme variables */
import './theme/variables.css';

import { Provider } from 'use-pouchdb';
import PouchDB from 'pouchdb';
import find from 'pouchdb-find';
import { GlobalDataProvider } from './components/GlobalDataProvider';
// import log from 'loglevel';

setupIonicReact({
  swipeBackEnabled: false,
  hardwareBackButton: false
});

const App: React.FC = () => {

  PouchDB.plugin(find);
  const [db, ] = useState(() => new PouchDB('local', {revs_limit: 10, auto_compaction: true, size: 250}))


  // Back button listener functionality now in RemoteDBState
  
  useEffect( () => {
    db.setMaxListeners(20);
  },[db]);

  return (
  <IonApp>
    <ErrorBoundary>
    <IonReactRouter>
    <Provider pouchdb={db}>
    <RemoteDBStateProvider>
    <GlobalStateProvider>
    <GlobalDataProvider>
      <IonSplitPane contentId="main">
      <AppMenu />
        <IonRouterOutlet id="main" placeholder={""}>
          <Switch>
          <Route exact path="/lists" component={Lists} />
          <Route path="/items/:mode/:id" component={Items} />
          <Route path="/item/:mode/:itemid?" component={Item} />
          <Route exact path="/allitems" component={AllItems} />
          <Route exact path="/globalitems" component={GlobalItems} />
          <Route path="/globalitem/:mode/:id" component={GlobalItem} />
          <Route exact path="/categories" component={Categories} />
          <Route path="/category/:mode/:id?" component={Category} />
          <Route exact path="/listgroups" component={ListGroups} />
          <Route path="/listgroup/:mode/:id?" component={ListGroup} />
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
          <Route exact path="/recipes" component={Recipes}></Route>
          <Route path="/recipe/:mode/:id" component={Recipe}></Route>
          <Route exact path="/recipeimport" component={RecipeImport}></Route>
          <Route exact path="/uoms" component={Uoms}></Route>
          <Route path="/uom/:mode/:id" component={Uom}></Route>
          <Route component={InitialLoad}></Route>
          </Switch>
          {/* <Route component={InitialLoad}></Route>  */}
        </IonRouterOutlet>
      </IonSplitPane>
    </GlobalDataProvider>
    </GlobalStateProvider>
    </RemoteDBStateProvider>
    </Provider>
    </IonReactRouter>
    </ErrorBoundary>
  </IonApp>
  )
};

export default App;
