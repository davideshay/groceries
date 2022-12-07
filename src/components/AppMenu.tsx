import { IonMenu, IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonMenuButton, IonList, IonInput,
    IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
    IonReorder, IonReorderGroup,ItemReorderEventDetail, IonModal, useIonAlert, NavContext } from '@ionic/react';
import ListsAll from './ListsAll';

const AppMenu: React.FC = () => {

const listHeader = (headerName: string) => {
  return (<IonList key={headerName}><IonItemDivider>{headerName}</IonItemDivider></IonList>)
}

const listItem = (listItem: string,link: string) => {
  return (<IonList key={listItem}><IonItem key={"item-"+listItem} routerLink={link}>{listItem}</IonItem></IonList>)
}

  return (
    <IonMenu contentId="main">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Groceries Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
    <IonContent className="ion-padding">
        {listHeader("Lists")}
        <ListsAll />
        {listHeader("Other Actions")}
        {listItem("Manage Categories","/categories")}
    </IonContent>
  </IonMenu>

  );
};

export default AppMenu;