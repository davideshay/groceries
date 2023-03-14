import { IonPage, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle,
         IonContent, IonList } from "@ionic/react";
import { HistoryProps } from "../components/DataTypes";
import SyncIndicator from "../components/SyncIndicator";
import ListsAll from "../components/ListsAll";

const Lists: React.FC<HistoryProps> = (props: HistoryProps) => {

return (
    <IonPage><IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
        <IonTitle>All Lists</IonTitle>
        <SyncIndicator history={props.history}/>
        </IonToolbar>
        <IonContent>
        <IonList>
            <ListsAll separatePage={true}/>
        </IonList>
        </IonContent>
    </IonHeader></IonPage>
)

}

export default Lists;