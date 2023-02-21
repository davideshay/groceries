import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonSelect, IonCheckbox, IonIcon,
  IonSelectOption, NavContext, useIonAlert,useIonToast, IonTextarea, IonGrid, IonRow, IonCol } from '@ionic/react';
import { addOutline, closeCircleOutline, trashOutline } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument, useLists, useDeleteGenericDocument, useGetOneDoc } from '../components/Usehooks';
import { createEmptyItemDoc } from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty } from 'lodash';
import './Item.css';
import SyncIndicator from '../components/SyncIndicator';
import { PouchResponse, HistoryProps } from '../components/DataTypes';
import { RemoteDBStateContext } from '../components/RemoteDBState';

const Item: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, itemid: routeItemID  } = useParams<{mode: string, itemid: string}>();
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  if ( mode === "new" ) { routeItemID = "<new>"};
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState({});
  const [formError,setFormError] = useState("");
  const updateItem  = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const addCategoryDoc = useCreateGenericDocument();
  const addUOMDoc = useCreateGenericDocument();
  const delItem = useDeleteGenericDocument();
  const { doc: itemDoc, loading: itemLoading } = useGetOneDoc(routeItemID);
  const { listDocs, listsLoading, listRows, listRowsLoading, listRowsLoaded} = useLists(String(remoteDBCreds.dbUsername))

  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"] });
  const { docs: uomDocs, loading: uomLoading, error: uomError } = useFind({
      index: { fields: [ "type","description"]},
      selector: { type: "uom", description: { $exists: true}},
      sort: [ "type","description"] });

  const { globalState, setStateInfo} = useContext(GlobalStateContext);
  const [presentAlert, dismissAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  function addListsIfNotExist(itemDoc: any) {
    let newItemDoc=cloneDeep(itemDoc);
//    let baseList = listRows.find((listRow: ListRow) => listRow.listDoc._id === globalState.callingListID)
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
      if (! newItemDoc.hasOwnProperty('uomName')) { newItemDoc.uomName = null};
      if (newItemDoc != null) {setStateItemDoc(newItemDoc as any)};
    }
  },[itemLoading,itemDoc,listsLoading,listDocs,listRowsLoading,listRowsLoaded, listRows,globalState.itemMode,globalState.newItemName, globalState.callingListID]);

  if (itemLoading || listsLoading || listRowsLoading || categoryLoading || uomLoading || isEmpty(stateItemDoc))  {
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
      props.history.goBack();
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

  function updateUOM(uomName: string) {
    setStateItemDoc({
      ...stateItemDoc,
      uomName: uomName
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
    if (uomData.description == "") {
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
    if (uomData.pluralDescription == "") {
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
      updateUOM(result.pouchData.id)
    } else {
      presentToast({message: "Error adding unit of measure. Please retry.",
            duration: 1500, position: "middle"})
    }  

    console.log(uomData);
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

  function changeStockedAt(listID: string, updateVal: boolean) {
    let newItemDoc=cloneDeep(stateItemDoc);
    let listFound=false
    for (let i = 0; i < newItemDoc.lists.length; i++) {
      if (newItemDoc.lists[i].listID === listID) {
        newItemDoc.lists[i].stockedAt = updateVal;
        listFound=true;
      }    
    }
    if (!listFound) {
      let listobj={
        listID: listID,
        boughtCount: 0,
        active: updateVal,
        stockedAt: true,
        checked: false
      }
      newItemDoc.lists.push(listobj);
    }
    setStateItemDoc(newItemDoc);
  }

  function resetBoughtCount(listID: string) {
    let newItemDoc=cloneDeep(stateItemDoc);
    for (let i = 0; i < newItemDoc.lists.length; i++) {
      if (newItemDoc.lists[i].listID === listID) {
        newItemDoc.lists[i].boughtCount = 0;
      }    
    }
    setStateItemDoc(newItemDoc);
  }

  let listsElem=[];
  let listsInnerElem=[];
//  listsElem.push(<IonGrid>);
  listsInnerElem.push(<IonRow key="listlabelrow">
      <IonCol size="5"><IonLabel key="listlabel" position='stacked'>Item is on these lists:</IonLabel></IonCol>
      <IonCol size="2"><IonLabel key="stocklabel" position="stacked">Stocked</IonLabel></IonCol>
      <IonCol size="3"><IonLabel key="countlabel" position="stacked">Times Bought</IonLabel></IonCol>
      <IonCol size="2"><IonLabel key="resetlabel" position="stacked">Reset</IonLabel></IonCol></IonRow>
  )
  for (let i = 0; i < (stateItemDoc as any).lists.length; i++) {
    let listID = (stateItemDoc as any).lists[i].listID;
    let itemFoundIdx=listDocs.findIndex((element: any) => (element._id === listID));
    if (itemFoundIdx !== -1) {
      let itemActive=(((stateItemDoc as any).lists[i].active));
      let listName=(listDocs as any)[itemFoundIdx].name;
      let stockedAt=((stateItemDoc as any).lists[i].stockedAt);
      listsInnerElem.push(
        <IonRow key={listID}>
          <IonCol size="1"><IonCheckbox onIonChange={(e: any) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox></IonCol>
          <IonCol size="4"><IonLabel>{listName}</IonLabel></IonCol>
          <IonCol size="2"><IonCheckbox onIonChange={(e: any) => changeStockedAt(listID,Boolean(e.detail.checked))} checked={stockedAt}></IonCheckbox></IonCol>
          <IonCol size="3">{(stateItemDoc as any).lists[i].boughtCount}</IonCol>
          <IonCol size="2"><IonButton onClick={(e) => resetBoughtCount(listID)}>Reset</IonButton></IonCol>
        </IonRow>
      )
    }
  }
  listsElem.push(<IonItem key="listlist"><IonGrid>{listsInnerElem}</IonGrid></IonItem>)
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Item: {(stateItemDoc as any).name}</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen id="main">
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, name: e.detail.value})} value={(stateItemDoc as any).name}></IonInput>
            </IonItem>
            <IonItem key="quantity">
              <IonGrid>
              <IonRow>
                <IonCol size="3"><IonLabel >Quantity</IonLabel></IonCol>
                <IonCol size="8"><IonLabel >UoM</IonLabel></IonCol>
                <IonCol size="1"></IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="3"><IonInput type="number" min="0" max="9999" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, quantity: e.detail.value})} value={(stateItemDoc as any).quantity}></IonInput></IonCol>
                <IonCol size="8">
                  <IonSelect interface="popover" onIonChange={(ev) => updateUOM(ev.detail.value)} value={(stateItemDoc as any).uomName}>
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
          <IonButton onClick={() => props.history.goBack()}><IonIcon slot="start" icon={closeCircleOutline}></IonIcon>Cancel</IonButton>
          {mode !== "new" ? 
            (<IonButton onClick={() => deleteItem()}><IonIcon slot="start" icon={trashOutline}></IonIcon>Delete</IonButton>)
            : <></>}
          <IonButton onClick={() => updateThisItem()}>{mode === "new" ? "Add": "Update"}</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Item;
