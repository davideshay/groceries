import { IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, 
    IonMenuButton} from '@ionic/react';

    

export type LoadingProps = {
    isOpen: boolean,
    message: string
//    setIsOpen?: (newOpen: boolean) => void
}    

export const Loading: React.FC<LoadingProps> = (props: LoadingProps) => {

//    <IonLoading isOpen={props.isOpen} onDidDismiss={() => {props.setIsOpen(false);}}
//                message="Loading All Items Data..." />

return (
    <IonPage>
        <IonHeader>
            <IonToolbar>
                <IonButtons slot="start"><IonMenuButton /></IonButtons>
                <IonTitle>{props.message}</IonTitle>
            </IonToolbar>
        </IonHeader> 
    </IonPage>
 

)

}

export default Loading;
