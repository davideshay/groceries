import { Redirect, Route, Switch, useHistory} from 'react-router-dom';
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
import React, { useContext, useEffect,useSyncExternalStore } from 'react';
import { ThemeType } from '../components/DBSchema';
import ManageData from './ManageData';
import { SafeArea } from '../plugins/safe-area';
import log from '../components/logger';
import { popoverController } from '@ionic/core';

function useSystemDark() {
    return useSyncExternalStore(
        // Subscribe function
        (callback) => {
            if (typeof window === 'undefined') return () => {};
            
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', callback);
            return () => mediaQuery.removeEventListener('change', callback);
        },
        // Get snapshot (client)
        () => {
            if (typeof window === 'undefined') return false;
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        },
        // Get server snapshot
        () => false
    );
}

const AppContent: React.FC = () => {
    const { globalState} = useContext(GlobalStateContext);
    const systemDark = useSystemDark()
    const history = useHistory();

    useEffect( () => {
        const resetTheme = async () => {
            log.debug("Resetting theme to :", globalState.settings.theme, " with prefersDark.matches: ", systemDark)
            if (globalState.settings.theme == ThemeType.dark || (globalState.settings.theme == ThemeType.auto && systemDark)) {
                log.debug("Setting theme to dark mode in JS");
                document.documentElement.classList.add('ion-palette-dark');
                await SafeArea.initialize();
                await SafeArea.changeSystemBarsIconsAppearance({isLight: false});
            } else {
                log.debug("Setting them to light mode in JS");
                document.documentElement.classList.remove('ion-palette-dark');
                await SafeArea.initialize();
                await SafeArea.changeSystemBarsIconsAppearance({isLight: true});
            }
        }
        resetTheme();
    },[globalState.settings.theme,systemDark])

    useEffect(() => {
        const unlisten = history.listen(async () => {
            const popover = await popoverController.getTop();
            if (popover) {
                await popover.dismiss();
            }
        });
        return unlisten;
    }, [history]);

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
                        <Route exact path="/managedata" component={ManageData} />
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