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
            <IonButtons slot="start"><IonMenuButton className="ion-no-padding small-menu-button" /></IonButtons>
            <IonTitle className="">{props.title}</IonTitle>
            <SyncIndicator addPadding={true}/>
            </IonToolbar>
        </IonHeader>
    )
}

export default PageHeader;