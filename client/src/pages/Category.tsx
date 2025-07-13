import { IonContent, IonPage, IonButton, IonList, IonInput, 
 IonItem, IonLabel, NavContext, IonIcon, useIonAlert, IonToolbar, IonButtons, IonText, IonSelect, IonSelectOption, useIonLoading} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteCategoryFromItems, useDeleteGenericDocument,
   useDeleteCategoryFromLists, useAddCategoryToLists, useGetOneDoc, useItems } from '../components/Usehooks';
import './Category.css';
import { PouchResponse, HistoryProps, ListRow, RowType, ListCombinedRows} from '../components/DataTypes';
import { ItemDoc, CategoryDoc, InitCategoryDoc, DefaultColor } from '../components/DBSchema';
import { addCircleOutline, closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName } from '../components/translationUtilities';
import { cloneDeep } from 'lodash-es';
import { GlobalStateContext } from '../components/GlobalState';
import { useGlobalDataStore } from '../components/GlobalData';

enum ErrorLocation  {
   Name, General
}

const FormErrorInit = {  [ErrorLocation.Name]:       {errorMessage:"", hasError: false},
                      [ErrorLocation.General]:    {errorMessage:"", hasError: false}
                    }

const Category: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  let routeCategoryID: string|null = (mode === "new") ? null : routeID;
  const [needInitCategoryDoc,setNeedInitCategoryDoc] = useState(true);
  const [stateCategoryDoc,setStateCategoryDoc] = useState<CategoryDoc>(InitCategoryDoc);
  const [stateColor,setStateColor] = useState<string>(DefaultColor);
  const [formErrors,setFormErrors] = useState(FormErrorInit);
  const [deletingCategory,setDeletingCategory] = useState(false)
  const [presentAlert] = useIonAlert();
  const updateCategory  = useUpdateGenericDocument();
  const createCategory = useCreateGenericDocument();
  const deleteCategory = useDeleteGenericDocument();
  const deleteCategoryFromItems = useDeleteCategoryFromItems();
  const deleteCategoryFromLists = useDeleteCategoryFromLists();
  const addCategoryToLists = useAddCategoryToLists();
  const { doc: categoryDoc, loading: categoryLoading} = useGetOneDoc(routeCategoryID);
  const { itemRowsLoaded, itemRows } = useItems({selectedListGroupID: null, isReady: true, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const {globalState, updateCategoryColor, deleteCategoryColor} = useContext(GlobalStateContext)
  const [presentDeleting,dismissDeleting] = useIonLoading();
  const { t } = useTranslation();
  const error = useGlobalDataStore((state) => state.error);
  const loading = useGlobalDataStore((state) => state.isLoading);
  const listRows = useGlobalDataStore((state) => state.listRows);
  const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
  const categoryDocs = useGlobalDataStore((state) => state.categoryDocs);
  const listCombinedRows = useGlobalDataStore((state) => state.listCombinedRows);


  useEffect( () => {
    let newCategoryDoc: CategoryDoc;
    let newColor: string = DefaultColor;
    if (!categoryLoading && globalState.settingsLoaded && needInitCategoryDoc) {
      if (mode === "new") {
        newCategoryDoc = cloneDeep(InitCategoryDoc);
      } else {
        newCategoryDoc = categoryDoc as CategoryDoc;
        if (globalState.categoryColors.hasOwnProperty(String(newCategoryDoc._id))) {
          newColor =globalState.categoryColors[String(newCategoryDoc._id)];
        }
      }
      setNeedInitCategoryDoc(false);
      setStateCategoryDoc(newCategoryDoc);
      setStateColor(newColor);
    }
  },[globalState.settingsLoaded,categoryLoading,categoryDoc,mode,needInitCategoryDoc,globalState.categoryColors]);

  useEffect( () => {
    if (categoryDoc !== null) {setStateCategoryDoc(categoryDoc)}
  },[categoryDoc])

  if (error) { return (
    <ErrorPage errorText={t("error.loading_category_info") as string}></ErrorPage>
    )};

  if ( categoryLoading || loading || !stateCategoryDoc || deletingCategory || !listRowsLoaded || !itemRowsLoaded)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_category")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  function updateListGroup(updGroup: string) {
    if (stateCategoryDoc.listGroupID !== updGroup) {
      setStateCategoryDoc(prevState => ({...prevState, listGroupID: updGroup}));
    }
  }

  async function updateThisCategory() {
    setFormErrors(prevState=>(FormErrorInit));
    if (stateCategoryDoc.name === undefined || stateCategoryDoc.name === "" || stateCategoryDoc.name === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true}}))
      return false;
    }
    let categoryDup=false;
    (categoryDocs as CategoryDoc[]).forEach((doc) => {
      if ((["system",stateCategoryDoc.listGroupID].includes(String(doc.listGroupID))) && 
          (doc._id !== stateCategoryDoc._id) && 
          (doc.name.toUpperCase() === stateCategoryDoc.name.toUpperCase() || translatedCategoryName(doc._id,doc.name).toUpperCase() === stateCategoryDoc.name.toUpperCase())) {
        categoryDup = true;
      }
    });
    if (categoryDup) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.duplicate_category_name"), hasError: true}}));
      return;
    }
    if (stateCategoryDoc.listGroupID === null || stateCategoryDoc.listGroupID === "") {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.must_select_valid_listgroup_id"), hasError: true}}));
      return;
    }
    let result: PouchResponse;
    let catID: string = "";
    if ( mode === "new") {
      result = await createCategory(stateCategoryDoc);
      if (result.successful) {
        catID = String(result.pouchData.id);
        let catListAddResponse = await addCategoryToLists(catID,stateCategoryDoc.listGroupID,listCombinedRows);
        if (!catListAddResponse.successful) {
          setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.error_adding_category"), hasError: true}}));
          return;
        }
      }
    } else {
      result = await updateCategory(stateCategoryDoc);
      catID = String(stateCategoryDoc._id)
    }
    if (result.successful) {
        await updateCategoryColor(catID,stateColor)
        goBack("/categories");
    } else {
        setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.updating_category"), hasError: true}}))
    } 
  }
  
  async function getNumberOfItemsUsingCategory() {
    let numResults = 0;
    if (stateCategoryDoc === null) return numResults;
    itemRows.forEach( (ir: ItemDoc) => {
      for (const list of ir.lists) {
        if (list.categoryID === stateCategoryDoc._id) {
          numResults++;
          break;
        }
      }
    })
    return numResults;
  }

  async function getNumberOfListsUsingCategory() {
    let numResults = 0;
    if (stateCategoryDoc === null) return numResults;
    listRows.forEach( (lr: ListRow) => {
      if (lr.listDoc.categories.includes(String(stateCategoryDoc._id))) {
        numResults++;
      }
    })
    return numResults;
  }

  async function deleteCategoryFromDB() {
    presentDeleting(String(t("general.deleting_category")));
    let catItemDelResponse = await deleteCategoryFromItems(String(stateCategoryDoc._id));
    if (!catItemDelResponse.successful) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_category_items"), hasError: true}}))
      setDeletingCategory(false);
      dismissDeleting();
      return;
    }
    let catListDelResponse = await deleteCategoryFromLists(String(stateCategoryDoc._id));
    if (!catListDelResponse.successful) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_category_lists"), hasError: true}}))
      setDeletingCategory(false);
      dismissDeleting();
      return;
    }
   let catDelResponse = await deleteCategory(stateCategoryDoc);
   if (!catDelResponse.successful) {
     setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_delete_category"), hasError: true}}))
     setDeletingCategory(false);
     dismissDeleting();
     return;
   }
    await deleteCategoryColor(String(stateCategoryDoc._id));
    dismissDeleting();
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
      header: t("general.delete_this_category",{ category: stateCategoryDoc.name}),
      subHeader: t("general.really_delete_category") +" " + subItemText+ " " + subListText + " " + t("general.all_category_info_lost"),
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
          <IonList className="ion-no-padding" lines="none">
            <IonItem key="name">
              <IonInput label={t("general.name") as string} disabled={stateCategoryDoc._id?.startsWith("system:cat")}
              labelPlacement="stacked" type="text" placeholder="<NEW>"
              onIonInput={(e) => setStateCategoryDoc({...stateCategoryDoc, name: String(e.detail.value)})}
              value={translatedCategoryName(stateCategoryDoc._id,stateCategoryDoc.name)}
              className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
              errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="listgroup">
              <IonSelect disabled={mode!=="new"} key="listgroupsel" label={t("general.list_group") as string} labelPlacement='stacked' interface="popover" onIonChange={(e) => updateListGroup(e.detail.value)} value={stateCategoryDoc.listGroupID}>
                { (cloneDeep(listCombinedRows) as ListCombinedRows).filter(lr => (lr.rowType === RowType.listGroup)).map((lr) => 
                  ( <IonSelectOption key={lr.rowKey} value={lr.listGroupID} disabled={lr.listGroupID === "system"}>{lr.listGroupName}</IonSelectOption> )
                )}
              </IonSelect>
            </IonItem>
            <IonItem key="color">
              <IonLabel position="stacked">{t("general.color")}</IonLabel>
              <input type="color" value={stateColor} onChange={(e) => {setStateColor((prevState) => (e.target.value))}}></input>
            </IonItem>
          </IonList>
          <IonItem lines="none"  key="formerror">{formErrors[ErrorLocation.General].hasError ? <IonText color="danger">{formErrors[ErrorLocation.General].errorMessage}</IonText> : <></>}</IonItem>
          <IonToolbar>
            { !stateCategoryDoc._id?.startsWith("system:cat:") ?
            <IonButtons slot="start">
              <IonButton fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>
           </IonButtons> : <></> }
           <IonButtons slot="secondary">
           <IonButton fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.cancel")}</IonButton>
          </IonButtons>
          <IonButtons slot="end">
          <IonButton fill="solid" color="primary" className="primary-button" onClick={() => updateThisCategory()}>
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
