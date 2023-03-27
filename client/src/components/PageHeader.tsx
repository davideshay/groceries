import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
    IonButtons, IonMenuButton, IonSelect, IonIcon, IonLoading,
    IonSelectOption, useIonAlert,useIonToast, IonTextarea, IonGrid, IonRow, IonCol, IonText, IonCard,
    IonCardSubtitle, NavContext } from '@ionic/react';
import SyncIndicator from './SyncIndicator';    

type HeaderProps = {
    title : string
}

const PageHeader: React.FC<HeaderProps> = (props: HeaderProps) => {
    
    return (
        <IonHeader>
            <IonToolbar>
            <IonButtons slot="start"><IonMenuButton /></IonButtons>
            <IonTitle class="ion-no-padding">{props.title}</IonTitle>
            <SyncIndicator />
            </IonToolbar>
        </IonHeader>
    )

}

export default PageHeader;