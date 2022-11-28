import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon } from '@ionic/react';
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

  if ( listLoading || categoryLoading )  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
    )};  

  interface CategoryRow {
    active: boolean,
    categorySeq: number,
    name: string
  }

  let categoryElem=[];
  categoryElem.push(<IonItem key="active"><IonLabel>Active</IonLabel></IonItem>)
  for (let i = 0; i < (listDoc as any).categories.length; i++) {
    const categoryID = (listDoc as any).categories[i];
    const categoryName = (categoryDocs.find(element => (element._id === categoryID)) as any).name;
    categoryElem.push(
      <IonItem key={categoryID}>
        <IonLabel>{categoryName}</IonLabel>
      </IonItem>
    )
  }
  categoryElem.push(<IonItem key="inactive"><IonLabel>Inactive</IonLabel></IonItem>)
  for (let i = 0; i < categoryDocs.length; i++) {
    const category: any = categoryDocs[i];
    const categoryID = category._id;
    const inList = (listDoc as any).categories.includes(categoryID);
    if (!inList) {
      categoryElem.push(
        <IonItem key={categoryID}>
          <IonLabel>{category.name}</IonLabel>
        </IonItem>
      )
    }
  }

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
