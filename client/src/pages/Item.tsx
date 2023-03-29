import { IonContent, IonPage, IonButton, IonList, IonInput, IonItem,
  IonSelect, IonIcon, 
  IonSelectOption, useIonAlert,useIonToast, IonTextarea, IonGrid, IonRow, IonCol, IonText, IonCard,
  IonCardSubtitle, NavContext } from '@ionic/react';
import { addOutline, closeCircleOutline, trashOutline, saveOutline } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { usePouch } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument, useDeleteGenericDocument, useGetOneDoc, useItems } from '../components/Usehooks';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty, remove } from 'lodash';
import './Item.css';
import ItemLists from '../components/ItemLists';
import { getCommonKey, createEmptyItemDoc, checkNameInGlobal  } from '../components/ItemUtilities';
import { PouchResponse, ListRow, RowType } from '../components/DataTypes';
import { UomDoc, ItemDoc, ItemDocInit, ItemList, ItemListInit, CategoryDoc } from '../components/DBSchema';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';


const Item: React.FC = (props) => {
  let { mode, itemid } = useParams<{mode: string, itemid: string}>();
  const routeItemID = (mode === "new" ? null : itemid)
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState<ItemDoc>(ItemDocInit);
  const [formError,setFormError] = useState("");
  const updateItem  = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const addCategoryDoc = useCreateGenericDocument();
  const addUOMDoc = useCreateGenericDocument();
  const delItem = useDeleteGenericDocument();
  const { doc: itemDoc, loading: itemLoading, dbError: itemError } = useGetOneDoc(routeItemID);
  const db = usePouch();
  const screenLoading = useRef(true);
  const {goBack} = useContext(NavContext);

  const { dbError: itemsError, itemRowsLoaded, itemRows } = useItems({selectedListGroupID: stateItemDoc.listGroupID, isReady: !itemLoading, needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const { globalState, setStateInfo} = useContext(GlobalStateContext);
  const globalData  = useContext(GlobalDataContext);
  const [presentAlert, dismissAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  
  function groupIDForList(listID: string): string {
    let retGID="";
    let searchList=globalData.listRows.find((el: ListRow) => el.listDoc._id === listID);
    if (searchList) {retGID = String(searchList.listGroupID)}
    return retGID;
  }

  function addDeleteLists(itemDoc: ItemDoc) {
    let newItemDoc: ItemDoc =cloneDeep(itemDoc);
    // loop through all the lists with the same listgroup. if the list is in the
    // listgroup, but not on the item add it.
    for (let i = 0; i < globalData.listRows.length; i++) {
      if (globalData.listRows[i].listGroupID !== newItemDoc.listGroupID) {continue}
      let foundIdx=newItemDoc.lists.findIndex((el: ItemList) => el.listID === globalData.listRows[i].listDoc._id)
      if (foundIdx === -1) {
          let newItemList: ItemList = cloneDeep(ItemListInit);
          newItemList.listID = String(globalData.listRows[i].listDoc._id);
          newItemList.active = getCommonKey(itemDoc,"active",globalData.listDocs);
          newItemList.categoryID = getCommonKey(itemDoc,"categoryID",globalData.listDocs);
          newItemList.completed = getCommonKey(itemDoc,"completed",globalData.listDocs);
          newItemList.note = getCommonKey(itemDoc,"note",globalData.listDocs);
          newItemList.quantity = getCommonKey(itemDoc,"quantity",globalData.listDocs);
          newItemList.stockedAt = getCommonKey(itemDoc,"stockedAt",globalData.listDocs);
          newItemList.uomName = getCommonKey(itemDoc,"uomName",globalData.listDocs);
          newItemDoc.lists.push(newItemList);
      }  
    }
    // now loop through all the lists on the item, and see if they are in the right listgroup.
    // if not, delete the list from the item
    let currentLists=cloneDeep(newItemDoc.lists);
    remove(currentLists, (list: ItemList) => { return groupIDForList(list.listID) !== newItemDoc.listGroupID})
    newItemDoc.lists=currentLists;
    return(newItemDoc);
  }

  useEffect( () => {
    if (!itemLoading && mode !== "new" && itemDoc && globalData.listRowsLoaded) {
      let newItemDoc: ItemDoc = cloneDeep(itemDoc);
      newItemDoc = addDeleteLists(itemDoc);
      setStateItemDoc(cloneDeep(newItemDoc));
    }
  },[itemLoading,mode,itemDoc,globalData.listRowsLoaded])


  useEffect( () => {
    if (!itemLoading && mode === "new" && !globalData.listsLoading && globalData.listRowsLoaded && needInitItemDoc) {
        let newItemDoc = createEmptyItemDoc(globalData.listRows,globalState)
        setStateInfo("newItemMode","none");
        setNeedInitItemDoc(false);
        setStateItemDoc(newItemDoc);
    }
  },[itemLoading,itemDoc,globalData.listsLoading,globalData.listDocs,globalData.listRowsLoaded, globalData.listRows,globalState.itemMode,globalState.newItemName, globalState.callingListID, needInitItemDoc]);

  if (itemError || globalData.listError || globalData.categoryError || globalData.uomError || itemsError) { console.log("ERROR");return (
    <ErrorPage errorText="Error Loading Item Information... Restart."></ErrorPage>
  )}



  if ((itemLoading && routeItemID !== null) || globalData.listsLoading || !globalData.listRowsLoaded || globalData.categoryLoading || globalData.uomLoading || !itemRowsLoaded || isEmpty(stateItemDoc))  {
    return ( <Loading isOpen={screenLoading.current} message="Loading Item..."    /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };

  screenLoading.current=false;
  
  async function updateThisItem() {
    setFormError(prevState => (""));
    let result: PouchResponse;
    if (stateItemDoc.name === undefined || stateItemDoc.name==="" || stateItemDoc.name === null) {
      setFormError(prevState => ("Name is required"));
      return false;
    }
    let alreadyExists = false;
    itemRows.forEach((ir) => {
      if ( ir._id !== stateItemDoc._id  && ir.listGroupID === stateItemDoc.listGroupID && ir.name.toUpperCase() === stateItemDoc.name.toUpperCase()) {
        alreadyExists = true;
      }
    })
    if (alreadyExists) {
      setFormError(prevState => ("Cannot use name of existing item in list group"));
      return false;
    }
    if ( stateItemDoc.globalItemID == null && await checkNameInGlobal(db as PouchDB.Database,stateItemDoc.name.toUpperCase())) {
      setFormError(prevState => ("Cannot use name of existing item in global item list"));
      return false;
    }
    if (mode === "new") {
      result = await addItem(stateItemDoc);
    }  
    else {
      result = await updateItem(stateItemDoc);
    }
    if (result.successful) {
      goBack();
    } else {
      setFormError("Error updating item. Please retry.");
    }
  }

  function updateAllKey(key: string, val: any) {
    let newItemDoc: ItemDoc = cloneDeep(stateItemDoc);
    newItemDoc.lists.forEach((list: ItemList) => {
      (list as any)[key] = val;
    })
    setStateItemDoc(newItemDoc);
  }

  async function addNewCategory(category: string) {
    let alreadyFound=false;
    (globalData.categoryDocs as CategoryDoc[]).forEach((cat) => 
      {
        if (category.toUpperCase() === cat.name.toUpperCase()) {alreadyFound=true}
      });
    if (!alreadyFound) {
      let result = await addCategoryDoc({"type": "category", "name": category, "color": "#ffffff"})
      if (result.successful) {
          updateAllKey("categoryID",result.pouchData.id);
      } else {
        presentToast({message: "Error adding category. Please retry.",
              duration: 1500, position: "middle"})
      }  
    }  
  }

  async function addNewUOM(uomData: UomDoc) {
    let alreadyFound = false;
    (globalData.uomDocs as UomDoc[]).forEach((uom) => {
      if (uom.name.toUpperCase() === uomData.name.toUpperCase()) {alreadyFound=true;}
    });
    if (alreadyFound) {
      presentToast({message: "Requested UOM Already exists. Please retry.", duration: 1500, position: "middle"});
      return false;
    }
    if (uomData.name.length > 2) {
      presentToast({message: "Units of measure must be 2 characters. Please retry.", duration: 1500, position: "middle"});
      return false;
    }
    uomData.name = uomData.name.toUpperCase();
    if (uomData.description === "") {
      presentToast({message: "No UOM Description entered. Please retry.", duration: 1500, position: "middle"});
      return false;
    }
    alreadyFound = false;
    (globalData.uomDocs as UomDoc[]).forEach((uom) => {
      if (uom.description.toUpperCase() === uomData.description.toUpperCase()) {alreadyFound=true;}
    });
    if (alreadyFound) {
      presentToast({message: "Requested UOM Description Already exists. Please retry.", duration: 1500, position: "middle"});
      return false;
    }
    if (uomData.pluralDescription === "") {
      presentToast({message: "No UOM Plural description entered. Please retry.", duration: 1500, position: "middle"});
      return false;
    }
    alreadyFound = false;
    (globalData.uomDocs as UomDoc[]).forEach((uom) => {
      if (uom.pluralDescription.toUpperCase() === uomData.pluralDescription.toUpperCase()) {alreadyFound=true;}
    });
    if (alreadyFound) {
      presentToast({message: "Requested UOM Plural Description Already exists. Please retry.", duration: 1500, position: "middle"});
      return false;
    }
    let result = await addUOMDoc({"type": "uom", "name": uomData.name, "description": uomData.description, "pluralDescription": uomData.pluralDescription});
    if (result.successful) {
        updateAllKey("uomName",uomData.name);
    } else {
      presentToast({message: "Error adding unit of measure. Please retry.",
            duration: 1500, position: "middle"})
    }  
  }

  function addCategoryPopup() {
    presentAlert({
      header: "Add new category",
      inputs: [ {name: "category", type: "text"}],
      buttons: [ { text: 'Cancel', role: 'cancel'},
                { text: "Add", role: 'confirm',
                handler: (alertData) => {addNewCategory(alertData.category)}}
                ]    
    })
  }

  function addUOMPopup() {
    presentAlert({
      header: "Add new Unit of Measure",
      inputs: [ {name: "name", placeholder: "Name", max: "2", type: "text"},
                {name:"description", placeholder: "Description", type:"text"},
                {name:"pluralDescription", placeholder: "Plural Description",type:"text"}],
      buttons: [ {text: "Cancel", role: "cancel"},
                 {text: "Add", role: "confirm", handler: (alertData) => {addNewUOM(alertData)}}
    ]
    })
  }

  async function deleteItemFromDB() {
      setFormError(prevState => (""));
      let result: PouchResponse;
      result = await delItem(stateItemDoc);
      if (result.successful) {
        goBack();
      } else {
        setFormError("Error updating item. Please retry.");
      }
  }

  function deleteItem() {
    presentAlert({
      header: "Delete this item?",
      subHeader: "Do you really want to delete this item?",
      buttons: [ { text: "Cancel", role: "Cancel"},
                 { text: "Delete", role: "confirm",
                  handler: () => deleteItemFromDB()}]
    })
  }
  
  let thisListGroup = globalData.listCombinedRows.find(el => el.listGroupID === stateItemDoc.listGroupID);
  
  return (
    <IonPage>
      <PageHeader title={"Editing Item: "+stateItemDoc.name} />
      <IonContent>
          <IonList>
            <IonItem key="name">
              <IonInput disabled={stateItemDoc.globalItemID != null} label="Name" labelPlacement="stacked" type="text" onIonInput={(e) => setStateItemDoc({...stateItemDoc, name: String(e.detail.value)})} value={stateItemDoc.name}></IonInput>
            </IonItem>
            <IonItem key="listgroup">
              <IonText >List Group: {thisListGroup?.listGroupName}</IonText>
            </IonItem>
            <IonCard>
              <IonCardSubtitle>Change values here to change on all lists below</IonCardSubtitle>
              <IonItem key="quantity">
                <IonGrid class="ion-no-padding">
                <IonRow>
                  <IonCol class="ion-no-padding" size="3"><IonInput label="Quantity" labelPlacement="stacked" type="number" min="0" max="9999" onIonInput={(e) => updateAllKey("quantity",e.detail.value)} value={getCommonKey(stateItemDoc,"quantity",globalData.listDocs)}></IonInput></IonCol>
                  <IonCol class="ion-no-padding" size="8">
                    <IonSelect label="UoM" labelPlacement='stacked' interface="popover" onIonChange={(ev) => updateAllKey("uomName", ev.detail.value)} value={getCommonKey(stateItemDoc,"uomName",globalData.listDocs)}>
                    <IonSelectOption key="uom-undefined" value={null}>No UOM</IonSelectOption>
                    {(globalData.uomDocs as UomDoc[]).map((uom) => (
                      <IonSelectOption key={uom.name} value={uom.name}>{uom.description}</IonSelectOption>
                    ))}
                    </IonSelect>
                  </IonCol>
                  <IonCol class="ion-no-padding" size="1"><IonButton fill="default" onClick={(e) => {addUOMPopup()}}><IonIcon icon={addOutline}></IonIcon></IonButton></IonCol>
                </IonRow>
                </IonGrid>
              </IonItem>
              <IonItem key="category">
                <IonSelect label="Category" labelPlacement="stacked" interface="popover" onIonChange={(ev) => updateAllKey("categoryID",ev.detail.value)} value={getCommonKey(stateItemDoc,"categoryID",globalData.listDocs)}>
                  <IonSelectOption key="cat-undefined" value={null}>Uncategorized</IonSelectOption>
                  {(globalData.categoryDocs as CategoryDoc[]).map((cat) => (
                      <IonSelectOption key={cat._id} value={cat._id}>
                        {cat.name}
                      </IonSelectOption>
                  ))}
                </IonSelect>
                <IonButton slot="end" fill="default" onClick={() => {addCategoryPopup()}}>
                  <IonIcon slot="end" icon={addOutline} ></IonIcon>
                </IonButton>  
              </IonItem>
              <IonItem key="note">
                <IonTextarea label="Note" labelPlacement="stacked" placeholder="Item Note" inputMode='text' debounce={100} rows={4} onIonInput={(ev) => updateAllKey("note",String(ev.detail.value))} value={getCommonKey(stateItemDoc,"note",globalData.listDocs)}>   
                </IonTextarea>
              </IonItem>
            </IonCard>
            <ItemLists stateItemDoc={stateItemDoc} setStateItemDoc={setStateItemDoc}           
                      addCategoryPopup={addCategoryPopup} addUOMPopup={addUOMPopup} />
            <IonItem key="formErrors">{formError}</IonItem>
          </IonList>
          {mode !== "new" ? 
            (<IonButton class="ion-float-left" fill="outline" color="danger" onClick={() => deleteItem()}><IonIcon slot="start" icon={trashOutline}></IonIcon>Delete</IonButton>)
            : <></>}
          <IonButton class="ion-float-right" onClick={() => updateThisItem()}>{mode === "new" ? "Add": "Save"}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>
          <IonButton class="ion-float-right" fill="outline" onClick={() => goBack()}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

Item.whyDidYouRender = true;

export default Item;
