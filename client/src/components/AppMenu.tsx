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
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  const {useFriendState,friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { conflictDocs, conflictsLoading } = useConflicts();
  const { t } = useTranslation();
 
  const listHeader = (headerName: string) => {
    return (<IonItemDivider class="category-divider">{headerName}</IonItemDivider>)
  }

  const listItem = (listItem: string,link: string) => {
    return (<IonMenuToggle key={listItem} autoHide={false}>
              <IonItem class="app-menu-item" key={"item-"+listItem} routerLink={link}>{listItem}</IonItem>
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
              <IonItem class="app-menu-item" key={"item-Friends"} routerLink="/friends">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              {t('general.friends')}
              </IonItem></IonMenuToggle>) 
  }
   const conflictItem = () => {
    let pendingCount=0;
    if (!conflictsLoading) { pendingCount=conflictDocs.length }
    return (<IonMenuToggle key="ConflictLog" autoHide={false}>
              <IonItem class="app-menu-item" key={"item-ConflictLog"} routerLink="/conflictlog">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              {t('general.conflict_log')}
              </IonItem></IonMenuToggle>) 
  }

/*   if (useFriendState !== UseFriendState.rowsLoaded|| conflictsLoading)  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
 */
  return (
  <IonMenu contentId="main" type="overlay">
    <IonContent className="ion-padding">
      <IonList>
        <IonListHeader>{t('general.groceries_menu')}</IonListHeader>
        <IonList>
          {listHeader(t('general.lists'))}
          <ListsAll separatePage={false}/>
        </IonList>
        {listItem(t('general.create_new_list'),"/list/new/new")}
        {listItem(t('general.manage_all_listgroups'),"/listgroups")}
        {listHeader(t('general.other_actions'))}
        {listItem(t('general.recipes'),"/recipes")}
        {listItem(t('general.manage_categories'),"/categories")}
        {listItem(t('general.manage_all_items'),"/allitems")}
        {listItem(t('general.view_global_items'),"/globalitems")}
        {listItem(t('general.uoms'),"/uoms")}
        {friendItem()}
        {conflictItem()}
        {listItem(t('general.settings'),"/settings")}
      </IonList>
    </IonContent>
  </IonMenu>
  );
};

export default AppMenu;