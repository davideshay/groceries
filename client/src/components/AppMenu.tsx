import { IonMenu, IonContent, IonMenuToggle, IonList, IonPage, IonHeader, IonToolbar,
    IonTitle, IonItem, IonItemDivider, IonListHeader, IonBadge, IonLabel } from '@ionic/react';
import { useContext } from 'react';    
import { useConflicts, useFriends, UseFriendState } from './Usehooks';    
import ListsAll from './ListsAll';
import { RemoteDBStateContext } from './RemoteDBState';
import { ResolvedFriendStatus } from './DataTypes';
import { cloneDeep } from 'lodash';

const AppMenu: React.FC = () => {
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  const {useFriendState,friendRows} = useFriends((remoteDBCreds as any).dbUsername);
  const { conflictDocs, conflictsLoading } = useConflicts();
 
  const listHeader = (headerName: string) => {
    return (<IonItemDivider>{headerName}</IonItemDivider>)
  }

  const listItem = (listItem: string,link: string) => {
    return (<IonList key={listItem}><IonMenuToggle key={listItem} autoHide={false}>
              <IonItem key={"item-"+listItem} routerLink={link}><IonLabel>{listItem}</IonLabel></IonItem>
          </IonMenuToggle></IonList>)
  }

  const friendItem = () => {
    let pendingCount=0;
    if (useFriendState == UseFriendState.rowsLoaded) {
      friendRows.forEach(friend => {
        if (friend.resolvedStatus == ResolvedFriendStatus.PendingConfirmation) {pendingCount++}
      })
    }  
    return (<IonList key="Friends"><IonMenuToggle key="Friends" autoHide={false}>
              <IonItem key={"item-Friends"} routerLink="/friends">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              Friends
              </IonItem></IonMenuToggle></IonList>) 
  }
   const conflictItem = () => {
    let pendingCount=0;
    if (!conflictsLoading) { pendingCount=conflictDocs.length }
    return (<IonList key="Conflict Log"><IonMenuToggle key="ConflictLog" autoHide={false}>
              <IonItem key={"item-ConflictLog"} routerLink="/conflictlog">
              {(pendingCount > 0) ? <IonBadge slot="start">{pendingCount}</IonBadge> : <></>}
              Conflict Log
              </IonItem></IonMenuToggle></IonList>) 
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