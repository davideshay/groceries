import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption, NavContext } from '@ionic/react';
import { add, compassSharp } from 'ionicons/icons';
import { RouteComponentProps,useParams } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateCategory,useCreateCategory } from '../components/itemhooks';
import { cloneDeep } from 'lodash';
import './Category.css';

interface CategoryPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Category: React.FC<CategoryPageProps> = () => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  let needInitCategoryDoc = (mode === "new") ? true: false;
  console.log({mode,needInitCategoryDoc});
  const [stateCategoryDoc,setStateCategoryDoc] = useState<any>({});
  const updateCategory  = useUpdateCategory();
  const createCategory = useCreateCategory();

  const { doc: categoryDoc, loading: categoryLoading, state: categoryState, error: categoryError } = useDoc(routeID);

  const {goBack} = useContext(NavContext);

  useEffect( () => {
    let newCategoryDoc = cloneDeep(stateCategoryDoc);
    console.log("in useeffect, loading: ",{categoryLoading}, "needinit", {needInitCategoryDoc});
    console.log("current state: ",{stateCategoryDoc}," curent catdoc: ", {categoryDoc});
    if (!categoryLoading) {
      if (mode === "new" && needInitCategoryDoc) {
        console.log("mode is new, creating blank record");
        newCategoryDoc = {type: "category", name: ""}
        needInitCategoryDoc = false;
      } else {
        newCategoryDoc = categoryDoc;
      }
      console.log("newCategoryDoc, about to update:",{newCategoryDoc});
      setStateCategoryDoc(newCategoryDoc);
    }
  },[categoryLoading,categoryDoc]);

  if ( categoryLoading || !stateCategoryDoc )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
  
  function updateThisCategory() {
    let result = {}
    if (mode === "new") {
      result = createCategory(stateCategoryDoc);
    } else {
      result = updateCategory(stateCategoryDoc);
    }
    console.log("result of updating category",result);
    goBack("/categories");
  }
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Editing Category: {(stateCategoryDoc as any).name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
        </IonHeader>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" placeholder="<NEW>" onIonChange={(e: any) => setStateCategoryDoc({...stateCategoryDoc, name: e.detail.value})} value={(stateCategoryDoc as any).name}></IonInput>
            </IonItem>
          </IonList>
          <IonButton onClick={() => updateThisCategory()}>Update</IonButton>
          <IonButton onClick={() => goBack("/categories")}>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Category;
