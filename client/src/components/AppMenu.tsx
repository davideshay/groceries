import { IonMenu, IonContent, IonMenuToggle, IonList, 
    IonItem, IonItemDivider, IonListHeader } from '@ionic/react';
import ListsAll from './ListsAll';

const AppMenu: React.FC = () => {

const listHeader = (headerName: string) => {
  return (<IonList key={headerName}><IonItemDivider>{headerName}</IonItemDivider></IonList>)
}

const listItem = (listItem: string,link: string) => {
  return (<IonList key={listItem}><IonMenuToggle key={listItem} autoHide={false}>
            <IonItem key={"item-"+listItem} routerLink={link}>{listItem}</IonItem>
        </IonMenuToggle></IonList>)
}

  return (
  <IonMenu contentId="main" type="overlay">
    <IonContent className="ion-padding">
      <IonList><IonListHeader>Groceries Menu</IonListHeader></IonList>
      {listHeader("Lists")}
      <ListsAll separatePage={false}/>
      {listItem("Create New List","/list/new/new")}
      {listHeader("Other Actions")}
      {listItem("Manage Categories","/categories")}
      {listItem("Friends","/friends")}
      {listItem("Settings","/settings")}
    </IonContent>
  </IonMenu>
  );
};

export default AppMenu;