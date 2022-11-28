import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonFab, IonFabButton, IonIcon, IonReorderGroup } from '@ionic/react';
import { add } from 'ionicons/icons';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect } from 'react';
import './Item.css';

interface ItemPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Item: React.FC<ItemPageProps> = ({ match }) => {

  const [inputName,setInputName] = useState("");
  const [inputQuantity,setInputQuantity] = useState(0);

  const { doc: itemDoc, loading: itemLoading, state: itemState, error: itemError } = useDoc(match.params.id);

  const { docs: listDocs, loading: listLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "list", name: { $exists: true} },
    sort: [ "type","name"]
  });

  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
  });

  useEffect( () => {
    if (!itemLoading) {
      setInputName((itemDoc as any).name);
      setInputQuantity((itemDoc as any).quantity);  
    }
  },[itemLoading]);

  if (itemLoading || listLoading || categoryLoading )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Editing Item: {(itemDoc as any).name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Editing Item: {(itemDoc as any).name}</IonTitle>
          </IonToolbar>
        </IonHeader>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setInputName(e.detail.value)} value={inputName}></IonInput>
            </IonItem>
            <IonItem key="quantity">
              <IonLabel position="stacked">Quantity</IonLabel>
              <IonInput type="number" min="0" max="9999" onIonChange={(e: any) => setInputQuantity(e.detail.value)} value={inputQuantity}></IonInput>
            </IonItem>
          </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Item;
