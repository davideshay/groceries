import { IonContent, IonPage, IonButton, IonList, IonInput, 
 IonItem, NavContext, IonIcon, useIonAlert, IonToolbar, IonButtons, IonItemDivider, IonGrid, IonRow, IonCol, IonCheckbox, IonSelect, IonSelectOption, IonFooter, IonModal, IonTitle, IonTextarea} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteGenericDocument,
   useGetOneDoc, useItems, useRecipes } from '../components/Usehooks';
import { cloneDeep } from 'lodash';
import { PouchResponse, HistoryProps, RowType} from '../components/DataTypes';
import { RecipeDoc, InitRecipeDoc, RecipeItem, UomDoc, ItemDoc, ItemDocInit } from '../components/DBSchema';
import { addOutline, closeOutline, pencilOutline, returnDownBackOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { GlobalStateContext } from '../components/GlobalState';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedItemName, translatedUOMName } from '../components/translationUtilities';
import './Recipe.css';
import { findMatchingGlobalItem } from '../components/importUtiliites';
import { createNewItemFromRecipeItem, isRecipeItemOnList, updateItemFromRecipeItem } from '../components/recipeUtilities';
import { usePouch } from 'use-pouchdb';

type PageState = {
  recipeDoc: RecipeDoc,
  needInitDoc: boolean,
  formError: string,
  deletingRecipe: boolean,
  selectedListOrGroupID: string | null
  selectedItemIdx: number,
  modalOpen: boolean
}

