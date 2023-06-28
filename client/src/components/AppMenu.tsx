import { IonMenu, IonContent, IonMenuToggle, IonList, 
     IonItem, IonItemDivider, IonListHeader, IonBadge } from '@ionic/react';
import { useContext } from 'react';    
import { useConflicts, useFriends, UseFriendState } from './Usehooks';    
import ListsAll from './ListsAll';
import { RemoteDBStateContext } from './RemoteDBState';
import { ResolvedFriendStatus } from './DataTypes';
import { useTranslation } from 'react-i18next';
import './AppMenu.css';

const AppMenu: React.FC = () => {
  const { remoteDBCreds, remoteDBState } = useContext(RemoteDBStateContext);
  const {useFriendState,friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { conflictDocs, conflictsLoading } = useConflicts();
  const { t } = useTranslation();
 
  const listHeader = (headerName: string) => {
    return (<IonItemDivider className="category-divider">{headerName}</IonItemDivider>)
  }

  const listItem = (listItem: string,link: string) => {
    return (<IonMenuToggle key={listItem} autoHide={false}>
              <IonItem className="app-menu-item" key={"item-"+listItem} routerLink={link}>{listItem}</IonItem>
          </IonMenuToggle>)
  }

  const friendItem = () => {
    let pendingCount=0;
    if (useFriendState === UseFriendState.rowsLoaded) {
      friendRows.forEach(friend => {
        if (friend.resolvedStatus === ResolvedFriendStatus.PendingConfirmation) {pendingCount++}
      })
    }  
    return (<IonMenuToggle key="Friends" autoHide={false}>
              <IonItem className="app-menu-item" key={"item-Friends"} routerLink="/friends">
              {(pendingCount > 0) ? <IonBadge slot="end">{pendingCount}</IonBadge> : <></>}
              {t('general.friends')}
              </IonItem></IonMenuToggle>) 
  }
   const conflictItem = () => {
    let pendingCount=0;
    if (!conflictsLoading) { pendingCount=conflictDocs.length }
    return (<IonMenuToggle key="ConflictLog" autoHide={false}>
              <IonItem className="app-menu-item" key={"item-ConflictLog"} routerLink="/conflictlog">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              {t('general.conflict_log')}
              </IonItem></IonMenuToggle>) 
  }
 
  let contentElem;
  if (remoteDBState.loggedIn) {
    contentElem =
        <> 
        <IonList className="ion-no-padding">
          {listHeader(t('general.lists'))}
          <ListsAll separatePage={false}/>
        </IonList>
        {listHeader(t('general.other_actions'))}
        {listItem(t('general.create_new_list'),"/list/new/new")}
        {listItem(t('general.manage_all_listgroups'),"/listgroups")}
        {listItem(t('general.recipes'),"/recipes")}
        {listItem(t('general.manage_categories'),"/categories")}
        {listItem(t('general.manage_all_items'),"/allitems")}
        {listItem(t('general.view_global_items'),"/globalitems")}
        {listItem(t('general.uoms'),"/uoms")}
        {friendItem()}
        {conflictItem()}
        {listItem(t('general.settings'),"/settings")}
        {listItem(t('general.login'),"/login")}
      </>
  } else {
    contentElem = 
      <>
        {listItem(t('general.login'),"/login")}
      </>  
  }

  return (
  <IonMenu contentId="main" type="overlay">
    <IonContent className="ion-no-padding">
      <IonList className="ion-no-padding">
        <IonListHeader className="app-name ion-text-center ion-justify-content-center">
          <img className="app-icon" src="assets/icon/favicon.svg" alt="Clementine" />
          {t('general.groceries_menu')}
        </IonListHeader>
        {contentElem}
      </IonList>
    </IonContent>
  </IonMenu>
  );
};

export default AppMenu;