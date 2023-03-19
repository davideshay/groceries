import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, 
  IonButtons, IonMenuButton, IonItem, IonLabel, IonFooter, NavContext, IonIcon,
  useIonAlert, IonLoading } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind, usePouch } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteCategoryFromItems, useDeleteGenericDocument,
   useDeleteCategoryFromLists, useGetOneDoc, useLists, useItems } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import './Category.css';
import { PouchResponse, HistoryProps, ItemDoc, ItemList, ListRow, CategoryDoc, InitCategoryDoc } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';
import { addOutline, closeOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';

const Category: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [needInitCategoryDoc,setNeedInitCategoryDoc] = useState((mode === "new") ? true: false);
  const [stateCategoryDoc,setStateCategoryDoc] = useState<CategoryDoc>(InitCategoryDoc);
  const [formError,setFormError] = useState<string>("");
  const [deletingCategory,setDeletingCategory] = useState(false)
  const [presentAlert,dismissAlert] = useIonAlert();
  const updateCategory  = useUpdateGenericDocument();
  const createCategory = useCreateGenericDocument();
  const deleteCategory = useDeleteGenericDocument();
  const deleteCategoryFromItems = useDeleteCategoryFromItems();
  const deleteCategoryFromLists = useDeleteCategoryFromLists();
  const { doc: categoryDoc, loading: categoryLoading} = useGetOneDoc(routeID);
  const { dbError: listError, listRowsLoaded, listRows } = useLists();
  const { dbError: itemError, itemRowsLoaded, itemRows } = useItems();
  const { docs: categoryDocs, loading: categoriesLoading, error: categoriesError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })
  const {goBack} = useContext(NavContext);
  const db = usePouch();
  const screenLoading = useRef(true);

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

  if ( listError || itemError || categoriesError !== null) { return (
    <ErrorPage errorText="Error Loading Category Information... Restart."></ErrorPage>
    )};

  if ( categoryLoading || categoriesLoading || !stateCategoryDoc || deletingCategory || !listRowsLoaded || !itemRowsLoaded)  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonContent><IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false}}
                 message="Loading Data..." >
    </IonLoading></IonContent></IonPage>
  )};
  
  screenLoading.current=false;

  async function updateThisCategory() {
    setFormError("");
    if (stateCategoryDoc.name == undefined || stateCategoryDoc.name == "" || stateCategoryDoc.name == null) {
      setFormError("Must enter a name");
      return false;
    }
    let categoryDup=false;
    (categoryDocs as CategoryDoc[]).forEach((doc) => {
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
    itemRows.forEach( (ir: ItemDoc) => {
      ir.lists.forEach( (list: ItemList) => {
        if (list.categoryID === stateCategoryDoc._id) {
          numResults++;
        }
      })
    })
    return numResults;
  }

  async function getNumberOfListsUsingCategory() {
    let numResults = 0;
    if (stateCategoryDoc == null) return numResults;
    listRows.forEach( (lr: ListRow) => {
      if (lr.listDoc.categories.includes(stateCategoryDoc._id)) {
        numResults++;
      }
    })
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

  if (stateCategoryDoc.color == undefined) {setStateCategoryDoc((prevState) => ({...prevState,color:"#888888"}))};

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Category: {stateCategoryDoc.name}</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
          <IonList>
            <IonItem key="name">
              <IonInput label="Name" labelPlacement="stacked" type="text" placeholder="<NEW>" onIonInput={(e) => setStateCategoryDoc({...stateCategoryDoc, name: String(e.detail.value)})} value={stateCategoryDoc.name}></IonInput>
            </IonItem>
            <IonItem key="color">
              <IonLabel position="stacked">Color</IonLabel>
              <input type="color" value={stateCategoryDoc.color} onChange={(e) => {setStateCategoryDoc((prevState) => ({...prevState,color: e.target.value}))}}></input>
            </IonItem>
          </IonList>
          <IonButton class="ion-float-left" fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>Delete</IonButton>
          <IonButton class="ion-float-right" onClick={() => updateThisCategory()}>
            <IonIcon slot="start" icon={(mode === "new" ? addOutline : saveOutline)}></IonIcon>
            {(mode === "new") ? "Add" : "Save"}
          </IonButton>
          <IonButton class="ion-float-right" fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeOutline}></IonIcon>Cancel</IonButton>
      </IonContent>
      <IonFooter>
        <IonLabel>{formError}</IonLabel>
      </IonFooter>
    </IonPage>
  );
};

export default Category;
