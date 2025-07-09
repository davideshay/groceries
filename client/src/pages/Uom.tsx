import { IonContent, IonPage, IonButton, IonList, IonInput, 
 IonItem, NavContext, IonIcon, useIonAlert, IonToolbar, IonButtons, IonItemDivider, IonGrid, IonRow, IonCol, IonText, IonFooter, IonSelect, IonSelectOption, useIonLoading} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useDeleteGenericDocument,
    useGetOneDoc, useItems } from '../components/Usehooks';
import { cloneDeep, isEmpty } from 'lodash-es';
import { PouchResponse, HistoryProps, RowType, ListCombinedRows} from '../components/DataTypes';
import { ItemDoc, UomDoc, InitUomDoc } from '../components/DBSchema';
import { add, addCircleOutline, closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedUOMName } from '../components/translationUtilities';
import { useDeleteUomFromItems, useDeleteUomFromRecipes } from '../components/uomUtilities';
import { useGlobalDataStore } from '../components/GlobalData';

type PageState = {
  uomDoc: UomDoc,
  needInitUomDoc: boolean,
  deletingUom: boolean
}

enum ErrorLocation  {
   Name, Description, PluralDescription, Alternate, General
}
const FormErrorInit = {
  [ErrorLocation.Name]: {errorMessage:"", hasError: false},
  [ErrorLocation.Description]: {errorMessage:"", hasError: false},
  [ErrorLocation.PluralDescription]: {errorMessage:"", hasError: false},
  [ErrorLocation.Alternate]: {errorMessage:"",hasError: false},
  [ErrorLocation.General]: {errorMessage:"", hasError: false} }

