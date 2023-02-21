import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, 
  IonButtons, IonMenuButton, IonItem, IonLabel, IonFooter, NavContext, IonIcon,
  useIonAlert } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind, usePouch } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteCategoryFromItems, useDeleteGenericDocument, useDeleteCategoryFromLists, useGetOneDoc } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import './Category.css';
import { PouchResponse, HistoryProps } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';
import { addOutline, closeOutline, navigate, saveOutline, trashOutline } from 'ionicons/icons';

const Category: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [needInitCategoryDoc,setNeedInitCategoryDoc] = useState((mode === "new") ? true: false);
  const [stateCategoryDoc,setStateCategoryDoc] = useState<any>({});
  const [formError,setFormError] = useState<string>("");
  const [deletingCategory,setDeletingCategory] = useState(false)
  const [presentAlert,dismissAlert] = useIonAlert();
  const updateCategory  = useUpdateGenericDocument();
  const createCategory = useCreateGenericDocument();
  const deleteCategory = useDeleteGenericDocument();
  const deleteCategoryFromItems = useDeleteCategoryFromItems();
  const deleteCategoryFromLists = useDeleteCategoryFromLists();
//  const [categoryDoc, setCategoryDoc] = useState<any>(null);
//  const [categoryLoading,setCategoryLoading] = useState(true);
//  const categoryChanges = useRef<any>();
  const { doc: categoryDoc, loading: categoryLoading} = useGetOneDoc(routeID);

  const { docs: categoryDocs, loading: categoriesLoading, error: categoriesError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  const {goBack} = useContext(NavContext);
  const db = usePouch();

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

  if ( categoryLoading || categoriesLoading || !stateCategoryDoc || deletingCategory)  {return(
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
    if (result.successful) {
        goBack("/categories");
    } else {
        setFormError("Error updating category: " + result.errorCode + " : " + result.errorText + ". Please retry.");
    } 
  }
  
  async function getNumberOfItemsUsingCategory() {
    let numResults = 0;
    if (stateCategoryDoc == null) return numResults;
    let itemResults: any;
    try {
      itemResults = await db.find({
        selector: {
          type: "item",
          name: { $exists: true },
          categoryID: stateCategoryDoc._id
        }
      })
    }
    catch(err) {console.log("err: ",err); return numResults}
    if (itemResults != undefined && itemResults.hasOwnProperty('docs')) {
      numResults = itemResults.docs.length
    }
    return numResults;
  }

  async function getNumberOfListsUsingCategory() {
    let numResults = 0;
    if (stateCategoryDoc == null) return numResults;
    let listResults: any;
    try {
      listResults = await db.find({
        selector: {
          type: "list",
          name: { $exists: true },
          categories: { $elemMatch : { $eq: stateCategoryDoc._id}
        }
      }})
    }
    catch(err) {return numResults}
    if (listResults != undefined && listResults.hasOwnProperty('docs')) {
      numResults = listResults.docs.length
    }
    return numResults;
  }

  async function deleteCategoryFromDB() {
    let catItemDelResponse = await deleteCategoryFromItems(stateCategoryDoc._id);
    if (!catItemDelResponse.successful) {
      setFormError("Unable to remove category from items");
      setDeletingCategory(false);
      return;
    }
    let catListDelResponse = await deleteCategoryFromLists(stateCategoryDoc._id);
    if (!catListDelResponse.successful) {
      setFormError("Unable to remove category from lists");
      setDeletingCategory(false);
      return;
    }
   let catDelResponse = await deleteCategory(stateCategoryDoc);
   if (!catDelResponse.successful) {
     setFormError("Unable to delete category");
     setDeletingCategory(false);
     return;
   }
    goBack("/categories");
    setDeletingCategory(false);
  }

  async function deletePrompt() {
    const numItemsUsed = await getNumberOfItemsUsingCategory();
    const numListsUsed = await getNumberOfListsUsingCategory();
    const subItemText = (numItemsUsed > 0) ? 
      ((numItemsUsed > 1) ? "There are "+numItemsUsed+" items using this category." : "There is 1 item using this category.")
       : "There are no items using this category."
    const subListText = (numListsUsed > 0) ? 
      ((numListsUsed > 1) ? "There are "+numListsUsed+" lists using this category." : "There is 1 list using this category.")
       : "There are no lists using this category."
    setDeletingCategory(true);
    presentAlert({
      header: "Delete this list?",
      subHeader: "Do you really want to delete this list? "+subItemText+ " " + subListText + "  All information on this list will be lost.",
      buttons: [ { text: "Cancel", role: "Cancel" ,
                  handler: () => setDeletingCategory(false)},
                  { text: "Delete", role: "confirm",
                  handler: () => deleteCategoryFromDB()}]
    })
    
    }

  if (stateCategoryDoc.color == undefined) {setStateCategoryDoc((prevState: any) => ({...prevState,color:"#888888"}))};

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Category: {(stateCategoryDoc as any).name}</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen id="main">
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" placeholder="<NEW>" onIonChange={(e: any) => setStateCategoryDoc({...stateCategoryDoc, name: e.detail.value})} value={(stateCategoryDoc as any).name}></IonInput>
            </IonItem>
            <IonItem key="color">
              <IonLabel position="stacked">Color</IonLabel>
              <input type="color" value={stateCategoryDoc.color} onChange={(e: any) => {setStateCategoryDoc((prevState: any) => ({...prevState,color: e.target.value}))}}></input>
            </IonItem>
          </IonList>
          <IonButton onClick={() => updateThisCategory()}>
            <IonIcon slot="start" icon={(mode === "new" ? addOutline : saveOutline)}></IonIcon>
            {(mode === "new") ? "Add" : "Update"}
          </IonButton>
          <IonButton onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>Delete</IonButton>
          <IonButton onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeOutline}></IonIcon>Cancel</IonButton>
      </IonContent>
      <IonFooter>
        <IonLabel>{formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default Category;