const Recipe: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState, setPageState] = useState<PageState>({
      recipeDoc: cloneDeep(InitRecipeDoc),needInitDoc: (mode === "new") ? true: false,
      formError: "",deletingRecipe: false, selectedListOrGroupID: null, selectedItemIdx: 0,
      modalOpen: false
  })
  const db = usePouch();
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
  
  function checkItemOnList(checked: boolean,index: number) {
    let itemsToUpdate=cloneDeep(pageState.recipeDoc.items) as RecipeItem[];
    itemsToUpdate[index].addToList = checked;
    setPageState(prevState => ({...prevState,recipeDoc: {...prevState.recipeDoc,items: itemsToUpdate}}))
  }

  function editItemModal(index: number) {
    setPageState(prevState=>({...prevState,modalOpen: true,selectedItemIdx: index}))
  }

  function updateRecipeName(name: string) {
    let updRecipeDoc: RecipeDoc = cloneDeep(pageState.recipeDoc);
    let globalItemID: null | string = null;
    let newRecipeName: string = "";
    [globalItemID,newRecipeName] = findMatchingGlobalItem(name,globalData);  
    if (globalItemID == null) {
        newRecipeName= name;
    }
    updRecipeDoc.items[pageState.selectedItemIdx].name = newRecipeName;
    updRecipeDoc.items[pageState.selectedItemIdx].globalItemID = globalItemID;
    setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}));
  }

  async function addItemsToList() {
    await present({
      header: "Add Recipe To List",
      subHeader: "Proceed to add items in recipe "+pageState.recipeDoc.name+" to the list",
      buttons: [
          { text: t("general.cancel"), role: "cancel", handler: () => {}},
          { text: t("general.ok"), role: "confirm", handler: () => {addItemsToListDB()}},
          ],
    })
  }

  async function addItemsToListDB() {
    let statusComplete = "Status of adding recipe to list:";
    for (let i = 0; i < pageState.recipeDoc.items.length; i++) {
      const item = pageState.recipeDoc.items[i];
      let newListItem: ItemDoc = cloneDeep(ItemDocInit);
      newListItem.globalItemID = item.globalItemID;
      newListItem.name = item.name;
      const [inList, itemID] = isRecipeItemOnList({recipeItem: item, listOrGroupID: pageState.selectedListOrGroupID,
          globalData});
      if (inList && itemID !== null) {
        let status=await updateItemFromRecipeItem({itemID: itemID, listOrGroupID: pageState.selectedListOrGroupID,
              recipeItem: item, globalData: globalData, settings: globalState.settings, db: db})
        if (status != "") {statusComplete = statusComplete + "\n" + status};   
      } else {
        let status=await createNewItemFromRecipeItem({listOrGroupID: pageState.selectedListOrGroupID,
              recipeItem: item, globalData: globalData, settings: globalState.settings, db: db})
        if (status != "") {statusComplete = statusComplete + "\n" + status};     
      }
    }
    await present({
      header: "Recipe Items added to list",
      message: statusComplete,
      buttons: [
        {text: t("general.ok")}
      ]
    })
  }

  let recipeRows: JSX.Element[] = [];
  pageState.recipeDoc.items.forEach((item,index) => {
    let itemChecked = item.addToList;
    let itemName = translatedItemName(item.globalItemID,item.name)
    let uomDesc = "";
    if (item.recipeUOMName != null && item.recipeUOMName != "") {
        const uomDoc = globalData.uomDocs.find((el: UomDoc) => (el.name === item.recipeUOMName));
        if (uomDoc !== undefined) {
            uomDesc = t("uom."+item.recipeUOMName,{ count: item.recipeQuantity});
        }
    }
    let quantityUOMDesc = "";
    if ((item.recipeQuantity !== 0) && ((item.recipeQuantity > 1) || uomDesc !== "")) {
        quantityUOMDesc = item.recipeQuantity.toString() + ((uomDesc === "" ? "" : " " + uomDesc));
    }
    let fullItemName = itemName;
    if (quantityUOMDesc !== "") { fullItemName = fullItemName + " (" + quantityUOMDesc +")"}
    recipeRows.push(
      <IonRow key={"item-"+index}>
        <IonCol size="2"><IonCheckbox aria-label="" checked={itemChecked} onIonChange={(ev) => checkItemOnList(ev.detail.checked,index)}></IonCheckbox></IonCol>
        <IonCol size="9">{fullItemName}</IonCol>
        <IonCol size="1"><IonButton fill="clear" onClick={() => editItemModal(index)}><IonIcon icon={pencilOutline}/></IonButton></IonCol>
      </IonRow>
    )
  })

  let recipeItem = pageState.selectedItemIdx <= (pageState.recipeDoc.items.length + 1) ? 
      pageState.recipeDoc.items[pageState.selectedItemIdx] : null;

  let modalRecipeItem =  recipeItem !== null && recipeItem !== undefined ? (
    <IonModal id="recipe-item" isOpen={pageState.modalOpen} onDidDismiss={(ev)=>{setPageState(prevState => ({...prevState,modalOpen: false}))}}>
      <IonTitle class="modal-title">Item On Recipe: {recipeItem.name}</IonTitle>
      <IonList>
        <IonItem key="name">
          <IonInput type="text" label="Name" labelPlacement="stacked" value={recipeItem.name} onIonInput={(ev)=>{updateRecipeName(ev.detail.value as string)}}></IonInput>
        </IonItem>
        <IonItem key="r-qty">
          <IonInput type="number" label="Recipe Quantity" labelPlacement="stacked" value={recipeItem.recipeQuantity} onIonInput={(ev) => {
            let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
            updRecipeDoc.items[pageState.selectedItemIdx].recipeQuantity = Number(ev.detail.value);
            setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}));
          }}></IonInput>
        </IonItem>
        <IonItem key="r-uom">
          <IonSelect label="Recipe UOM" labelPlacement="stacked" interface="popover" value={recipeItem.recipeUOMName} onIonChange={(ev) => {
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
          <IonInput type="number" label="Shopping Quantity" labelPlacement="stacked" value={recipeItem.shoppingQuantity} onIonInput={(ev) => {
              let updRecipeDoc: RecipeDoc=cloneDeep(pageState.recipeDoc);
              updRecipeDoc.items[pageState.selectedItemIdx].shoppingQuantity = Number(ev.detail.value);
              setPageState(prevState=>({...prevState,recipeDoc: updRecipeDoc}));
            }}></IonInput>
        </IonItem>  
        <IonItem key="s-uom">
          <IonSelect label="Shopping UOM" labelPlacement="stacked" interface="popover" value={recipeItem.shoppingUOMName} onIonChange={(ev) => {
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
            <IonTextarea label="Note" labelPlacement="stacked" value={recipeItem.note} onIonInput={(ev) => {
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
      <PageHeader title={t("general.editing_recipe")+ pageState.recipeDoc.name } />
      <IonContent>
      {modalRecipeItem}
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
                {recipeRows}
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
                <IonButton onClick={() => addItemsToList()}>{t("general.add_items_to")}</IonButton>
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
          </IonContent>
          <IonFooter>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>
           </IonButtons>
           <IonButtons slot="secondary">
           <IonButton fill="outline" color="secondary" onClick={() => goBack("/recipes")}><IonIcon slot="start" icon={closeOutline}></IonIcon>{t("general.cancel")}</IonButton>
          </IonButtons>
          <IonButtons slot="end">
          <IonButton fill="solid" color="primary" onClick={() => updateThisRecipe()}>
              <IonIcon slot="start" icon={(mode === "new" ? addOutline : saveOutline)}></IonIcon>
              {(mode === "new") ? t("general.add") : t("general.save")}
            </IonButton>
          </IonButtons>
          </IonToolbar>
          </IonFooter>
    </IonPage>
  );
};

export default Recipe;
