import { IonMenu, IonContent, IonList, IonMenuToggle, IonItem,
     IonItemDivider, IonListHeader, } from '@ionic/react';
import { useContext } from 'react';    
import ListsAll from './ListsAll';
import { RemoteDBStateContext } from './RemoteDBState';
import { useTranslation } from 'react-i18next';
import './AppMenu.css';
import AppMenuFriendItem from './AppMenuFriendItem';

type ListItemProps = {
  listItem: string,
  link: string
}

function AppMenuListItem ({listItem, link}: ListItemProps) {
  return (
      <IonMenuToggle key={listItem} autoHide={false}>
            <IonItem className="app-menu-item" key={"item-"+listItem} routerLink={link}>{listItem}</IonItem>
      </IonMenuToggle>
  )
}

const AppMenu: React.FC = () => {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const { t } = useTranslation();

  return (
  <IonMenu contentId="main" type="overlay">
    <IonContent>
      <IonList className="ion-no-padding">
        <IonListHeader className="app-name ion-text-center ion-justify-content-center">
          <img className="app-icon" src="assets/icon/favicon.svg" alt="Clementine" />
          {t('general.groceries_menu')}
        </IonListHeader>
        {remoteDBState.loggedIn ? (
            <> 
              <IonList className="ion-no-padding menu-section">
                  <IonItemDivider className="category-divider">{t('general.lists')}</IonItemDivider>
                  <ListsAll separatePage={false}/>
              </IonList>
              <IonList className="ion-no-padding menu-section">
                  <IonItemDivider className="category-divider">{t('general.other_actions')}</IonItemDivider>
                  <AppMenuListItem listItem={t('general.recipes')} link="/recipes" />
                  <AppMenuFriendItem />
                  <AppMenuListItem listItem={t('general.manage_data')} link="/managedata" />
                  <AppMenuListItem listItem={t('general.settings')} link="/settings" />
                  <AppMenuListItem listItem={t('general.status')} link="/status" />
                  <AppMenuListItem listItem={t('general.user_info')} link="/userdata" />
                  <AppMenuListItem listItem={t('general.logout')} link="/login" />
              </IonList>
            </>
        ) :
        (
            <AppMenuListItem listItem={t('general.login')} link="/login" />
        )}
      </IonList>
    </IonContent>
  </IonMenu>
  );
};

export default AppMenu;