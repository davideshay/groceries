import { IonPage, IonContent, IonList } from "@ionic/react";
import { HistoryProps } from "../components/DataTypes";
import ListsAll from "../components/ListsAll";
import PageHeader from "../components/PageHeader";
import { useTranslation} from 'react-i18next';

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
    </IonPage>
)

}

export default Lists;