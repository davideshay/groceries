import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonSelect, IonIcon, IonLoading,
  IonSelectOption, useIonAlert,useIonToast, IonTextarea, IonGrid, IonRow, IonCol, IonText, IonCard,
  IonCardSubtitle } from '@ionic/react';
import { addOutline, closeCircleOutline, trashOutline, saveOutline } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext, useRef } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument, useLists, useDeleteGenericDocument, useGetOneDoc } from '../components/Usehooks';
import { createEmptyItemDoc } from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty, remove } from 'lodash';
import './Item.css';
import SyncIndicator from '../components/SyncIndicator';
import ItemLists from '../components/ItemLists';
import { getCommonKey } from '../components/ItemUtilities';
import { PouchResponse, HistoryProps, ItemDoc, ItemDocInit, ItemList, ListRow, ItemListInit } from '../components/DataTypes';

const Item: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, itemid: routeItemID  } = useParams<{mode: string, itemid: string}>();
  if ( mode === "new" ) { routeItemID = "<new>"};
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState<ItemDoc>(ItemDocInit);
  const [formError,setFormError] = useState("");
  const updateItem  = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const addCategoryDoc = useCreateGenericDocument();
  const addUOMDoc = useCreateGenericDocument();
  const delItem = useDeleteGenericDocument();
  const { doc: itemDoc, loading: itemLoading } = useGetOneDoc(routeItemID);
  const { listDocs, listCombinedRows, listsLoading, listRows, listRowsLoaded} = useLists();
  const screenLoading = useRef(true);

  const { docs: categoryDocs, loading: categoryLoading } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"] });
  const { docs: uomDocs, loading: uomLoading } = useFind({
      index: { fields: [ "type","description"]},
      selector: { type: "uom", description: { $exists: true}},
      sort: [ "type","description"] });

  const { globalState, setStateInfo} = useContext(GlobalStateContext);
  const [presentAlert, dismissAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  function groupIDForList(listID: string): string {
    let retGID="";
    let searchList=listRows.find((el: ListRow) => el.listDoc._id === listID);
    if (searchList) {retGID = String(searchList.listGroupID)}
    return retGID;
  }

  function addDeleteLists(itemDoc: ItemDoc) {
    console.log("ALINE," , cloneDeep(itemDoc), " ", listRowsLoaded);
    let newItemDoc: ItemDoc =cloneDeep(itemDoc);
    // loop through all the lists with the same listgroup. if the list is in the
    // listgroup, but not on the item add it.
    for (let i = 0; i < listRows.length; i++) {
      if (listRows[i].listGroupID !== newItemDoc.listGroupID) {break}
      let foundIdx=newItemDoc.lists.findIndex((el: ItemList) => el.listID === listRows[i].listDoc._id)
      if (foundIdx === -1) {
          console.log("Adding new list to item: ",listRows[i].listDoc.name);
          let newItemList = cloneDeep(ItemListInit);
          newItemList.listID = listRows[i].listDoc._id;
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
    let newItemDoc = cloneDeep(itemDoc);
    if (!itemLoading && !listsLoading && listRowsLoaded) {
      if (globalState.itemMode === "new" && needInitItemDoc) {
        newItemDoc = createEmptyItemDoc(listRows,globalState)
        setStateInfo("newItemMode","none");
        setNeedInitItemDoc(false);
      } else {
        if (newItemDoc != null) {newItemDoc=addDeleteLists(itemDoc)};
      }
      if (newItemDoc != null) {setStateItemDoc(newItemDoc as any)};
    }
  },[itemLoading,itemDoc,listsLoading,listDocs,listRowsLoaded,listRowsLoaded, listRows,globalState.itemMode,globalState.newItemName, globalState.callingListID, needInitItemDoc]);

  if (itemLoading || listsLoading || !listRowsLoaded || categoryLoading || uomLoading || isEmpty(stateItemDoc))  {
    return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader>
    <IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false;}} 
                message="Loading Data..." />
    </IonPage>
  )};

  screenLoading.current=false;
  
  async function updateThisItem() {
    setFormError(prevState => (""));
    let result: PouchResponse;
    if ((stateItemDoc as any).name == undefined || (stateItemDoc as any).name=="" || (stateItemDoc as any).name == null) {
      setFormError(prevState => ("Name is required"));
      return false;
    }
    if (mode === "new") {
      result = await addItem(stateItemDoc);
    }  
    else {
      result = await updateItem(stateItemDoc);
    }
    if (result.successful) {
      props.history.goBack();
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
    categoryDocs.forEach((cat: any) => 
      {
        if (category.toUpperCase() === cat.name.toUpperCase()) {alreadyFound=true}
      });
    if (!alreadyFound) {
      let result = await addCategoryDoc({"type": "category", "name": category})
      if (result.successful) {
          updateAllKey("categoryID",result.pouchData.id);
      } else {
        presentToast({message: "Error adding category. Please retry.",
              duration: 1500, position: "middle"})
      }  
    }  
  }

  async function addNewUOM(uomData: any) {
    let alreadyFound = false;
    uomDocs.forEach((uom: any) => {
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
    uomDocs.forEach((uom: any) => {
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
    uomDocs.forEach((uom: any) => {
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
        props.history.goBack();
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
  
  let thisListGroup = listCombinedRows.find(el => el.listGroupID == stateItemDoc.listGroupID);
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Item: {stateItemDoc.name}</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
          <IonList>
            <IonItem key="name">
              <IonInput label="Name" labelPlacement="stacked" type="text" onIonInput={(e: any) => setStateItemDoc({...stateItemDoc, name: e.detail.value})} value={stateItemDoc.name}></IonInput>
            </IonItem>
            <IonItem key="listgroup">
              <IonText >List Group: {thisListGroup?.listGroupName}</IonText>
            </IonItem>
            <IonCard>
              <IonCardSubtitle>Change values here to change on all lists below</IonCardSubtitle>
              <IonItem key="quantity">
                <IonGrid>
                <IonRow>
                  <IonCol size="3"><IonLabel >Quantity</IonLabel></IonCol>
                  <IonCol size="8"><IonLabel >UoM</IonLabel></IonCol>
                  <IonCol size="1"></IonCol>
                </IonRow>
                <IonRow>
                  <IonCol size="3"><IonInput label="" type="number" min="0" max="9999" onIonInput={(e: any) => updateAllKey("quantity",e.detail.value)} value={getCommonKey(stateItemDoc,"quantity",listDocs)}></IonInput></IonCol>
                  <IonCol size="8">
                    <IonSelect label="" interface="popover" onIonChange={(ev) => updateAllKey("uomName", ev.detail.value)} value={getCommonKey(stateItemDoc,"uomName",listDocs)}>
                    <IonSelectOption key="uom-undefined" value={null}>No UOM</IonSelectOption>
                    {uomDocs.map((uom: any) => (
                      <IonSelectOption key={uom.name} value={uom.name}>{uom.description}</IonSelectOption>
                    ))}
                    </IonSelect>
                  </IonCol>
                  <IonCol size="1"><IonButton fill="default" onClick={(e) => {addUOMPopup()}}><IonIcon icon={addOutline}></IonIcon></IonButton></IonCol>
                </IonRow>
                </IonGrid>
              </IonItem>
              <IonItem key="category">
                <IonSelect label="Category" labelPlacement="stacked" interface="popover" onIonChange={(ev) => updateAllKey("categoryID",ev.detail.value)} value={getCommonKey(stateItemDoc,"categoryID",listDocs)}>
                  <IonSelectOption key="cat-undefined" value={null}>Uncategorized</IonSelectOption>
                  {categoryDocs.map((cat) => (
                      <IonSelectOption key={cat._id} value={(cat as any)._id}>
                        {(cat as any).name}
                      </IonSelectOption>
                  ))}
                </IonSelect>
                <IonButton slot="end" fill="default" onClick={(e: any) => {addCategoryPopup()}}>
                  <IonIcon slot="end" icon={addOutline} ></IonIcon>
                </IonButton>  
              </IonItem>
              <IonItem key="note">
                <IonTextarea label="Note" labelPlacement="stacked" placeholder="Item Note" inputMode='text' debounce={100} rows={4} onIonInput={(ev) => updateAllKey("note",String(ev.detail.value))} value={getCommonKey(stateItemDoc,"note",listDocs)}>   
                </IonTextarea>
              </IonItem>
            </IonCard>
            <ItemLists history={props.history} stateItemDoc={stateItemDoc} setStateItemDoc={setStateItemDoc} 
                      listDocs={listDocs} categoryDocs={categoryDocs} uomDocs={uomDocs}
                      addCategoryPopup={addCategoryPopup} addUOMPopup={addUOMPopup} />
            <IonItem key="formErrors">{formError}</IonItem>
          </IonList>
          {mode !== "new" ? 
            (<IonButton fill="outline" color="danger" onClick={() => deleteItem()}><IonIcon slot="start" icon={trashOutline}></IonIcon>Delete</IonButton>)
            : <></>}
          <IonButton fill="outline" onClick={() => props.history.goBack()}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>Cancel</IonButton>
          <IonButton onClick={() => updateThisItem()}>{mode === "new" ? "Add": "Save"}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Item;
