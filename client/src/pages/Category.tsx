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
    setFormError("");
    if (stateCategoryDoc.name === undefined || stateCategoryDoc.name === "" || stateCategoryDoc.name === null) {
      setFormError(t("error.must_enter_a_name") as string);
      return false;
    }
    let categoryDup=false;
    (globalData.categoryDocs as CategoryDoc[]).forEach((doc) => {
      if ((doc._id !== stateCategoryDoc._id) && (doc.name.toUpperCase() === stateCategoryDoc.name.toUpperCase())) {
        categoryDup = true;
      }
    });
    if (categoryDup) {
      setFormError(t("error.duplicate_category_name") as string);
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
        setFormError((t("error.updating_category") as string) + " " + result.errorCode + " : " + result.errorText + ". " + (t("error.please_retry") as string));
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
      setFormError(t("error.unable_remove_category_items") as string);
      setDeletingCategory(false);
      return;
    }
    let catListDelResponse = await deleteCategoryFromLists(String(stateCategoryDoc._id));
    if (!catListDelResponse.successful) {
      setFormError(t("error.unable_remove_category_lists") as string);
      setDeletingCategory(false);
      return;
    }
   let catDelResponse = await deleteCategory(stateCategoryDoc);
   if (!catDelResponse.successful) {
     setFormError(t("error.unable_delete_category") as string);
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
          <IonList>
            <IonItem key="name">
              <IonInput label={t("general.name") as string} disabled={stateCategoryDoc._id?.startsWith("system:cat")} labelPlacement="stacked" type="text" placeholder="<NEW>" onIonInput={(e) => setStateCategoryDoc({...stateCategoryDoc, name: String(e.detail.value)})} value={translatedCategoryName(stateCategoryDoc._id,stateCategoryDoc.name)}></IonInput>
            </IonItem>
            <IonItem key="color">
              <IonLabel position="stacked">{t("general.color")}</IonLabel>
              <input type="color" value={stateCategoryDoc.color} onChange={(e) => {setStateCategoryDoc((prevState) => ({...prevState,color: e.target.value}))}}></input>
            </IonItem>
          </IonList>
          <IonItem>{formError}</IonItem>
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
