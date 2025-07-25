import { IonContent, IonPage, IonButton, IonList, IonInput, IonItem,
  IonSelect, IonIcon, 
  IonSelectOption, useIonAlert,useIonToast, IonTextarea, IonGrid, IonRow, IonCol, IonText, IonCard,
  IonCardSubtitle, NavContext, IonButtons, IonToolbar, IonImg, IonFooter } from '@ionic/react';
import { addCircleOutline, closeCircleOutline, trashOutline, saveOutline } from 'ionicons/icons';
import { usePhotoGallery } from '../components/Usehooks';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument, useAddCategoryToLists, 
    useDeleteGenericDocument, useGetOneDoc, useItems, pictureSrcPrefix } from '../components/Usehooks';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty, remove } from 'lodash-es';
import './Item.css';
import ItemLists from '../components/ItemLists';
import { getCommonKey, createEmptyItemDoc, checkNameInGlobalItems  } from '../components/ItemUtilities';
import { PouchResponse, ListRow, RowType, PouchResponseInit} from '../components/DataTypes';
import { UomDoc, ItemDoc, ItemDocInit, ItemList, ItemListInit, CategoryDoc, ImageDoc, ImageDocInit, InitUomDoc, InitCategoryDoc, CategoryDocs } from '../components/DBSchema';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName, translatedItemName, translatedUOMName } from '../components/translationUtilities';
import log from "../components/logger";
import { useGlobalDataStore } from '../components/GlobalData';

enum ErrorLocation  {
   Name, PluralName, General
}

const FormErrorInit = {  [ErrorLocation.Name]:       {errorMessage:"", hasError: false},
                      [ErrorLocation.PluralName]: {errorMessage:"", hasError: false},
                      [ErrorLocation.General]:    {errorMessage:"", hasError: false}
                    }