const Uom: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    uomDoc: InitUomDoc, needInitUomDoc: true,
    deletingUom: false
  })
  const [formErrors,setFormErrors] = useState(FormErrorInit);
  const [presentAlert] = useIonAlert();
  const [presentDeleting,dismissDeleting] = useIonLoading();
  const updateUom  = useUpdateGenericDocument();
  const createUom = useCreateGenericDocument();
  const deleteUom = useDeleteGenericDocument();
  const deleteUomFromItems = useDeleteUomFromItems();
  const deleteUomFromRecipes = useDeleteUomFromRecipes();
  const { doc: uomDoc, loading: uomLoading} = useGetOneDoc(routeID);
  const { dbError: itemError, itemRowsLoaded, itemRows } = useItems({selectedListGroupID: null, isReady: true, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const error = useGlobalDataStore((state) => state.error);
  const isLoading = useGlobalDataStore((state) => state.isLoading);
  const recipeDocs = useGlobalDataStore((state) => state.recipeDocs);
  const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
  const uomDocs = useGlobalDataStore((state) => state.uomDocs);
  const listCombinedRows = useGlobalDataStore((state) => state.listCombinedRows);
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const { t } = useTranslation();

  useEffect( () => {
    if (!uomLoading && pageState.needInitUomDoc) {
      let newUomDoc: UomDoc 
      if (mode === "new") {
        newUomDoc = cloneDeep(InitUomDoc);
      } else {
        newUomDoc = uomDoc;
      }
      setPageState(prevState => ({...prevState,needInitUomDoc: false, uomDoc: newUomDoc}))
    }
  },[uomLoading,uomDoc,pageState.needInitUomDoc,mode]);

  if ( error || itemError ) { return (
    <ErrorPage errorText={t("error.loading_uom") as string}></ErrorPage>
    )};

  if ( uomLoading || isLoading || !pageState.uomDoc || pageState.deletingUom || !listRowsLoaded || !itemRowsLoaded)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_uom")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function updateThisUom() {
    setFormErrors(prevState=>(FormErrorInit));
    if (isEmpty(pageState.uomDoc.name)) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true }}));
      return false;
    }
    if (isEmpty(pageState.uomDoc.description)) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Description]: {errorMessage: t("error.must_enter_description"), hasError: true }}));
      return false;
    }
    if (isEmpty(pageState.uomDoc.pluralDescription)) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.PluralDescription]: {errorMessage: t("error.must_enter_plural_description"), hasError: true }}));
      return false;
    }
    if (isEmpty(pageState.uomDoc.listGroupID)) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.must_select_valid_listgroup_id"), hasError: true }}));
      return false;
    }
    let uomDup=false;
    (uomDocs).forEach((doc) => {
      if ((doc._id !== pageState.uomDoc._id) && 
      (["system",pageState.uomDoc.listGroupID].includes(doc.listGroupID)) && (
          (doc.name.toUpperCase() === pageState.uomDoc.name.toUpperCase()) || 
          (doc.description.toUpperCase() === pageState.uomDoc.description.toUpperCase()) ||
          (doc.pluralDescription.toUpperCase() === pageState.uomDoc.pluralDescription.toUpperCase()) ) )
      {
        uomDup = true;
      }
    });
    if (uomDup) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.duplicate_uom_name"), hasError: true }}));
      return false;
    }

    let blanks=false;
    pageState.uomDoc.customAlternates?.forEach(alt => {
      if (isEmpty(alt)) { blanks=true};
    })
    if (blanks) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Alternate]: {errorMessage: t("error.blank_alternate_uom"), hasError: true }}));
      return false;      
    }

    // check alt dups
    let upperAlternates = pageState.uomDoc.alternates!.map(el => (el.replace(/\W|_/g, '').toUpperCase()))
    let upperCustomAlternates = pageState.uomDoc.customAlternates!.map(el => (el.replace(/\W|_/g, '').toUpperCase()))
    let combinedAlts = upperAlternates.concat(upperCustomAlternates);
    let combinedSet = new Set(combinedAlts);
    if (combinedAlts.length !== combinedSet.size) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Alternate]: {errorMessage: t("error.duplicate_alt_uom"), hasError: true }}));
      return false;
    }
    
    let result: PouchResponse;
    if ( mode === "new") {
      result = await createUom(pageState.uomDoc);
    } else {
      result = await updateUom(pageState.uomDoc);
    }
    if (result.successful) {
        goBack("/uoms");
    } else {
        setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.updating_uom")+" " + result.errorCode + " : " + result.errorText + ". " + (t("error.please_retry") as string), hasError: true }}));
    } 
  }

  function updateListGroup(updGroup: string) {
    if (pageState.uomDoc.listGroupID !== updGroup) {
      setPageState(prevState => ({...prevState,uomDoc: {...prevState.uomDoc,listGroupID: updGroup}}))
    }
  }
  
  async function getNumberOfItemsUsingUom() {
    let numResults = 0;
    if (pageState.uomDoc === null) return numResults;
    itemRows.forEach( (ir: ItemDoc) => {
      for (const list of ir.lists) {
        if (list.uomName === pageState.uomDoc.name) {
          numResults++;
          break;
        }
      }
    })
    return numResults;
  }

  async function getNumberOfRecipesUsingUom() {
    let numResults = 0;
    if (pageState.uomDoc === null) return numResults;
    recipeDocs.forEach(recipe => {
      for (const recItem of recipe.items) {
        if (String(recItem.recipeUOMName).toUpperCase() === pageState.uomDoc.name.toUpperCase() || 
            String(recItem.shoppingUOMName).toUpperCase() === pageState.uomDoc.name.toUpperCase()) {
              numResults++;
              break;
            } 
      }
    })
    return numResults;
  }

  async function deleteUomFromDB() {
    presentDeleting(String(t("general.deleting_uom")));
    let uomItemDelResponse = await deleteUomFromItems(String(pageState.uomDoc.name));
    if (!uomItemDelResponse.successful) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_uom_items"), hasError: true }}));
      setPageState(prevState=>({...prevState,deletingUom: false }))
      dismissDeleting()
      return false;
    }
    let uomRecipeDelResponse = await deleteUomFromRecipes(String(pageState.uomDoc.name));
    if (!uomRecipeDelResponse.successful) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_uom_recipes"), hasError: true }}));
      setPageState(prevState=>({...prevState,deletingUom: false}))
      dismissDeleting();
      return false;
    }
   let uomDelResponse = await deleteUom(pageState.uomDoc);
   if (!uomDelResponse.successful) {
    setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_delete_uom"), hasError: true }}));
    setPageState(prevState=>({...prevState,deletingUom: false }))
    dismissDeleting();
    return false;
   }
    dismissDeleting();
    goBack("/uoms");
    setPageState(prevState=>({...prevState,deletingUom: false }));
  }

  async function deletePrompt() {
    const numItemsUsed = await getNumberOfItemsUsingUom();
    const numRecipesUsed = await getNumberOfRecipesUsingUom();
    const subItemText = t("general.items_using_uom",{count: numItemsUsed});
    const subListText = t("general.recipes_using_uom",{count: numRecipesUsed});
    setPageState(prevState=>({...prevState,deletingUom: true}));
    presentAlert({
      header: t("general.delete_this_uom", {uom: pageState.uomDoc.description}),
      subHeader: t("general.really_delete_uom") +" "+subItemText+ " " + subListText + " " + t("general.all_uom_info_lost"),
      buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                  handler: () => setPageState(prevState=>({...prevState,deletingUom: false})) },
                  { text: t("general.delete"), role: "confirm",
                  handler: () => deleteUomFromDB()}]
    })
    }
  
  function updateCustomAlternateUom(index: number, value: string) {
    let newAlternates=cloneDeep(pageState.uomDoc.customAlternates) as (string[])
    newAlternates[index]=value;
    setPageState(prevState=>({...prevState,uomDoc: {...prevState.uomDoc,customAlternates: newAlternates}}))
  }

  function addNewCustom() {
      if (isEmpty(pageState.uomDoc.customAlternates)) {
        setPageState(prevState=>({...prevState,uomDoc:{...prevState.uomDoc,customAlternates: [""]}}));
      } else {
        let newAlts = cloneDeep(pageState.uomDoc.customAlternates) as (string[]);
        newAlts.push("");
        setPageState(prevState=>({...prevState,uomDoc:{...prevState.uomDoc,customAlternates: newAlts}}))
      }
  }

  function deleteCustom(index: number) {
    let newAlts = cloneDeep(pageState.uomDoc.customAlternates) as (string[]);
    newAlts.splice(index,1);
    setPageState(prevState=>({...prevState,uomDoc:{...prevState.uomDoc,customAlternates: newAlts}}))
  }

  return (
    <IonPage>
      <PageHeader title={t("general.editing_uom")+ " " + translatedUOMName(String(pageState.uomDoc._id),pageState.uomDoc.description,pageState.uomDoc.pluralDescription)  } />
      <IonContent>
          <IonList className="ion-no-padding">
            <IonItem key="listgroup">
              <IonSelect disabled={mode!=="new"} key="listgroupsel" label={t("general.list_group") as string} labelPlacement='stacked' interface="popover" onIonChange={(e) => updateListGroup(e.detail.value)} value={pageState.uomDoc.listGroupID}>
                { (cloneDeep(listCombinedRows) as ListCombinedRows).filter(lr => (lr.rowType === RowType.listGroup)).map((lr) => 
                  ( <IonSelectOption key={lr.rowKey} value={lr.listGroupID} disabled={lr.listGroupID === "system"}>{lr.listGroupName}</IonSelectOption> )
                )}
              </IonSelect>
            </IonItem>

            <IonItem key="name">
              <IonInput label={t("general.uom_code") as string} disabled={pageState.uomDoc._id?.startsWith("system:uom")}
                        labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string}
                        onIonInput={(e) => setPageState(prevState=>({...prevState, uomDoc:{...prevState.uomDoc,  name: String(e.detail.value)}}))}
                        value={pageState.uomDoc.name}
                        className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
                        errorText={formErrors[ErrorLocation.Name].errorMessage}>
            </IonInput>
            </IonItem>
            <IonItem key="description">
              <IonInput label={t("general.description") as string} disabled={pageState.uomDoc._id?.startsWith("system:uom")}
                        labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string}
                        onIonInput={(e) => setPageState(prevState=>({...prevState, uomDoc:{...prevState.uomDoc,  description: String(e.detail.value)}}))}
                        value={translatedUOMName(String(pageState.uomDoc._id),pageState.uomDoc.description,pageState.uomDoc.pluralDescription,1)}
                        className={"ion-touched "+(formErrors[ErrorLocation.Description].hasError ? "ion-invalid": "")}
                        errorText={formErrors[ErrorLocation.Description].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="plural_description">
              <IonInput label={t("general.plural_description") as string} disabled={pageState.uomDoc._id?.startsWith("system:uom")}
                        labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string}
                        onIonInput={(e) => setPageState(prevState=>({...prevState, uomDoc:{...prevState.uomDoc,  pluralDescription: String(e.detail.value)}}))}
                        value={translatedUOMName(String(pageState.uomDoc._id),pageState.uomDoc.pluralDescription,pageState.uomDoc.pluralDescription,2)}
                        className={"ion-touched "+(formErrors[ErrorLocation.PluralDescription].hasError ? "ion-invalid": "")}
                        errorText={formErrors[ErrorLocation.PluralDescription].errorMessage}>
             </IonInput>
            </IonItem>
            <IonItemDivider>{t("general.alternate_abbreviations")}</IonItemDivider>
              {formErrors[ErrorLocation.Alternate].hasError ? <IonItem className="shorter-item-some-padding" lines="none"><IonText color="danger">{formErrors[ErrorLocation.Alternate].errorMessage}</IonText></IonItem> : <></>}
            {
              pageState.uomDoc._id?.startsWith("system:uom") ?
              pageState.uomDoc.alternates?.map((alt,index) => (
                <IonItem key={"altuom"+(index)}>
                  <IonInput aria-label="" disabled={pageState.uomDoc._id?.startsWith("system:uom")} type="text" placeholder={t("general.new_placeholder") as string} value={pageState.uomDoc.alternates![index]}></IonInput>
                </IonItem>
              )) : <></>
            }
            <IonGrid>
            { 
              pageState.uomDoc.customAlternates?.map((alt,index) => (
                <IonRow key={"custaltuom"+(index)}>
                  <IonCol size="10">
                    <IonInput aria-label="" type="text" placeholder={t("general.new_placeholder") as string} onIonInput={(e) => updateCustomAlternateUom(index,String(e.detail.value))}  value={pageState.uomDoc.customAlternates![index]}></IonInput>                  
                  </IonCol>
                  <IonCol size="2">
                    <IonButton onClick={() => deleteCustom(index)}><IonIcon icon={trashOutline}></IonIcon></IonButton>
                  </IonCol>
                </IonRow>
              ))}
            </IonGrid>  
            <IonItem>
              <IonButton onClick={() => addNewCustom()}><IonIcon icon={add}></IonIcon></IonButton>
            </IonItem>
          </IonList>
          <IonFooter className="floating-error-footer">
            {formErrors[ErrorLocation.General].hasError ? <IonItem className="shorter-item-some-padding" lines="none"><IonText color="danger">{formErrors[ErrorLocation.General].errorMessage}</IonText></IonItem> : <></>}         
          <IonToolbar>
            { pageState.uomDoc._id?.startsWith("system:uom") ? <></> :
            <IonButtons slot="start">
              <IonButton fill="outline" color="danger" onClick={() => deletePrompt()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>
           </IonButtons>}
           <IonButtons slot="secondary">
           <IonButton fill="outline" color="secondary" onClick={() => goBack("/uoms")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.cancel")}</IonButton>
          </IonButtons>
          <IonButtons slot="end">
          <IonButton fill="solid" color="primary" className="primary-button" onClick={() => updateThisUom()}>
              <IonIcon slot="start" icon={(mode === "new" ? addCircleOutline : saveOutline)}></IonIcon>
              {(mode === "new") ? t("general.add") : t("general.save")}
            </IonButton>
          </IonButtons>
          </IonToolbar>
          </IonFooter>
      </IonContent>
    </IonPage>
  );
};

export default Uom;
