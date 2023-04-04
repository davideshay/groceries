import { IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton  } from '@ionic/react';
import SyncIndicator from './SyncIndicator';   
import './PageHeader.css'; 

type HeaderProps = {
    title : string
}

const PageHeader: React.FC<HeaderProps> = (props: HeaderProps) => {
    return (
        <IonHeader>
            <IonToolbar>
            <IonButtons slot="start"><IonMenuButton class="ion-no-padding small-menu-button" /></IonButtons>
            <IonTitle class="">{props.title}</IonTitle>
            <SyncIndicator />
            </IonToolbar>
        </IonHeader>
    )
}

export default PageHeader;