const Item: React.FC = () => {
  const { mode, itemid } = useParams<{mode: string, itemid: string}>();
  const routeItemID = (mode === "new" ? null : itemid)
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState<ItemDoc>(ItemDocInit);
  const [stateImageDoc,setStateImageDoc] = useState<ImageDoc>(ImageDocInit);
  const [formErrors,setFormErrors] = useState(FormErrorInit);

  const updateItem  = useUpdateGenericDocument();
  const updateImage = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const addImage = useCreateGenericDocument();
  const addCategoryToLists = useAddCategoryToLists();
  const addCategoryDoc = useCreateGenericDocument();
  const addUOMDoc = useCreateGenericDocument();
  const delItem = useDeleteGenericDocument();
  const delImage = useDeleteGenericDocument();
  const { doc: itemDoc, loading: itemLoading, dbError: itemError } = useGetOneDoc(routeItemID);
  const { doc: imageDoc, loading: imageLoading, dbError: imageError} = useGetOneDoc(stateItemDoc.imageID)
  const screenLoading = useRef(true);
  const {goBack} = useContext(NavContext);
  const { takePhoto } = usePhotoGallery();
  const { dbError: itemsError, itemRowsLoaded, itemRows } = useItems({selectedListGroupID: stateItemDoc.listGroupID, isReady: !itemLoading, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const { globalState, setStateInfo} = useContext(GlobalStateContext);
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const { t } = useTranslation();
  const listRows = useGlobalDataStore((state) => state.listRows);
  const listDocs = useGlobalDataStore((state) => state.listDocs);
  const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
  const listCombinedRows = useGlobalDataStore((state) => state.listCombinedRows);
  const error = useGlobalDataStore((state) => state.error);
  const isLoading = useGlobalDataStore((state) => state.isLoading);
  const globalItemDocs = useGlobalDataStore((state) => state.globalItemDocs);
  const categoryDocs = useGlobalDataStore((state) => state.categoryDocs);
  const uomDocs = useGlobalDataStore((state) => state.uomDocs);
  
  const groupIDForList = useCallback((listID: string) => {
    let retGID="";
    const searchList=listRows.find((el: ListRow) => el.listDoc._id === listID);
    if (searchList) {retGID = String(searchList.listGroupID)}
    return retGID;
  },[listRows])

  const addDeleteLists = useCallback((itemDoc: ItemDoc) => {
    const newItemDoc: ItemDoc =cloneDeep(itemDoc);
    // loop through all the lists with the same listgroup. if the list is in the
    // listgroup, but not on the item add it.
    for (let i = 0; i < listRows.length; i++) {
      if (listRows[i].listGroupID !== newItemDoc.listGroupID) {continue}
      const foundIdx=newItemDoc.lists.findIndex((el: ItemList) => el.listID === listRows[i].listDoc._id)
      if (foundIdx === -1) {
          const newItemList: ItemList = cloneDeep(ItemListInit);
          newItemList.listID = String(listRows[i].listDoc._id);
          newItemList.active = getCommonKey(itemDoc,"active",listDocs);
          newItemList.categoryID = getCommonKey(itemDoc,"categoryID",listDocs);
          newItemList.completed = getCommonKey(itemDoc,"completed",listDocs);
          newItemList.note = getCommonKey(itemDoc,"note",listDocs);
          newItemList.quantity = getCommonKey(itemDoc,"quantity",listDocs);
          newItemList.stockedAt = getCommonKey(itemDoc,"stockedAt",listDocs);
          newItemList.uomName = getCommonKey(itemDoc,"uomName",listDocs);
          newItemDoc.lists.push(newItemList);
      }  
    }
    // now loop through all the lists on the item, and see if they are in the right listgroup.
    // if not, delete the list from the item
    const currentLists: ItemList[]=cloneDeep(newItemDoc.lists);
    remove(currentLists, (list: ItemList) => { return groupIDForList(list.listID) !== newItemDoc.listGroupID})
    // check if any of the item-lists has a categoryID that is no longer in the active categories 
    // in the list, if so, set to null
    for (const itemList of currentLists) {
      const listDoc = listDocs.find(list => list._id === itemList.listID);
      if (listDoc === undefined)  { // shouldn't happen at list point... 
          itemList.categoryID = null
      } else {
        if (!listDoc.categories.includes(String(itemList.categoryID))) {itemList.categoryID = null}
      }
    }
    newItemDoc.lists=currentLists;
    return(newItemDoc);
  },[listRows,listDocs,groupIDForList])

  useEffect( () => {
    if (!itemLoading && mode !== "new" && itemDoc && listRowsLoaded) {
      let newItemDoc: ItemDoc = cloneDeep(itemDoc);
      if (!Object.prototype.hasOwnProperty.call(newItemDoc, 'imageID')) {
        newItemDoc.imageID = null;
      }
      if (!Object.prototype.hasOwnProperty.call(newItemDoc, 'pluralName')) {
        newItemDoc.pluralName = "";
      }
      newItemDoc = addDeleteLists(newItemDoc);
      setStateItemDoc(cloneDeep(newItemDoc));
    }
  },[itemLoading,mode,itemDoc,listRowsLoaded,addDeleteLists])

  useEffect( () => {
    if (!imageLoading && mode !== "new" && imageDoc) {
      setStateImageDoc(imageDoc);
    }
  },[imageLoading,mode,imageDoc])

  useEffect( () => {
    if (!itemLoading && mode === "new" && !isLoading && listRowsLoaded && needInitItemDoc) {
        const newItemDoc = createEmptyItemDoc(listRows,globalState,globalItemDocs)
        setStateInfo("newItemMode","none");
        setNeedInitItemDoc(false);
        setStateItemDoc(newItemDoc);
    }
  },[globalState,mode,setStateInfo,itemLoading,itemDoc,isLoading,listDocs,listRowsLoaded, listRows, globalItemDocs,globalState.itemMode,globalState.newItemName, globalState.callingListID, needInitItemDoc]);

  if (itemError || imageError || error ||  itemsError) { 
    log.error("Error loading item info:",cloneDeep({itemError,imageError,listError: error, itemsError}));
    return (
    <ErrorPage errorText={t("error.loading_item_info_restart") as string}></ErrorPage>
  )}

  if ((itemLoading && routeItemID !== null) || isLoading || !listRowsLoaded || !itemRowsLoaded || isEmpty(stateItemDoc))  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_item")}  /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };

  screenLoading.current=false;
  
  async function updateThisItem() {
    setFormErrors(FormErrorInit);
    let result: PouchResponse = cloneDeep(PouchResponseInit);
    let imgResult: PouchResponse = cloneDeep(PouchResponseInit);
    const newItemDoc: ItemDoc = cloneDeep(stateItemDoc);
    if (stateItemDoc.name === undefined || stateItemDoc.name==="" || stateItemDoc.name === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true}}))
      return false;
    }
    if (isEmpty(stateItemDoc.pluralName) && (stateItemDoc.globalItemID === null)) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.PluralName]: {errorMessage: t("error.must_enter_a_plural_name"), hasError: true}}))
      setStateItemDoc(prevState => ({...prevState,pluralName: prevState.name}))
      return false;
    }
    if (isEmpty(stateItemDoc.pluralName) && (stateItemDoc.globalItemID !== null)) {
      newItemDoc.pluralName = translatedItemName(stateItemDoc.globalItemID,stateItemDoc.name,stateItemDoc.name,2);
    }
    let alreadyExists = false;
    itemRows.forEach((ir) => {
      if ( ir._id !== stateItemDoc._id  && ir.listGroupID === stateItemDoc.listGroupID &&
        (ir.name.toUpperCase() === stateItemDoc.name.toUpperCase() ||
         (ir.name.toUpperCase() === stateItemDoc.pluralName?.toUpperCase() && !isEmpty(stateItemDoc.pluralName))||
         ir.pluralName?.toUpperCase() === stateItemDoc.name.toUpperCase() ||
         (ir.pluralName?.toUpperCase() === stateItemDoc.pluralName?.toUpperCase() && !isEmpty(stateItemDoc.pluralName))
      )) {
        alreadyExists = true;
      }
    })
    if (alreadyExists) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.cannot_use_name_existing_item"), hasError: true}}))
      return false;
    }
    const [globalExists,] = checkNameInGlobalItems(globalItemDocs,stateItemDoc.name, String(stateItemDoc.pluralName));
    if ( stateItemDoc.globalItemID == null && globalExists) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.cannot_use_name_existing_globalitem"), hasError: true}}))
      return false;
    }
    if ((mode === "new" && stateImageDoc.imageBase64 !== null) ||
         (mode !== "new" && stateImageDoc.imageBase64 !== null && (newItemDoc.imageID === null))) {
          stateImageDoc.listGroupID=stateItemDoc.listGroupID;
          imgResult = await addImage(stateImageDoc);
          newItemDoc.imageID = imgResult.pouchData.id as string;
    } else if (mode !== "new" && stateImageDoc.imageBase64 !== null && newItemDoc.imageID !== null && newItemDoc.imageID !== undefined) { 
        stateImageDoc.listGroupID=stateItemDoc.listGroupID;
        imgResult = await updateImage(stateImageDoc);
        newItemDoc.imageID = imgResult.pouchData.id as string;
    } else if (mode !== "new" && stateImageDoc._id !== null && stateImageDoc._id !== undefined && stateItemDoc.imageID === null){
        imgResult = await delImage(stateImageDoc);
    }

    if (mode === "new") {
      result = await addItem(newItemDoc);
    }  
    else {
      result = await updateItem(newItemDoc);
    }
    if (result.successful) {
      goBack();
    } else {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.PluralName]: {errorMessage: t("error.updating_item"), hasError: true}}))
    }
  }

  function updateAllKey(key: string, val: string | boolean | number| null) {
    const newItemDoc: ItemDoc = cloneDeep(stateItemDoc);
    newItemDoc.lists.forEach((list: ItemList) => {
      if (key === "categoryID") {
        const listDoc = listDocs.find(ld => ld._id === list.listID);
        if (listDoc !== undefined) {
          if (listDoc.categories.includes(String(val))) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (list as any)[key] = val;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (list as any)[key] = null;
          }
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (list as any)[key] = val;
      }
    })
    setStateItemDoc(newItemDoc);
  }

  async function addNewCategory(listGroupID: string, category: string) {
    let alreadyFound=false;
    (categoryDocs as CategoryDoc[]).forEach((cat) => 
      {
        if ( ["system",listGroupID].includes(String(cat.listGroupID))  && category.toUpperCase() === cat.name.toUpperCase()) {alreadyFound=true}
      });
    if (alreadyFound) {
      presentToast({message: t("error.duplicate_category_name"), duration: 1500, position: "middle"})
    } else {  
      const newCategoryDoc: CategoryDoc = cloneDeep(InitCategoryDoc);
      newCategoryDoc.listGroupID = listGroupID;
      newCategoryDoc.name = category;
      const result = await addCategoryDoc(newCategoryDoc);
      if (result.successful) {
          updateAllKey("categoryID",result.pouchData.id as string);
          const addResponse = await addCategoryToLists(result.pouchData.id as string,listGroupID,listCombinedRows)
          if (addResponse.successful) {
            const newStateItemDoc: ItemDoc = cloneDeep(stateItemDoc);
            for (const stateList of newStateItemDoc.lists) {
              stateList.categoryID = result.pouchData.id as string;
            }
            setStateItemDoc(newStateItemDoc);
          } else {
            presentToast({message: t("error.adding_category"),
            duration: 1500, position: "middle"})
          }

      } else {
        presentToast({message: t("error.adding_category"),
              duration: 1500, position: "middle"})
      }  
    }  
  }

  async function addNewUOM(listGroupID: string, uomData: UomDoc) {
    let alreadyFound = false;
    (uomDocs as UomDoc[]).forEach((uom) => {
      if (["system",listGroupID].includes(String(uom.listGroupID)) && uom.name.toUpperCase() === uomData.name.toUpperCase()) {alreadyFound=true;}
    });
    if (alreadyFound) {
      presentToast({message: t("error.uom_exists"), duration: 1500, position: "middle"});
      return false;
    }
    if (uomData.name.length > 2) {
      presentToast({message: t("error.uom_length_error"), duration: 1500, position: "middle"});
      return false;
    }
    uomData.name = uomData.name.toUpperCase();
    if (uomData.description === "") {
      presentToast({message: t("error.no_uom_description"), duration: 1500, position: "middle"});
      return false;
    }
    alreadyFound = false;
    (uomDocs as UomDoc[]).forEach((uom) => {
      if (["system",listGroupID].includes(String(uom.listGroupID)) && uom.description.toUpperCase() === uomData.description.toUpperCase()) {alreadyFound=true;}
    });
    if (alreadyFound) {
      presentToast({message: t("error.uom_description_exists"), duration: 1500, position: "middle"});
      return false;
    }
    if (uomData.pluralDescription === "") {
      presentToast({message: t("error.no_uom_plural_description"), duration: 1500, position: "middle"});
      return false;
    }
    alreadyFound = false;
    (uomDocs as UomDoc[]).forEach((uom) => {
      if (["system",listGroupID].includes(String(uom.listGroupID)) && uom.pluralDescription.toUpperCase() === uomData.pluralDescription.toUpperCase()) {alreadyFound=true;}
    });
    if (alreadyFound) {
      presentToast({message: t("error.uom_plural_description_exists"), duration: 1500, position: "middle"});
      return false;
    }
    const newUOMDoc: UomDoc = cloneDeep(InitUomDoc);
    newUOMDoc.listGroupID = listGroupID;
    newUOMDoc.name = uomData.name;
    newUOMDoc.description = uomData.description;
    newUOMDoc.pluralDescription = uomData.pluralDescription;
    const result = await addUOMDoc(newUOMDoc);
    if (result.successful) {
        updateAllKey("uomName",uomData.name);
    } else {
      presentToast({message: t("error.adding_uom"),
            duration: 1500, position: "middle"})
    }  
  }

  function addCategoryPopup() {
    if (stateItemDoc.listGroupID === null || stateItemDoc.listGroupID === "") {
      presentAlert({
        header: t("cannot_create_category_no_listgroup_selected"),
        buttons: [ {text: t("general.ok"), role: 'confirm'}]
      })
    } else {
      presentAlert({
        header: t("general.add_new_category"),
        inputs: [ {name: "category", type: "text"}],
        buttons: [ { text: t("general.cancel"), role: 'cancel'},
                  { text: t("general.add"), role: 'confirm',
                  handler: (alertData) => {addNewCategory(String(stateItemDoc.listGroupID),alertData.category)}}
                  ]    
      })
    } 
  }

  function addUOMPopup() {
    if (stateItemDoc.listGroupID === null || stateItemDoc.listGroupID === "") {
      presentAlert({
        header: t("cannot_create_category_no_listgroup_selected"),
        buttons: [ {text: t("general.ok"), role: 'confirm'}]
      })
    } else {  
      presentAlert({
        header: t("general.add_new_uom"),
        inputs: [ {name: "name", placeholder: t("general.name"), max: "2", type: "text"},
                  {name:"description", placeholder: t("general.description"), type:"text"},
                  {name:"pluralDescription", placeholder: t("general.plural_description"),type:"text"}],
        buttons: [ {text: t("general.cancel"), role: "cancel"},
                  {text: t("general.add"), role: "confirm", handler: (alertData) => {addNewUOM(String(stateItemDoc.listGroupID) ,alertData)}}
      ]
      })
    }
  }  

  async function deleteItemFromDB() {
      setFormErrors(FormErrorInit);
      const result: PouchResponse = await delItem(stateItemDoc);
      if (result.successful) {
        goBack();
      } else {
        setFormErrors(prevState => ({...prevState,[ErrorLocation.PluralName]: {errorMessage: t("error.updating_item"), hasError: true}}))
      }
  }

  function deleteItem() {
    presentAlert({
      header: t("general.delete_this_item"),
      subHeader: t("general.really_delete_this_item"),
      buttons: [ { text: t("general.cancel"), role: "Cancel"},
                 { text: t("general.delete"), role: "confirm",
                  handler: () => deleteItemFromDB()}]
    })
  }
  
  async function getNewPhoto() {
    const newPhoto = await takePhoto();
    if (newPhoto !== undefined && newPhoto !== null) {
      setStateImageDoc(prevState => ({...prevState, imageBase64: (newPhoto as string)}))
    }
    else { log.error("Photo undefined....")};
  }

  function deletePhoto() {
    setStateItemDoc(prevState => ({...prevState,imageID: null}));
    setStateImageDoc(prevState => ({...prevState,imageBase64: null}));
  }

  const thisListGroup = listCombinedRows.find(el => el.listGroupID === stateItemDoc.listGroupID);
  const photoExists = stateImageDoc.imageBase64 !== null;
  
  let photoBase64: string = "";    
  if (photoExists) {
    photoBase64=pictureSrcPrefix + stateImageDoc.imageBase64;
  }

  function getCombinedCategories(): CategoryDocs {
    const catDocs:CategoryDocs = [];
    const activeCatIDs = new Set<string>();
    for (const list of stateItemDoc.lists) {
      const thisList = listDocs.find(ld => ld._id === list.listID);
      if (thisList !== undefined) {
        for (const cat of thisList.categories) {
          activeCatIDs.add(cat)
        }
      } 
    }
    activeCatIDs.forEach(catID => {
      const catDoc = categoryDocs.find(cat => cat._id === catID);
      if (catDoc !== undefined) {
        catDocs.push(catDoc);
      }
    })
    return catDocs.sort(function (a,b) {
      return translatedCategoryName(a._id,a.name).toUpperCase().localeCompare(translatedCategoryName(b._id,b.name).toUpperCase())});
  }


  return (
    <IonPage>
      <PageHeader title={t("general.editing_item")+" "+ translatedItemName(stateItemDoc.globalItemID,stateItemDoc.name,stateItemDoc.pluralName)} />
      <IonContent>
          <IonList lines="none" className="ion-no-padding">
            <IonItem key="name">
              <IonInput disabled={stateItemDoc.globalItemID != null} label={t("general.name") as string}
                        labelPlacement="stacked" type="text" onIonInput={(e) => setStateItemDoc({...stateItemDoc, name: String(e.detail.value)})}
                        value={translatedItemName(stateItemDoc.globalItemID,stateItemDoc.name,stateItemDoc.pluralName,1)}
                        className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
                        errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="pluralname">
              <IonInput disabled={stateItemDoc.globalItemID != null} label={t("general.plural_name") as string}
                        labelPlacement="stacked" type="text" onIonInput={(e) => setStateItemDoc({...stateItemDoc, pluralName: String(e.detail.value)})}
                        value={translatedItemName(stateItemDoc.globalItemID,(stateItemDoc.pluralName!),stateItemDoc.pluralName,2)}
                        className={"ion-touched "+(formErrors[ErrorLocation.PluralName].hasError ? "ion-invalid" : "")}
                        errorText={formErrors[ErrorLocation.PluralName].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="listgroup">
              <IonText >{t("general.list_group") + ": "}  {thisListGroup?.listGroupName}</IonText>
            </IonItem>
            <IonItem key="photo">
              {photoExists ? <IonImg className="item-image" src={photoBase64}/> : <></>}
            </IonItem>
            <IonItem key="photobuttons">
              <IonButton onClick={() => getNewPhoto()}>{t("general.take_photo")}</IonButton>
              <IonButton onClick={() => {deletePhoto()}}>{t("general.delete_photo")}</IonButton>
            </IonItem>
            <IonCard>
              <IonCardSubtitle>{t("general.change_here_change_all_below")}</IonCardSubtitle>
              <IonItem key="quantity">
                <IonGrid className="ion-no-padding">
                <IonRow>
                  <IonCol className="ion-no-padding" size="3"><IonInput label={t("general.quantity") as string} labelPlacement="stacked" type="number" min="0" max="9999" onIonInput={(e) => updateAllKey("quantity",Number(e.detail.value))} value={getCommonKey(stateItemDoc,"quantity",listDocs)}></IonInput></IonCol>
                  <IonCol className="ion-no-padding" size="8">
                    <IonSelect label={t("general.uom_abbrev") as string} labelPlacement='stacked' interface="popover" onIonChange={(ev) => updateAllKey("uomName", ev.detail.value)} value={getCommonKey(stateItemDoc,"uomName",listDocs)}>
                    <IonSelectOption key="uom-undefined" value={null}>{t("general.no_uom")}</IonSelectOption>
                    {uomDocs.filter(uom => (["system",stateItemDoc.listGroupID].includes(uom.listGroupID))).map((uom) => (
                      <IonSelectOption key={uom.name} value={uom.name}>{translatedUOMName(uom._id!,uom.description,uom.pluralDescription)}</IonSelectOption>
                    ))}
                    </IonSelect>
                  </IonCol>
                  <IonCol className="ion-no-padding" size="1">
                    <IonButton className="new-value-button" fill="default" onClick={() => {addUOMPopup()}}>
                      <IonIcon icon={addCircleOutline}></IonIcon>
                    </IonButton>
                  </IonCol>
                </IonRow>
                </IonGrid>
              </IonItem>
              <IonItem key="category">
                <IonGrid className="ion-no-padding">
                  <IonRow>
                    <IonCol className="ion-no-padding" size="11">
                      <IonSelect label={t("general.category") as string} labelPlacement="stacked" interface="popover" onIonChange={(ev) => updateAllKey("categoryID",ev.detail.value)} value={getCommonKey(stateItemDoc,"categoryID",listDocs)}>
                        <IonSelectOption key="cat-undefined" value={null}>{t("general.uncategorized")}</IonSelectOption>
                          {getCombinedCategories().map((cat) => (
                            <IonSelectOption key={cat._id} value={cat._id}>
                            {translatedCategoryName(cat._id,cat.name)}
                            </IonSelectOption>
                          ))}
                      </IonSelect>
                    </IonCol>
                    <IonCol className="ion-no-padding" size="1">
                      <IonButton className="new-value-button" fill="default" onClick={() => {addCategoryPopup()}}>
                        <IonIcon icon={addCircleOutline} ></IonIcon>
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </IonItem>
              <IonItem key="note">
                <IonTextarea label={t("general.note") as string} labelPlacement="stacked" placeholder={t("general.item_note") as string} inputMode='text' debounce={100} rows={4} onIonInput={(ev) => updateAllKey("note",String(ev.detail.value))} value={getCommonKey(stateItemDoc,"note",listDocs)}>   
                </IonTextarea>
              </IonItem>
            </IonCard>
            <ItemLists stateItemDoc={stateItemDoc} setStateItemDoc={setStateItemDoc}           
                      addCategoryPopup={addCategoryPopup} addUOMPopup={addUOMPopup} />
          </IonList>
      </IonContent>
      <IonFooter className="floating-footer">
        {
          formErrors[ErrorLocation.General].hasError ? <IonItem className="shorter-item-some-padding" color="danger" lines="none">{formErrors[ErrorLocation.General].errorMessage}</IonItem> : <></>
        }  
      <IonToolbar>
          <IonButtons slot="start">
            {mode !== "new" ? 
              (<IonButton fill="outline" color="danger" onClick={() => deleteItem()}><IonIcon slot="start" icon={trashOutline}></IonIcon>{t("general.delete")}</IonButton>)
              : <></>}
          </IonButtons>  
          <IonButtons slot="secondary">  
          <IonButton fill="outline" color="secondary" onClick={() => goBack()}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>{t("general.cancel")}</IonButton>
          </IonButtons>
          <IonButtons slot="end">
          <IonButton fill="solid" color="primary" className="primary-button" onClick={() => updateThisItem()}>{mode === "new" ? t("general.add") : t("general.save")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>
          </IonButtons>
          </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default Item;
