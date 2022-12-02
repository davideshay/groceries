import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemDivider, IonReorder, IonLabel, IonButton, IonFab, IonFabButton, IonIcon, IonReorderGroup , ItemReorderEventDetail, IonCheckbox  } from '@ionic/react';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { add } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { cloneDeep } from 'lodash';
import { useUpdateListWhole } from '../components/itemhooks';
import './CategoriesSeqList.css';

interface CategoriesSeqListPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const CategoriesSeqList: React.FC<CategoriesSeqListPageProps> = ({ match}) => {

  const { doc: listDoc, loading: listLoading, state: listState, error: listError } = useDoc(match.params.id);

  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  const updateList  = useUpdateListWhole();

  const [stateListDoc,setStateListDoc] = useState<any>({});
  const [doingUpdate,setDoingUpdate] = useState(false);

  useEffect( () => {
    if (!listLoading) {
      setStateListDoc(listDoc as any);
      setDoingUpdate(false);
    }
  },[listLoading,listDoc,categoryDocs]);

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    console.log('Dragged from index', event.detail.from, 'to', event.detail.to);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
    const currCategories=[];
    let foundIt=false;
    for (let i = 0; i < stateListDoc.categories.length; i++) {
      if (stateListDoc.categories[i] === categoryID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
          console.log("ERROR: Item already in list, cannot set to active");
        } else {
          // skipping item, should not be in list copy
        }
      } else {
        currCategories.push(stateListDoc.categories[i])
      }
    }
    if (updateVal && !foundIt) {
      currCategories.push(categoryID);
    }
    let newListDoc=cloneDeep(stateListDoc);
    newListDoc.categories = currCategories;
    setDoingUpdate(true);
    updateList(newListDoc);
  }

  if ( listLoading || categoryLoading || doingUpdate)  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
    )};  

  let categoryElem=[];
  let categoryLines=[];
  
  for (let i = 0; i < (listDoc as any).categories.length; i++) {
    const categoryID = (listDoc as any).categories[i];
    const categoryName = (categoryDocs.find(element => (element._id === categoryID)) as any).name;
    categoryLines.push(
      <IonItem key={categoryID}>
        <IonCheckbox slot="start" onIonChange={(e: any) => updateCat(categoryID,Boolean(e.detail.checked))} checked={true}></IonCheckbox>
        <IonButton fill="clear" class="textButton">{categoryName}</IonButton>
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
    const categoryName = (categoryDocs.find(element => (element._id === categoryID)) as any).name;
    const inList = (listDoc as any).categories.includes(categoryID);
    if (!inList) {
      categoryLines.push(
        <IonItem key={categoryID}>
          <IonCheckbox slot="start" onIonChange={(e: any) => updateCat(categoryID,Boolean(e.detail.checked))} checked={false}></IonCheckbox>
          <IonButton fill="clear" class="textButton">{categoryName}</IonButton>
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

export default CategoriesSeqList;
