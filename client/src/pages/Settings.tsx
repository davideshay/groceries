import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
        IonMenuButton, IonButtons } from '@ionic/react';
import './Settings.css';

const Settings: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
          <IonItem href="#">
            <IonLabel>Server URL</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Account / Login</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Auto Sync Interval</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
