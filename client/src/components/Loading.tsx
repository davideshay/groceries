import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
    IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon, IonLoading} from '@ionic/react';

    

export type LoadingProps = {
    isOpen: boolean,
    message: string
    setIsOpen: (newOpen: boolean) => void
}    

export const Loading: React.FC<LoadingProps> = (props: LoadingProps) => {

//    <IonLoading isOpen={props.isOpen} onDidDismiss={() => {props.setIsOpen(false);}}
//                message="Loading All Items Data..." />

return (
    <IonPage>
        <IonHeader>
            <IonToolbar>
                <IonButtons slot="start"><IonMenuButton /></IonButtons>
                <IonTitle>Loading...</IonTitle>
            </IonToolbar>
        </IonHeader>
    <IonLoading isOpen={props.isOpen} onDidDismiss={() => {props.setIsOpen(false);}}
                message="Loading All Items Data..." />
    </IonPage>
 

)

}

export default Loading;
