import { Redirect, Route, Switch} from 'react-router-dom';
import { IonSplitPane, IonRouterOutlet} from '@ionic/react';

import List from "./List";
import Lists from './Lists';
import Items from './Items';
import Item from './Item';
import GlobalItems from './GlobalItems';
import GlobalItem from './GlobalItem';
import Categories from './Categories';
import Category from './Category';
import ListGroups from './ListGroups';
import ListGroup from './ListGroup';
import Settings from './Settings';
import Friends from './Friends';
import RemoteDBLogin from './RemoteDBLogin';
import InitialLoad from './InitialLoad';
import AppMenu from '../components/AppMenu';
import ConflictLog from './ConflictLog';
import ConflictItem from './ConflictItem';
import AllItems from './AllItems';
import Recipes from './Recipes';
import RecipeImport from './RecipeImport';
import Recipe from './Recipe';
import Uoms from './Uoms';
import Uom from './Uom';
import Status from "./Status";
import UserData from './UserData';

import { GlobalStateContext } from '../components/GlobalState';
import React, { useContext } from 'react';
import { ThemeType } from '../components/DBSchema';


const AppContent: React.FC = () => {

    const { globalState} = useContext(GlobalStateContext);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    if (globalState.settings.theme == ThemeType.dark || (globalState.settings.theme == ThemeType.auto && prefersDark.matches)) {
        document.documentElement.classList.add('ion-palette-dark');
    } else {
        document.documentElement.classList.remove('ion-palette-dark');
    }


    return(
            <IonSplitPane contentId="main">
                <AppMenu />
                <IonRouterOutlet id="main">
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
                        <Route exact path="/status" component={Status} />
                        <Route exact path="/userdata" component={UserData} />
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
    )

}

export default AppContent;