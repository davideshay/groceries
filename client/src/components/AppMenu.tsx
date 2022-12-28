import { IonMenu, IonContent, IonMenuToggle, IonList, IonPage, IonHeader, IonToolbar,
    IonTitle, IonItem, IonItemDivider, IonListHeader, IonBadge } from '@ionic/react';
import { useContext } from 'react';    
import { useFriends } from './Usehooks';    
import ListsAll from './ListsAll';
import { RemoteDBStateContext } from './RemoteDBState';
import { ResolvedFriendStatus } from './DataTypes';

const AppMenu: React.FC = () => {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const {friendRowsLoading,friendsLoading,friendRows} = useFriends((remoteDBState.dbCreds as any).dbUsername);

  const listHeader = (headerName: string) => {
    return (<IonList key={headerName}><IonItemDivider>{headerName}</IonItemDivider></IonList>)
  }

  const listItem = (listItem: string,link: string) => {
    return (<IonList key={listItem}><IonMenuToggle key={listItem} autoHide={false}>
              <IonItem key={"item-"+listItem} routerLink={link}>{listItem}</IonItem>
          </IonMenuToggle></IonList>)
  }

  const friendItem = () => {
    let pendingCount=0;
    if (!friendRowsLoading && !friendsLoading) {
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


  if (friendRowsLoading || friendsLoading )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};


  return (
  <IonMenu contentId="main" type="overlay">
    <IonContent className="ion-padding">
      <IonList><IonListHeader>Groceries Menu</IonListHeader></IonList>
      {listHeader("Lists")}
      <ListsAll separatePage={false}/>
      {listItem("Create New List","/list/new/new")}
      {listHeader("Other Actions")}
      {listItem("Manage Categories","/categories")}
      {listItem("Manage All Items","/allitems")}
      {friendItem()}
      {listItem("View Conflict Log","/conflictlog")}
      {listItem("Settings","/settings")}
    </IonContent>
  </IonMenu>
  );
};

export default AppMenu;