import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, 
  IonButtons, IonMenuButton, IonItem, IonLabel, IonFooter, NavContext } from '@ionic/react';
import { RouteComponentProps,useParams } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import './Category.css';
import { PouchResponse } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';

const Category: React.FC = () => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [needInitCategoryDoc,setNeedInitCategoryDoc] = useState((mode === "new") ? true: false);
  const [stateCategoryDoc,setStateCategoryDoc] = useState<any>({});
  const [formError,setFormError] = useState<string>("");
  const updateCategory  = useUpdateGenericDocument();
  const createCategory = useCreateGenericDocument();

  const { doc: categoryDoc, loading: categoryLoading, state: categoryState, error: categoryError } = useDoc(routeID);
  const { docs: categoryDocs, loading: categoriesLoading, error: categoriesError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  const {goBack} = useContext(NavContext);

  useEffect( () => {
    let newCategoryDoc = cloneDeep(stateCategoryDoc);
    if (!categoryLoading) {
      if (mode === "new" && needInitCategoryDoc) {
        newCategoryDoc = {type: "category", name: "", color:"#888888"}
        setNeedInitCategoryDoc(false);
      } else {
        newCategoryDoc = categoryDoc;
      }
      setStateCategoryDoc(newCategoryDoc);
    }
  },[categoryLoading,categoryDoc]);

  if ( categoryLoading || categoriesLoading || !stateCategoryDoc )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
  
  async function updateThisCategory() {
    setFormError("");
    if (stateCategoryDoc.name == undefined || stateCategoryDoc.name == "" || stateCategoryDoc.name == null) {
      setFormError("Must enter a name");
      return false;
    }
    let categoryDup=false;
    categoryDocs.forEach((doc: any) => {
      if ((doc._id !== stateCategoryDoc._id) && (doc.name.toUpperCase() == stateCategoryDoc.name.toUpperCase())) {
        categoryDup = true;
      }
    });
    if (categoryDup) {
      setFormError("Duplicate Category Name");
      return
    }
    let result: PouchResponse
    if (mode === "new") {
      result = await createCategory(stateCategoryDoc);
    } else {
      result = await updateCategory(stateCategoryDoc);
    }
    console.log(result);
    if (result.successful) {
        goBack("/categories");
    } else {
        setFormError("Error updating category: " + result.errorCode + " : " + result.errorText + ". Please retry.");
    } 
  }
  
  if (stateCategoryDoc.color == undefined) {setStateCategoryDoc((prevState: any) => ({...prevState,color:"#888888"}))};

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Category: {(stateCategoryDoc as any).name}</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" placeholder="<NEW>" onIonChange={(e: any) => setStateCategoryDoc({...stateCategoryDoc, name: e.detail.value})} value={(stateCategoryDoc as any).name}></IonInput>
            </IonItem>
            <IonItem key="color">
              <IonLabel position="stacked">Color</IonLabel>
              <input type="color" value={stateCategoryDoc.color} onChange={(e: any) => {console.log(e); console.log(e.target.value); setStateCategoryDoc((prevState: any) => ({...prevState,color: e.target.value}))}}></input>
            </IonItem>
          </IonList>
          <IonButton onClick={() => updateThisCategory()}>{(mode === "new") ? "Add" : "Update"}</IonButton>
          <IonButton onClick={() => goBack("/categories")}>Cancel</IonButton>
      </IonContent>
      <IonFooter>
        <IonLabel>{formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default Category;
