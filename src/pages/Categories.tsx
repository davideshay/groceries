import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup, IonItemDivider, IonReorder, IonLabel, IonFab, IonFabButton, IonIcon, IonReorderGroup , ItemReorderEventDetail  } from '@ionic/react';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { add } from 'ionicons/icons';
import './Categories.css';

interface CategoriesPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Categories: React.FC<CategoriesPageProps> = ({ match}) => {

  const { doc: listDoc, loading: listLoading, state: listState, error: listError } = useDoc(match.params.id);

  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    console.log('Dragged from index', event.detail.from, 'to', event.detail.to);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  if ( listLoading || categoryLoading )  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
    )};  

  interface CategoryRow {
    active: boolean,
    categorySeq: number,
    name: string
  }

  let categoryElem=[];
  let categoryLines=[];
  
  for (let i = 0; i < (listDoc as any).categories.length; i++) {
    const categoryID = (listDoc as any).categories[i];
    const categoryName = (categoryDocs.find(element => (element._id === categoryID)) as any).name;
    categoryLines.push(
      <IonItem key={categoryID}>
        <IonLabel>{categoryName}</IonLabel>
        <IonReorder slot="end"></IonReorder>
      </IonItem>
    )
  }
  categoryElem.push(
    <div key="active-div">
    <IonItemDivider key="active">
    <IonLabel>Active</IonLabel>
    </IonItemDivider>
    <IonReorderGroup key="active-reorder-group" disabled={false} onIonItemReorder={handleReorder}>
        {categoryLines}
    </IonReorderGroup>
    </div>
  )
  categoryLines=[];
  for (let i = 0; i < categoryDocs.length; i++) {
    const category: any = categoryDocs[i];
    const categoryID = category._id;
    const inList = (listDoc as any).categories.includes(categoryID);
    if (!inList) {
      categoryLines.push(
        <IonItem key={categoryID}>
          <IonLabel>{category.name}</IonLabel>
          <IonReorder slot="end>"></IonReorder>
        </IonItem>
      )
    }
  }
  categoryElem.push(
    <div key="inactive-div">
    <IonItemDivider key="inactive">
    <IonLabel>Inactive</IonLabel>
    </IonItemDivider>
    <IonReorderGroup key="inactive-reorder-group" disabled={false} onIonItemReorder={handleReorder}>
        {categoryLines}
    </IonReorderGroup>
    </div>
  )

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Category Editor : {(listDoc as any).name} </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Category Editor: {(listDoc as any).name}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList lines="full">
          {categoryElem}
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

export default Categories;
