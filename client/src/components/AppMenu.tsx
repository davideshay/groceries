import { IonMenu, IonContent, IonMenuToggle, IonList, 
     IonItem, IonItemDivider, IonListHeader, IonBadge, IonLabel } from '@ionic/react';
import { useContext } from 'react';    
import { useConflicts, useFriends, UseFriendState } from './Usehooks';    
import ListsAll from './ListsAll';
import { DBCreds, RemoteDBStateContext } from './RemoteDBState';
import { ResolvedFriendStatus } from './DataTypes';
import './AppMenu.css';

const AppMenu: React.FC = () => {
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  const {useFriendState,friendRows} = useFriends(String(remoteDBCreds.dbUsername));
  const { conflictDocs, conflictsLoading } = useConflicts();
 
  const listHeader = (headerName: string) => {
    return (<IonItemDivider>{headerName}</IonItemDivider>)
  }

  const listItem = (listItem: string,link: string) => {
    return (<IonMenuToggle key={listItem} autoHide={false}>
              <IonItem class="app-menu-item" key={"item-"+listItem} routerLink={link}>{listItem}</IonItem>
          </IonMenuToggle>)
  }

  const friendItem = () => {
    let pendingCount=0;
    if (useFriendState == UseFriendState.rowsLoaded) {
      friendRows.forEach(friend => {
        if (friend.resolvedStatus == ResolvedFriendStatus.PendingConfirmation) {pendingCount++}
      })
    }  
    return (<IonMenuToggle key="Friends" autoHide={false}>
              <IonItem class="app-menu-item" key={"item-Friends"} routerLink="/friends">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              Friends
              </IonItem></IonMenuToggle>) 
  }
   const conflictItem = () => {
    let pendingCount=0;
    if (!conflictsLoading) { pendingCount=conflictDocs.length }
    return (<IonMenuToggle key="ConflictLog" autoHide={false}>
              <IonItem class="app-menu-item" key={"item-ConflictLog"} routerLink="/conflictlog">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              Conflict Log
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
        <IonListHeader>Groceries Menu</IonListHeader>
        <IonList>
          {listHeader("Lists")}
          <ListsAll separatePage={false}/>
        </IonList>
        {listItem("Create New List","/list/new/new")}
        {listItem("Manage All Listgroups","/listgroups")}
        {listHeader("Other Actions")}
        {listItem("Manage Categories","/categories")}
        {listItem("Manage All Items","/allitems")}
        {friendItem()}
        {conflictItem()}
        {listItem("Settings","/settings")}
      </IonList>
    </IonContent>
  </IonMenu>
  );
};

export default AppMenu;