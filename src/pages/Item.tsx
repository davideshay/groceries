import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonSelectOption, NavContext } from '@ionic/react';
import { add } from 'ionicons/icons';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateItem } from '../components/itemhooks';
import './Item.css';

interface ItemPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Item: React.FC<ItemPageProps> = ({ match }) => {

  const [stateItemDoc,setStateItemDoc] = useState({});
  const updateItem  = useUpdateItem();

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

  const {goBack} = useContext(NavContext);

  useEffect( () => {
    if (!itemLoading) {
      setStateItemDoc(itemDoc as any);
    }
  },[itemLoading]);

  if (itemLoading || listLoading || categoryLoading )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  function updateThisItem() {
    updateItem(stateItemDoc);
    goBack("/lists");
  }

  function updateCategory(catID: string) {
    setStateItemDoc({
      ...stateItemDoc,
      categoryID: catID
    });
  }
  
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
              <IonInput type="text" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, name: e.detail.value})} value={(stateItemDoc as any).name}></IonInput>
            </IonItem>
            <IonItem key="quantity">
              <IonLabel position="stacked">Quantity</IonLabel>
              <IonInput type="number" min="0" max="9999" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, quantity: e.detail.value})} value={(stateItemDoc as any).quantity}></IonInput>
            </IonItem>
            <IonItem key="category">
              <IonLabel position="stacked">Category</IonLabel>
              <IonSelect onIonChange={(ev) => updateCategory(ev.detail.value)} value={(stateItemDoc as any).categoryID}>
                {categoryDocs.map((cat) => (
                    <IonSelectOption key={cat._id} value={(cat as any)._id}>
                      {(cat as any).name}
                    </IonSelectOption>
                ))}

              </IonSelect>
            </IonItem>
          </IonList>
          <IonButton onClick={() => updateThisItem()}>Update</IonButton>
          <IonButton onClick={() => goBack("/lists")}>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Item;
