import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { RouteComponentProps } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import './Items.css';

interface ItemsPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Items: React.FC<ItemsPageProps> = ({ match }) => {

  console.log("List ID is : ",match.params.id)

  const { docs, loading, error } = useFind({
    index: {
      fields: ["type","name"]
    },
    selector: {
//      listIDs: { "$elemMatch": { $eq: match.params.id } },
      type: "item",
      name: { $exists: true },


    },
    sort: [ "type", "name" ]
    })

  if (loading) { console.log("Loading...")}
  if (!loading) {console.log(docs)}





  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Items on List : Acme</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Items On List: Acme</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
          <IonItem href="#">
            <IonLabel>Milk</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Butter</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Honeycrisp Apples</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Items;
