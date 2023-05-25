import { IonPage, IonContent, IonList, IonFab, IonFabButton, IonIcon } from "@ionic/react";
import { HistoryProps } from "../components/DataTypes";
import ListsAll from "../components/ListsAll";
import PageHeader from "../components/PageHeader";
import { useTranslation} from 'react-i18next';
import { add } from "ionicons/icons";

const Lists: React.FC<HistoryProps> = (props: HistoryProps) => {
    const { t } = useTranslation();

return (
    <IonPage>
        <PageHeader title={t("general.all_lists")} />
        <IonContent>
        <IonList>
            <ListsAll separatePage={true}/>
        </IonList>
        </IonContent>
        <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/list/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>

    </IonPage>
)

}

export default Lists;