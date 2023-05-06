import { IonContent, IonPage, IonButton, IonList, IonInput, 
 IonItem, IonLabel, NavContext, IonIcon, useIonAlert, IonToolbar, IonButtons} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteCategoryFromItems, useDeleteGenericDocument,
   useDeleteCategoryFromLists, useGetOneDoc, useItems } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import './Category.css';
import { PouchResponse, HistoryProps, ListRow, RowType} from '../components/DataTypes';
import { ItemDoc, ItemList, CategoryDoc, InitCategoryDoc } from '../components/DBSchema';
import { addCircleOutline, closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName } from '../components/translationUtilities';

enum ErrorLocation  {
   Name, PluralName, General
}

const FormErrorInit = {  [ErrorLocation.Name]:       {errorMessage:"", hasError: false},
                      [ErrorLocation.General]:    {errorMessage:"", hasError: false}
                    }

const Category: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [needInitCategoryDoc,setNeedInitCategoryDoc] = useState((mode === "new") ? true: false);
  const [stateCategoryDoc,setStateCategoryDoc] = useState<CategoryDoc>(InitCategoryDoc);
  const [formErrors,setFormErrors] = useState(FormErrorInit);
  const [deletingCategory,setDeletingCategory] = useState(false)
  const [presentAlert,dismissAlert] = useIonAlert();
  const updateCategory  = useUpdateGenericDocument();
  const createCategory = useCreateGenericDocument();
  const deleteCategory = useDeleteGenericDocument();
  const deleteCategoryFromItems = useDeleteCategoryFromItems();
  const deleteCategoryFromLists = useDeleteCategoryFromLists();
  const { doc: categoryDoc, loading: categoryLoading} = useGetOneDoc(routeID);
  const { dbError: itemError, itemRowsLoaded, itemRows } = useItems({selectedListGroupID: null, isReady: true, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const globalData = useContext(GlobalDataContext);
  const { t } = useTranslation();

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

  if ( globalData.listError || itemError || globalData.categoryError !== null) { return (
    <ErrorPage errorText={t("error.loading_category_info") as string}></ErrorPage>
    )};

  if ( categoryLoading || globalData.categoryLoading || !stateCategoryDoc || deletingCategory || !globalData.listRowsLoaded || !itemRowsLoaded)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_category")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function updateThisCategory() {
    setFormErrors(prevState=>(FormErrorInit));
    if (stateCategoryDoc.name === undefined || stateCategoryDoc.name === "" || stateCategoryDoc.name === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true}}))
      return false;
    }
    let categoryDup=false;
    (globalData.categoryDocs as CategoryDoc[]).forEach((doc) => {
      if ((doc._id !== stateCategoryDoc._id) && (doc.name.toUpperCase() === stateCategoryDoc.name.toUpperCase())) {
        categoryDup = true;
      }
    });
    if (categoryDup) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.duplicate_category_name"), hasError: true}}))
      return
    }
    let result: PouchResponse;
    if ( mode === "new") {
      result = await createCategory(stateCategoryDoc);
    } else {
      result = await updateCategory(stateCategoryDoc);
    }
    if (result.successful) {
        goBack("/categories");
    } else {
        setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.updating_category"), hasError: true}}))
    } 
  }
  
  async function getNumberOfItemsUsingCategory() {
    let numResults = 0;
    if (stateCategoryDoc === null) return numResults;
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
    if (stateCategoryDoc === null) return numResults;
    globalData.listRows.forEach( (lr: ListRow) => {
      if (lr.listDoc.categories.includes(String(stateCategoryDoc._id))) {
        numResults++;
      }
    })
    return numResults;
  }

  async function deleteCategoryFromDB() {
    let catItemDelResponse = await deleteCategoryFromItems(String(stateCategoryDoc._id));
    if (!catItemDelResponse.successful) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_category_items"), hasError: true}}))
      setDeletingCategory(false);
      return;
    }
    let catListDelResponse = await deleteCategoryFromLists(String(stateCategoryDoc._id));
    if (!catListDelResponse.successful) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_category_lists"), hasError: true}}))
      setDeletingCategory(false);
      return;
    }
   let catDelResponse = await deleteCategory(stateCategoryDoc);
   if (!catDelResponse.successful) {
     setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_delete_category"), hasError: true}}))
     setDeletingCategory(false);
     return;
   }
    goBack("/categories");
    setDeletingCategory(false);
  }

  async function deletePrompt() {
    const numItemsUsed = await getNumberOfItemsUsingCategory();
    const numListsUsed = await getNumberOfListsUsingCategory();
    const subItemText = t("general.items_using_category",{count: numItemsUsed});
    const subListText = t("general.lists_using_category",{count: numListsUsed});
    setDeletingCategory(true);
    presentAlert({
      header: t("general.delete_this_list"),
      subHeader: t("general.really_delete_list") +subItemText+ " " + subListText + " " + t("general.all_list_info_lost"),
      buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                  handler: () => setDeletingCategory(false)},
                  { text: t("general.delete"), role: "confirm",
                  handler: () => deleteCategoryFromDB()}]
    })
    
    }

  if (stateCategoryDoc.color === undefined) {setStateCategoryDoc((prevState) => ({...prevState,color:"#888888"}))};

  return (
    <IonPage>
      <PageHeader title={t("general.editing_category")+ translatedCategoryName(stateCategoryDoc._id,stateCategoryDoc.name)  } />
      <IonContent>
          <IonList lines="none">
            <IonItem key="name">
              <IonInput label={t("general.name") as string} disabled={stateCategoryDoc._id?.startsWith("system:cat")}
              labelPlacement="stacked" type="text" placeholder="<NEW>"
              onIonInput={(e) => setStateCategoryDoc({...stateCategoryDoc, name: String(e.detail.value)})}
              value={translatedCategoryName(stateCategoryDoc._id,stateCategoryDoc.name)}
              className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
              errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="color">
              <IonLabel position="stacked">{t("general.color")}</IonLabel>
              <input type="color" value={stateCategoryDoc.color} onChange={(e) => {setStateCategoryDoc((prevState) => ({...prevState,color: e.target.value}))}}></input>
            </IonItem>
          </IonList>
          <IonItem>{formErrors[ErrorLocation.General].hasError ? formErrors[ErrorLocation.General].errorMessage : <></>}</IonItem>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>
           </IonButtons>
           <IonButtons slot="secondary">
           <IonButton fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.cancel")}</IonButton>
          </IonButtons>
          <IonButtons slot="end">
          <IonButton fill="solid" color="primary" onClick={() => updateThisCategory()}>
              <IonIcon slot="start" icon={(mode === "new" ? addCircleOutline : saveOutline)}></IonIcon>
              {(mode === "new") ? t("general.add") : t("general.save")}
            </IonButton>
          </IonButtons>
          </IonToolbar>
      </IonContent>
    </IonPage>
  );
};

export default Category;
