import { IonContent, IonPage, IonButton, IonList, IonInput, 
 IonItem, IonLabel, NavContext, IonIcon, useIonAlert, IonToolbar, IonButtons, IonItemDivider, IonGrid, IonRow, IonCol, IonCheckbox, IonSelect, IonSelectOption} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteGenericDocument,
   useGetOneDoc, useItems, useRecipes } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import { PouchResponse, HistoryProps, ListRow, RowType} from '../components/DataTypes';
import { ItemDoc, ItemList, CategoryDoc, InitCategoryDoc, RecipeDoc, InitRecipeDoc } from '../components/DBSchema';
import { addOutline, closeOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedItemName } from '../components/translationUtilities';

type PageState = {
  recipeDoc: RecipeDoc,
  needInitDoc: boolean,
  formError: string,
  deletingRecipe: boolean,
  selectedListOrGroupID: string | null
}

const Recipe: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState, setPageState] = useState<PageState>({
      recipeDoc: InitRecipeDoc,needInitDoc: (mode === "new") ? true: false,
      formError: "",deletingRecipe: false, selectedListOrGroupID: null
  })
  const [presentAlert,dismissAlert] = useIonAlert();
  const updateRecipe  = useUpdateGenericDocument();
  const createRecipe = useCreateGenericDocument();
  const deleteRecipe = useDeleteGenericDocument();
  const { doc: recipeDoc, loading: recipeLoading, dbError: recipeError} = useGetOneDoc(routeID);
  const { recipeDocs, recipesLoading, recipesError } = useRecipes();
  const { dbError: itemError, itemRowsLoaded, itemRows } = useItems({selectedListGroupID: null, isReady: true, 
        needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const globalData = useContext(GlobalDataContext);
  const { t } = useTranslation();

  useEffect( () => {
    let newRecipeDoc = cloneDeep(pageState.recipeDoc);
    if (!recipeLoading) {
      if (mode === "new" && pageState.needInitDoc) {
        newRecipeDoc = InitRecipeDoc;
        setPageState(prevState => ({...prevState,needInitDoc: false}));
      } else {
        newRecipeDoc = recipeDoc;
      }
      setPageState(prevState => ({...prevState, recipeDoc: newRecipeDoc}))
    }
  },[recipeLoading,recipeDoc]);

  useEffect( () => {
    if (pageState.selectedListOrGroupID === null && globalData.listRowsLoaded && globalData.listCombinedRows.length > 0) {
      setPageState(prevState=>({...prevState,selectedListOrGroupID:globalData.listCombinedRows[0].listOrGroupID}))
    }
  },[globalData.listRowsLoaded,globalData.listCombinedRows])

  if ( globalData.listError || itemError || recipeError) { return (
    <ErrorPage errorText={t("error.loading_recipe") as string}></ErrorPage>
    )};

  if ( recipeLoading || globalData.categoryLoading || !pageState.recipeDoc || pageState.deletingRecipe || !globalData.listRowsLoaded || !itemRowsLoaded)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_recipe")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function updateThisRecipe() {
    setPageState(prevState=>({...prevState,formError:""}))
    if (pageState.recipeDoc.name === undefined || pageState.recipeDoc.name === "" || pageState.recipeDoc.name === null) {
      setPageState(prevState=>({...prevState,formError:t("error.must_enter_a_name") as string}))
      return false;
    }
    let recipeDup=false;
    (recipeDocs).forEach((doc) => {
      if ((doc._id !== pageState.recipeDoc._id) && (doc.name.toUpperCase() === pageState.recipeDoc.name.toUpperCase())) {
        recipeDup = true;
      }
    });
    if (recipeDup) {
      setPageState(prevState=>({...prevState,formError:t("error.duplicate_recipe_name") as string}))
      return
    }
    let result: PouchResponse;
    if ( mode === "new") {
      result = await createRecipe(pageState.recipeDoc);
    } else {
      result = await updateRecipe(pageState.recipeDoc);
    }
    if (result.successful) {
        goBack("/recipes");
    } else {
        setPageState(prevState=>({...prevState,formError:(t("error.updating_recipe") as string) + " " + result.errorCode + " : " + result.errorText + ". " + (t("error.please_retry") as string)}))
    } 
  }
  
  async function deleteRecipeFromDB() {
   let catDelResponse = await deleteRecipe(pageState.recipeDoc);
   if (!catDelResponse.successful) {
    setPageState(prevState=>({...prevState,formError:t("error.unable_delete_recipe") as string, deletingRecipe: false}))
     return;
   }
    goBack("/recipes");
    setPageState(prevState=>({...prevState,deletingRecipe: false}))
  }

  async function deletePrompt() {
    setPageState(prevState=>({...prevState,deletingRecipe: true}));
    presentAlert({
      header: t("general.delete_this_recipe"),
      subHeader: t("general.really_delete_recipe"),
      buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                  handler: () => setPageState(prevState=>({...prevState,deletingRecipe:false}))},
                  { text: t("general.delete"), role: "confirm",
                  handler: () => deleteRecipeFromDB()}]
    })
    
    }

  return (
    <IonPage>
      <PageHeader title={t("general.editing_recipe")+ pageState.recipeDoc.name } />
      <IonContent>
          <IonList>
            <IonItem key="name">
              <IonInput label={t("general.name") as string} labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string} onIonInput={(e) => setPageState(prevState=>({...prevState, recipeDoc: {...prevState.recipeDoc,name: String(e.detail.value)}}))} value={pageState.recipeDoc.name}></IonInput>
            </IonItem>
            <IonItemDivider>{t("general.items_in_recipe")}</IonItemDivider>
            <IonItem key="items-in-recipe">
              <IonGrid>
                <IonRow key="item-header">
                  <IonCol size="2">{t("general.add_question")}</IonCol>
                  <IonCol size="10">{t('general.item')}</IonCol>
                </IonRow>
                { pageState.recipeDoc.items.map((item,index) => (
                  <IonRow key={"item="+index}>
                    <IonCol size="2"><IonCheckbox aria-label="" value={item.addToList}></IonCheckbox></IonCol>
                    <IonCol size="10">{translatedItemName(item.globalItemID,item.name)}</IonCol>
                  </IonRow>
                  ))
                }
              </IonGrid>
            </IonItem>
            <IonItemDivider>{t("general.recipe_steps")}</IonItemDivider>
            <IonItem key="recipesteps">
              <IonGrid>
                { pageState.recipeDoc.instructions.map((step,index) => (
                  <IonRow key={"step-"+index}>
                    <IonCol>{step.stepText}</IonCol>
                  </IonRow>
                  ))
                }
              </IonGrid>
            </IonItem>
            <IonItem key="addtolist">
                <IonButton>{t("general.add_items_to")}</IonButton>
                <IonSelect class="select-list-selector" aria-label="" interface="popover" onIonChange={(ev) => (setPageState(prevState=>({...prevState,selectedListOrGroupID: ev.detail.value})))} value={pageState.selectedListOrGroupID}>
                  { globalData.listCombinedRows.map(lcr => (
                  <IonSelectOption disabled={lcr.rowKey==="G-null"} className={lcr.rowType === RowType.list ? "indented" : ""} key={lcr.listOrGroupID} value={lcr.listOrGroupID}>
                    {lcr.rowName}
                  </IonSelectOption>
                  ))
                  }
                </IonSelect>
            </IonItem>
          </IonList>
          <IonItem>{pageState.formError}</IonItem>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>
           </IonButtons>
           <IonButtons slot="secondary">
           <IonButton fill="outline" color="secondary" onClick={() => goBack("/categories")}><IonIcon slot="start" icon={closeOutline}></IonIcon>{t("general.cancel")}</IonButton>
          </IonButtons>
          <IonButtons slot="end">
          <IonButton fill="solid" color="primary" onClick={() => updateThisRecipe()}>
              <IonIcon slot="start" icon={(mode === "new" ? addOutline : saveOutline)}></IonIcon>
              {(mode === "new") ? t("general.add") : t("general.save")}
            </IonButton>
          </IonButtons>
          </IonToolbar>
      </IonContent>
    </IonPage>
  );
};

export default Recipe;
