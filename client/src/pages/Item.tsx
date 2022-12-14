import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonIcon,
  IonSelectOption, NavContext, useIonAlert,useIonToast, IonTextarea } from '@ionic/react';
import { addOutline, closeCircleOutline, trashOutline } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { usePouch, useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument, useLists, useDeleteGenericDocument } from '../components/Usehooks';
import { createEmptyItemDoc } from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import './Item.css';
import SyncIndicator from '../components/SyncIndicator';
import { ListRow, PouchResponse } from '../components/DataTypes';
import { RemoteDBStateContext } from '../components/RemoteDBState';

const Item: React.FC = () => {
  let { mode, itemid: routeItemID  } = useParams<{mode: string, itemid: string}>();
  const { remoteDBState } = useContext(RemoteDBStateContext);
  if ( mode === "new" ) { routeItemID = "<new>"};
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState({});
  const [formError,setFormError] = useState("");
  const updateItem  = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const addCategoryDoc = useCreateGenericDocument();
  const delItem = useDeleteGenericDocument();
  const { doc: itemDoc, loading: itemLoading, state: itemState, error: itemError } = useDoc(routeItemID);
  const { listDocs, listsLoading, listRows, listRowsLoading, listRowsLoaded} = useLists(String(remoteDBState.dbCreds.dbUsername))

  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
  });

  const {goBack} = useContext(NavContext);
  const { globalState, setStateInfo} = useContext(GlobalStateContext);
  const [presentAlert, dismissAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const db = usePouch();

  function addListsIfNotExist(itemDoc: any) {
    let newItemDoc=cloneDeep(itemDoc);
    let baseList = listRows.find((listRow: ListRow) => listRow.listDoc._id === globalState.callingListID)
    for (let i = 0; i < listRows.length; i++) {
      let foundIdx=newItemDoc.lists.findIndex((el: any) => el.listID === listRows[i].listDoc._id)
      if (foundIdx === -1) {
          newItemDoc.lists.push({
          listID: listRows[i].listDoc._id,
          completed: false,
          active: false,
          boughtCount: 0
        })
      }  
    }
    return(newItemDoc);
  }

  useEffect( () => {
    let newItemDoc = cloneDeep(itemDoc);
    if (!itemLoading && !listsLoading && listRowsLoaded) {
      if (globalState.itemMode === "new" && needInitItemDoc) {
        newItemDoc = createEmptyItemDoc(listRows,globalState.callingListID,globalState.newItemName,globalState.settings)
        setStateInfo("newItemMode","none");
        setNeedInitItemDoc(false);
      } else {
      if (newItemDoc != null) {newItemDoc=addListsIfNotExist(itemDoc)};
      }
      if (newItemDoc != null) {setStateItemDoc(newItemDoc as any)};
    }
  },[itemLoading,itemDoc,listsLoading,listDocs,listRowsLoading,listRowsLoaded, listRows,globalState.itemMode,globalState.newItemName, globalState.callingListID]);

  if (itemLoading || listsLoading || listRowsLoading || categoryLoading || isEmpty(stateItemDoc))  {
    return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
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
      goBack("/lists");
    } else {
      setFormError("Error updating item. Please retry.");
    }
  }

  function updateCategory(catID: string) {
    setStateItemDoc({
      ...stateItemDoc,
      categoryID: catID
    });
  }

  async function addNewCategory(category: string) {
    let alreadyFound=false;
    categoryDocs.forEach((cat: any) => 
      {
        if (category.toUpperCase() == cat.name.toUpperCase()) {alreadyFound=true}
      });
    if (!alreadyFound) {
      let result = await addCategoryDoc({"type": "category", "name": category})
      if (result.successful) {
        updateCategory(result.pouchData.id)
      } else {
        presentToast({message: "Error adding category. Please retry.",
              duration: 1500, position: "middle"})
      }  
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

  async function deleteItemFromDB() {
      setFormError(prevState => (""));
      let result: PouchResponse;
      result = await delItem(stateItemDoc);
      if (result.successful) {
        goBack("/lists");
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

  function selectList(listID: string, updateVal: boolean) {
    let newItemDoc=cloneDeep(stateItemDoc);
    let listFound=false
    for (let i = 0; i < newItemDoc.lists.length; i++) {
      if (newItemDoc.lists[i].listID === listID) {
        newItemDoc.lists[i].active = updateVal;
        listFound=true;
        if(updateVal) {newItemDoc.lists[i].boughtCount++}
      }    
    }
    if (!listFound) {
      let listobj={
        listID: listID,
        boughtCount: 0,
        active: updateVal,
        checked: false
      }
      newItemDoc.lists.push(listobj);
    }
    setStateItemDoc(newItemDoc);
  }

  let listsElem=[];
  listsElem.push(<IonLabel key="listlabel" position='stacked'>Item is on these lists:</IonLabel>)
  for (let i = 0; i < (stateItemDoc as any).lists.length; i++) {
    let listID = (stateItemDoc as any).lists[i].listID;
    let itemFoundIdx=listDocs.findIndex((element: any) => (element._id === listID));
    if (itemFoundIdx !== -1) {
      let itemActive=(((stateItemDoc as any).lists[i].active));
      let listName=(listDocs as any)[itemFoundIdx].name;
      listsElem.push(
        <IonItem key={listID}>
          <IonCheckbox slot="start" onIonChange={(e: any) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox>
          <IonLabel>{listName}</IonLabel>
        </IonItem>
      )
    }
  }
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Item: {(stateItemDoc as any).name}</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, name: e.detail.value})} value={(stateItemDoc as any).name}></IonInput>
            </IonItem>
            <IonItem key="quantity">
              <IonLabel position="stacked">Quantity</IonLabel>
              <IonInput type="number" min="0" max="9999" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, quantity: e.detail.value})} value={(stateItemDoc as any).quantity}></IonInput>
            </IonItem>
            <IonItem key="category">
              <IonLabel key="categorylabel" position="stacked">Category</IonLabel>
              <IonSelect interface="popover" onIonChange={(ev) => updateCategory(ev.detail.value)} value={(stateItemDoc as any).categoryID}>
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
              <IonLabel key="notelabel" position="stacked">Note</IonLabel>
              <IonTextarea placeholder="Item Note" inputMode='text' debounce={100} rows={4} onIonChange={(ev) => setStateItemDoc(prevState => ({...prevState,note: ev.detail.value}))} value={(stateItemDoc as any).note}>   
              </IonTextarea>
            </IonItem>
            {listsElem}
            <IonItem key="formErrors">{formError}</IonItem>
          </IonList>
          <IonButton onClick={() => goBack("/lists")}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>Cancel</IonButton>
          {mode !== "new" ? 
            (<IonButton onClick={() => deleteItem()}><IonIcon slot="start" icon={trashOutline}></IonIcon>Delete</IonButton>)
            : <></>}
          <IonButton onClick={() => updateThisItem()}>{mode === "new" ? "Add": "Update"}</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Item;
