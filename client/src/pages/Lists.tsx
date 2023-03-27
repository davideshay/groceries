import { IonPage, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle,
         IonContent, IonList } from "@ionic/react";
import { HistoryProps } from "../components/DataTypes";
import SyncIndicator from "../components/SyncIndicator";
import ListsAll from "../components/ListsAll";
import PageHeader from "../components/PageHeader";

const Lists: React.FC<HistoryProps> = (props: HistoryProps) => {

return (
    <IonPage>
        <PageHeader title="All Lists" />
        <IonContent>
        <IonList>
            <ListsAll separatePage={true}/>
        </IonList>
        </IonContent>
    </IonPage>
)

}

export default Lists;