import { IonContent, IonPage, IonButton, IonList, IonInput, 
 IonItem, NavContext, IonIcon, useIonAlert, IonToolbar, IonButtons, IonItemDivider, IonGrid, IonRow, IonCol, IonCheckbox, IonSelect, IonSelectOption, IonFooter, IonModal, IonTitle, IonTextarea, useIonLoading, IonText} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteGenericDocument,
   useGetOneDoc, useItems, useRecipes } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import { PouchResponse, HistoryProps, RowType} from '../components/DataTypes';
import { RecipeDoc, InitRecipeDoc, RecipeItem, UomDoc, ItemDoc, ItemDocInit, GlobalItemDoc, RecipeInstruction } from '../components/DBSchema';
import { add, addCircleOutline, closeCircleOutline, pencilOutline, returnDownBackOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { GlobalStateContext } from '../components/GlobalState';
import PageHeader from '../components/PageHeader';
import RecipeItemSearch, { RecipeSearchData } from '../components/RecipeItemSearch';
import { useTranslation } from 'react-i18next';
import { translatedItemName, translatedUOMName } from '../components/translationUtilities';
import './Recipe.css';
import { findMatchingGlobalItem } from '../components/importUtilities';
import { createNewItemFromRecipeItem, isRecipeItemOnList, updateItemFromRecipeItem } from '../components/recipeUtilities';
import { usePouch } from 'use-pouchdb';
import { RecipeItemInit } from '../components/DBSchema';
let fracty = require('fracty');

type PageState = {
  recipeDoc: RecipeDoc,
  needInitDoc: boolean,
  deletingRecipe: boolean,
  selectedListOrGroupID: string | null
  selectedItemIdx: number,
  modalOpen: boolean,
  addingInProcess: boolean,
}

enum ErrorLocation  {
   Name, General
}
const FormErrorInit = { [ErrorLocation.Name]:       {errorMessage:"", hasError: false},
                        [ErrorLocation.General]:    {errorMessage:"", hasError: false}
                    }

const Recipe: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState, setPageState] = useState<PageState>({
      recipeDoc: cloneDeep(InitRecipeDoc),needInitDoc: (mode === "new") ? true: false,
      deletingRecipe: false, selectedListOrGroupID: null, selectedItemIdx: 0,
      modalOpen: false, addingInProcess: false
  })
  const [formErrors,setFormErrors] = useState(FormErrorInit);
  const db = usePouch();
  const [presentAlert,dismissAlert] = useIonAlert();
  const [presentLoading, dismissLoading] = useIonLoading();
  const updateRecipe  = useUpdateGenericDocument();
  const createRecipe = useCreateGenericDocument();
  const deleteRecipe = useDeleteGenericDocument();
  const { doc: recipeDoc, loading: recipeLoading, dbError: recipeError} = useGetOneDoc(routeID);
  const { recipeDocs, recipesLoading, recipesError } = useRecipes();
  const { dbError: itemError, itemRowsLoaded } = useItems({selectedListGroupID: null, isReady: true, 
        needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const globalData = useContext(GlobalDataContext);
  const { globalState } =useContext(GlobalStateContext);
  const { t } = useTranslation();
  const [ present, dismiss] = useIonAlert();

  useEffect( () => {
    let newRecipeDoc = cloneDeep(pageState.recipeDoc);
    if (!recipeLoading) {
      if (mode === "new" && pageState.needInitDoc) {
        newRecipeDoc = cloneDeep(InitRecipeDoc);
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

  if ( globalData.listError !== null || itemError || ( mode !== "new" && recipeError) || recipesError) { return (
    <ErrorPage errorText={t("error.loading_recipe") as string}></ErrorPage>
    )};

  if ( recipeLoading || recipesLoading || globalData.categoryLoading || !pageState.recipeDoc || pageState.deletingRecipe || !globalData.listRowsLoaded || !itemRowsLoaded || pageState.addingInProcess)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_recipe")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function updateThisRecipe() {
    setFormErrors(prevState=>(FormErrorInit));
    if (pageState.recipeDoc.name === undefined || pageState.recipeDoc.name === "" || pageState.recipeDoc.name === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true }}));
      return false;
    }
    let recipeDup=false;
    (recipeDocs).forEach((doc) => {
      if ((doc._id !== pageState.recipeDoc._id) && (doc.name.toUpperCase() === pageState.recipeDoc.name.toUpperCase())) {
        recipeDup = true;
      }
    });
    if (recipeDup) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.duplicate_recipe_name"), hasError: true }}));
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
        setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: (t("error.updating_recipe") as string) + " " + result.errorCode + " : " + result.errorText + ". " + (t("error.please_retry") as string), hasError: true }}));
    } 
  }
  
  async function deleteRecipeFromDB() {
   let catDelResponse = await deleteRecipe(pageState.recipeDoc);
   if (!catDelResponse.successful) {
    setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_delete_recipe"), hasError: true }}));

    setPageState(prevState=>({...prevState,deletingRecipe: false}))
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
  
  function checkItemOnList(checked: boolean,index: number) {
    let itemsToUpdate=cloneDeep(pageState.recipeDoc.items) as RecipeItem[];
    itemsToUpdate[index].addToList = checked;
    setPageState(prevState => ({...prevState,recipeDoc: {...prevState.recipeDoc,items: itemsToUpdate}}))
  }

  function deleteItemFromList(index: number) {
    let itemsToUpdate=cloneDeep(pageState.recipeDoc.items) as RecipeItem[];
    itemsToUpdate.splice(index,1);
    setPageState(prevState => ({...prevState,recipeDoc: {...prevState.recipeDoc,items: itemsToUpdate}}))
  }

  function editItemModal(index: number) {
    setPageState(prevState=>({...prevState,modalOpen: true,selectedItemIdx: index}))
  }

  function updateRecipeName(name: string) {
    let updRecipeDoc: RecipeDoc = cloneDeep(pageState.recipeDoc);
    let globalItemID: null | string = null;
    let matchGlobalItem: GlobalItemDoc;
    let newRecipeName: string = "";
    [globalItemID,newRecipeName,matchGlobalItem] = findMatchingGlobalItem(name,globalData);  
    if (globalItemID == null) {
        newRecipeName= name;
    }
    updRecipeDoc.items[pageState.selectedItemIdx].name = newRecipeName;
    updRecipeDoc.items[pageState.selectedItemIdx].globalItemID = globalItemID;
    setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}));
  }

  function updateRecipeStep(index: number, step: string) {
    let updRecipeSteps: RecipeInstruction[] = cloneDeep(pageState.recipeDoc.instructions);
    updRecipeSteps[index].stepText=step;
    setPageState(prevState=>({...prevState,recipeDoc: {...prevState.recipeDoc,instructions: updRecipeSteps}}))
  }

  function deleteRecipeStep(index: number) {
    let updRecipeSteps: RecipeInstruction[] = cloneDeep(pageState.recipeDoc.instructions);
    updRecipeSteps.splice(index,1);
    setPageState(prevState=>({...prevState,recipeDoc:{...prevState.recipeDoc,instructions: updRecipeSteps}}));
  }

  function addRecipeStep() {
    let updRecipeSteps: RecipeInstruction[] = cloneDeep(pageState.recipeDoc.instructions);
    updRecipeSteps.push({stepText: ""});
    setPageState(prevState=>({...prevState,recipeDoc:{...prevState.recipeDoc,instructions: updRecipeSteps}}));
  }

  function addExistingRecipeItem(id: string, data: RecipeSearchData) {
    let updItems: RecipeItem[] = cloneDeep(pageState.recipeDoc.items);
    let newItem:RecipeItem = cloneDeep(RecipeItemInit);
    newItem.addToList = true;
    newItem.globalItemID = data.globalItemID;
    newItem.name=translatedItemName(id,data.name);    
    updItems.push(newItem)
    setPageState(prevState=>({...prevState,recipeDoc:{...prevState.recipeDoc,items: updItems}}))
  }

  function addNewRecipeItem(name: string) {
    let updItems: RecipeItem[] = cloneDeep(pageState.recipeDoc.items);
    let newItem:RecipeItem = cloneDeep(RecipeItemInit);
    newItem.addToList = true;
    newItem.globalItemID = null;
    newItem.name=name;
    updItems.push(newItem)
    setPageState(prevState=>({...prevState,recipeDoc:{...prevState.recipeDoc,items: updItems}}))
  }

  async function addItemsToList() {
    await present({
      header: t("general.add_recipe_to_list"),
      subHeader: t("general.add_items_in_recipe",{recipeName: pageState.recipeDoc.name}),
      buttons: [
          { text: t("general.cancel"), role: "cancel", handler: () => {}},
          { text: t("general.ok"), role: "confirm", handler: () => {addItemsToListDB()}},
          ],
    })
  }

  async function addItemsToListDB() {
    presentLoading(t("general.adding_recipe_to_list") as string);
    let statusComplete = t("general.status_adding_recipe");
    setPageState(prevState=>({...prevState,addingInProcess: true}));
    for (let i = 0; i < pageState.recipeDoc.items.length; i++) {
      const item = pageState.recipeDoc.items[i];
      let newListItem: ItemDoc = cloneDeep(ItemDocInit);
      newListItem.globalItemID = item.globalItemID;
      newListItem.name = item.name;
      const [inList, itemID] = await isRecipeItemOnList({recipeItem: item, listOrGroupID: pageState.selectedListOrGroupID,
          globalData, db: db});
      if (inList && itemID !== null) {
        let status=await updateItemFromRecipeItem({itemID: itemID, listOrGroupID: pageState.selectedListOrGroupID,
              recipeItem: item, globalData: globalData, settings: globalState.settings, db: db})
        if (status !== "") {statusComplete = statusComplete + "\n" + status};   
      } else {
        let status=await createNewItemFromRecipeItem({listOrGroupID: pageState.selectedListOrGroupID,
              recipeItem: item, globalData: globalData, settings: globalState.settings, db: db})
        if (status !== "") {statusComplete = statusComplete + "\n" + status};     
      }
    }
    dismissLoading();
    setPageState(prevState=>({...prevState,addingInProcess: false}));
    await present({
      header: t("general.recipe_items_added_to_list"),
      message: statusComplete,
      cssClass: "import-status-alert",
      buttons: [
        {text: t("general.ok")}
      ]
    })
  }

  let recipeRows: JSX.Element[] = [];
  pageState.recipeDoc.items.forEach((item,index) => {
    let itemChecked = item.addToList;
    let itemName = translatedItemName(item.globalItemID,item.name,item.recipeQuantity)
    let uomDesc = "";
    if (item.recipeUOMName !== null && item.recipeUOMName !== "") {
        const uomDoc = globalData.uomDocs.find((el: UomDoc) => (el.name === item.recipeUOMName));
        if (uomDoc !== undefined) {
            uomDesc = t("uom."+item.recipeUOMName,{ count: item.recipeQuantity});
        }
    }
    let quantityUOMDesc = "";
    if ((item.recipeQuantity !== 0) && ((item.recipeQuantity > 1) || uomDesc !== "")) {
        quantityUOMDesc = fracty(item.recipeQuantity).toString() + ((uomDesc === "" ? "" : " " + uomDesc));
    }
    let fullItemName = itemName;
    if (quantityUOMDesc !== "") { fullItemName = fullItemName + " (" + quantityUOMDesc +")"}
    recipeRows.push(
      <IonRow key={"item-"+index}>
        <IonCol size="2"><IonCheckbox aria-label="" checked={itemChecked} onIonChange={(ev) => checkItemOnList(ev.detail.checked,index)}></IonCheckbox></IonCol>
        <IonCol size="8">{fullItemName}</IonCol>
        <IonCol size="1"><IonButton fill="clear" onClick={() => editItemModal(index)}><IonIcon icon={pencilOutline}/></IonButton></IonCol>
        <IonCol size="1"><IonButton fill="clear" onClick={() => deleteItemFromList(index)}><IonIcon icon={trashOutline} /></IonButton></IonCol>
      </IonRow>
    )
  })

  let recipeItem = pageState.selectedItemIdx <= (pageState.recipeDoc.items.length + 1) ? 
      pageState.recipeDoc.items[pageState.selectedItemIdx] : null;

  let modalRecipeItem =  recipeItem !== null && recipeItem !== undefined ? (
    <IonModal id="recipe-item" isOpen={pageState.modalOpen} onDidDismiss={(ev)=>{setPageState(prevState => ({...prevState,modalOpen: false}))}}>
      <IonTitle class="modal-title">{t('general.item_on_recipe') + translatedItemName(recipeItem.globalItemID,recipeItem.name)}</IonTitle>
      <IonList>
        <IonItem key="name">
          <IonInput type="text" label={t("general.name") as string} labelPlacement="stacked" value={translatedItemName(recipeItem.globalItemID,recipeItem.name)} onIonInput={(ev)=>{updateRecipeName(ev.detail.value as string)}}></IonInput>
        </IonItem>
        <IonItem key="r-qty">
          <IonInput type="number" label={t("general.recipe_quantity") as string} labelPlacement="stacked" value={recipeItem.recipeQuantity} onIonInput={(ev) => {
            let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
            updRecipeDoc.items[pageState.selectedItemIdx].recipeQuantity = Number(ev.detail.value);
            setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}));
          }}></IonInput>
        </IonItem>
        <IonItem key="r-uom">
          <IonSelect label={t("general.recipe_uom") as string} labelPlacement="stacked" interface="popover" value={recipeItem.recipeUOMName} onIonChange={(ev) => {
            let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
            updRecipeDoc.items[pageState.selectedItemIdx].recipeUOMName = ev.detail.value;
            setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}))   }}>
              <IonSelectOption key="uom-undefined" value={null}>{t('general.no_uom')}</IonSelectOption>
              {globalData.uomDocs.map((uom) => (
                      <IonSelectOption key={uom.name} value={uom.name}>
                        {translatedUOMName(uom._id as string,uom.description)}
                      </IonSelectOption>
                    ))}
          </IonSelect>
        </IonItem>
        <IonItem key="s-qty">
          <IonInput type="number" label={t("general.shopping_quantity") as string} labelPlacement="stacked" value={recipeItem.shoppingQuantity} onIonInput={(ev) => {
              let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
              updRecipeDoc.items[pageState.selectedItemIdx].shoppingQuantity = Number(ev.detail.value);
              setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}));
            }}></IonInput>
        </IonItem>  
        <IonItem key="s-uom">
          <IonSelect label={t("general.shopping_uom") as string} labelPlacement="stacked" interface="popover" value={recipeItem.shoppingUOMName} onIonChange={(ev) => {
            let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
            updRecipeDoc.items[pageState.selectedItemIdx].shoppingUOMName = ev.detail.value;
            setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}))   }}>
              <IonSelectOption key="uom-undefined" value={null}>{t('general.no_uom')}</IonSelectOption>
              {globalData.uomDocs.map((uom) => (
                      <IonSelectOption key={uom.name} value={uom.name}>
                        {translatedUOMName(uom._id as string,uom.description)}
                      </IonSelectOption>
                    ))}
          </IonSelect>
        </IonItem>
        <IonItem key="note">
            <IonTextarea label={t("general.note") as string} labelPlacement="stacked" value={recipeItem.note} onIonInput={(ev) => {
            let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
            updRecipeDoc.items[pageState.selectedItemIdx].note = String(ev.detail.value);
            setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}))   }}>
            </IonTextarea>
        </IonItem>
        <IonItem key="button">
          <IonButton fill="solid" onClick={()=>{setPageState(prevState=>({...prevState,modalOpen: false}))}}><IonIcon icon={returnDownBackOutline}></IonIcon>Go Back</IonButton>
        </IonItem>
      </IonList>
    </IonModal>
  ) : <></>

  return (
    <IonPage>
      <PageHeader title={t("general.editing_recipe")+" "+pageState.recipeDoc.name } />
      <IonContent>
      {modalRecipeItem}
          <IonList>
            <IonItem key="name">
              <IonInput label={t("general.name") as string} labelPlacement="stacked" type="text"
                        placeholder={t("general.new_placeholder") as string}
                        onIonInput={(e) => setPageState(prevState=>({...prevState, recipeDoc: {...prevState.recipeDoc,name: String(e.detail.value)}}))}
                        value={pageState.recipeDoc.name}
                        className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
                        errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItemDivider class="category-divider">{t("general.items_in_recipe")}</IonItemDivider>
            <IonItem key="items-in-recipe">
              <IonGrid>
                <IonRow key="item-header">
                  <IonCol size="2">{t("general.add_question")}</IonCol>
                  <IonCol size="10">{t('general.item')}</IonCol>
                </IonRow>
                {recipeRows}
              </IonGrid>
            </IonItem>
            <RecipeItemSearch rowSelected={addExistingRecipeItem} addItemWithoutRow={addNewRecipeItem}/>
            <IonItemDivider class="category-divider">{t("general.recipe_steps")}</IonItemDivider>
            <IonItem key="recipesteps">
              <IonGrid>
                { pageState.recipeDoc.instructions.map((step,index) => (
                  <IonRow key={"step-"+index}>
                    <IonCol size="11"><IonTextarea autoGrow={true} aria-label="" class="recipe-step" value={step.stepText} onIonInput={(ev) => updateRecipeStep(index,String(ev.detail.value))}></IonTextarea></IonCol>
                    <IonCol size="1"><IonButton onClick={() => deleteRecipeStep(index)} fill="clear"><IonIcon icon={trashOutline}/></IonButton></IonCol>
                  </IonRow>
                  ))
                }
                <IonRow key="addastep">
                  <IonCol><IonButton onClick={() => addRecipeStep()}><IonIcon icon={add} /></IonButton></IonCol>
                </IonRow>
              </IonGrid>
            </IonItem>
          </IonList>
          </IonContent>
          <IonFooter>
            {formErrors[ErrorLocation.General].hasError ? <IonItem className="shorter-item-some-padding" lines="none"><IonText color="danger">{formErrors[ErrorLocation.General].errorMessage}</IonText></IonItem> : <></>}
            <IonGrid>
              <IonRow class="ion-justify-content-center ion-align-items-center">
                <IonCol size="5">
                  <IonButton size="small" className='extra-small-button'  onClick={() => addItemsToList()}>{t("general.add_items_to")}</IonButton>
                </IonCol>
                <IonCol size="7">
                <IonSelect class="select-list-selector" aria-label="" interface="popover" onIonChange={(ev) => (setPageState(prevState=>({...prevState,selectedListOrGroupID: ev.detail.value})))} value={pageState.selectedListOrGroupID}>
                  { globalData.listCombinedRows.map(lcr => (
                  <IonSelectOption disabled={lcr.rowKey==="G-null"} className={lcr.rowType === RowType.list ? "indented" : ""} key={lcr.listOrGroupID} value={lcr.listOrGroupID}>
                    {lcr.rowName}
                  </IonSelectOption>
                  ))
                  }
                </IonSelect>
                </IonCol>
              </IonRow>  
            </IonGrid>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>
            </IonButtons>
            <IonButtons slot="secondary">
            <IonButton fill="outline" color="secondary" onClick={() => goBack("/recipes")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.cancel")}</IonButton>
            </IonButtons>
            <IonButtons slot="end">
            <IonButton fill="solid" color="primary" onClick={() => updateThisRecipe()}>
                <IonIcon slot="start" icon={(mode === "new" ? addCircleOutline : saveOutline)}></IonIcon>
                {(mode === "new") ? t("general.add") : t("general.save")}
              </IonButton>
            </IonButtons>
            </IonToolbar>
          </IonFooter>
    </IonPage>
  );
};

export default Recipe;
