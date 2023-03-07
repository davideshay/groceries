import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonLabel, IonSelect, IonCheckbox, IonIcon,
  IonSelectOption, useIonAlert,useIonToast, IonTextarea, IonGrid, IonRow, IonCol, IonText, IonCard,
  IonModal, IonCardSubtitle } from '@ionic/react';
import { addOutline, closeCircleOutline, trashOutline, pencilOutline } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument, useLists, useDeleteGenericDocument, useGetOneDoc } from '../components/Usehooks';
import { createEmptyItemDoc } from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty } from 'lodash';
import './Item.css';
import SyncIndicator from '../components/SyncIndicator';
import { PouchResponse, HistoryProps, ItemDoc, ItemDocInit, ItemList, ListRow, ItemListInit } from '../components/DataTypes';
import { RemoteDBStateContext } from '../components/RemoteDBState';

type ModalState = {
  selectedListId: string,
  selectedListIdx: number,
  selectedListName: string,
  isOpen: boolean,
  itemList: ItemList
}

const ModalStateInit : ModalState = {
  selectedListId: "",
  selectedListIdx: 0,
  selectedListName: "",
  isOpen: false,
  itemList: ItemListInit
}


const Item: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, itemid: routeItemID  } = useParams<{mode: string, itemid: string}>();
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  if ( mode === "new" ) { routeItemID = "<new>"};
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState<ItemDoc>(ItemDocInit);
  const [modalState, setModalState] = useState<ModalState>(ModalStateInit)
  const [formError,setFormError] = useState("");
  const updateItem  = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const addCategoryDoc = useCreateGenericDocument();
  const addUOMDoc = useCreateGenericDocument();
  const delItem = useDeleteGenericDocument();
  const { doc: itemDoc, loading: itemLoading } = useGetOneDoc(routeItemID);
  const { listDocs, listCombinedRows, listsLoading, listRows, listRowsLoading, listRowsLoaded} = useLists()

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

  function addListsIfNotExist(itemDoc: ItemDoc) {
    let newItemDoc=cloneDeep(itemDoc);
    console.log("ALINE, itemDoc is: ", cloneDeep(newItemDoc));
//    let baseList = listRows.find((listRow: ListRow) => listRow.listDoc._id === globalState.callingListID)
    for (let i = 0; i < listRows.length; i++) {
      let foundIdx=newItemDoc.lists.findIndex((el: ItemList) => el.listID === listRows[i].listDoc._id && groupIDForList(el.listID) === itemDoc.listGroupID)
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
        newItemDoc = createEmptyItemDoc(listRows,globalState)
        setStateInfo("newItemMode","none");
        setNeedInitItemDoc(false);
      } else {
      if (newItemDoc != null) {newItemDoc=addListsIfNotExist(itemDoc)};
      }
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

  function updateAllKey(key: string, val: any) {
    let newItemDoc: ItemDoc = cloneDeep(stateItemDoc);
    newItemDoc.lists.forEach((list: ItemList) => {
      (list as any)[key] = val;
    })
    setStateItemDoc(newItemDoc);
  }

  function getCommonKey(key: string) {
    let freqObj: any = {};
    let maxKey = ""; let maxCnt=0;
    stateItemDoc.lists.forEach( (list: ItemList) => {
      let value=(list as any)[key]
      if (freqObj.hasOwnProperty(value)) {
        freqObj[value]=freqObj[value]+1;
        if (freqObj[value] > maxCnt) {maxCnt = freqObj[value]; maxKey=value;} 
      } else {
        freqObj[value]=1
      }
    });
    if (maxCnt = 0 && stateItemDoc.lists.length > 0 ) {maxKey = (stateItemDoc.lists[0] as any)[key]}
    return maxKey;
  }

  function listIsDifferentThanCommon(listIdx: number) {
    let anyDifferences=false;
    for (const [key, value] of Object.entries(stateItemDoc.lists[listIdx])) {
      if (key != "listID") { 
        let commonVal = getCommonKey(key);
        if (commonVal != value) { anyDifferences=true}
      }  
    }
    return (anyDifferences ? "*" : "")
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
//        updateCategory(result.pouchData.id)
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
//      updateUOM(result.pouchData.id)
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

  function editListModal(listID: string) {
    console.log("in ELM: list: ",listID);
    let listIdx = 0;
    for (let i = 0; i < stateItemDoc.lists.length; i++) {
      if (stateItemDoc.lists[i].listID == listID) { listIdx=i; break;}
    }
    let listFoundIdx=listDocs.findIndex((element: any) => (element._id === listID));
    let listName = (listFoundIdx == -1) ? "" : listDocs[listFoundIdx].name
    console.log("edit list modal, listID: ",listID, listIdx);
    setModalState(prevState => ({...prevState,isOpen: true, selectedListId: listID, 
      selectedListName: listName, selectedListIdx: listIdx, itemList: cloneDeep(stateItemDoc.lists[listIdx])}));
  }

  function saveModal() {
    let newItemLists: ItemList[] = cloneDeep(stateItemDoc.lists);
    for (let i = 0; i < newItemLists.length; i++) {
      if (newItemLists[i].listID == modalState.selectedListId) {
        newItemLists[i]=cloneDeep(modalState.itemList); break;
      }
    }
    setStateItemDoc(prevState => ({...prevState, lists : newItemLists}))
    setModalState(cloneDeep(ModalStateInit));
  }

  function cancelModal() {
    setModalState(cloneDeep(ModalStateInit));
  }


  let listsElem=[];
  let listsInnerElem=[];
//  listsElem.push(<IonGrid>);
  listsInnerElem.push(<IonRow key="listlabelrow">
      <IonCol size="5"><IonLabel key="listlabel" position='stacked'>Item is on these lists:</IonLabel></IonCol>
      <IonCol size="2"><IonLabel key="stocklabel" position="stacked">Stocked</IonLabel></IonCol>
      <IonCol size="2"><IonLabel key="countlabel" position="stacked">Quantity</IonLabel></IonCol>
      <IonCol size="2"><IonLabel key="diff" position="stacked">Diff</IonLabel></IonCol>
      <IonCol size="1"><IonLabel key="resetlabel" position="stacked">Edit</IonLabel></IonCol></IonRow>
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
          <IonCol size="1"><IonCheckbox aria-label="" onIonChange={(e: any) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox></IonCol>
          <IonCol size="4"><IonLabel>{listName}</IonLabel></IonCol>
          <IonCol size="2"><IonCheckbox aria-label="" onIonChange={(e: any) => changeStockedAt(listID,Boolean(e.detail.checked))} checked={stockedAt}></IonCheckbox></IonCol>
          <IonCol size="2">{stateItemDoc.lists[i].quantity}</IonCol>
          <IonCol size="2">{listIsDifferentThanCommon(i)}</IonCol>
          <IonCol size="1"><IonButton onClick={(e) => {console.log(e); editListModal(listID)}} ><IonIcon icon={pencilOutline}></IonIcon></IonButton></IonCol>
        </IonRow>
      )
    }
  }
  listsElem.push(<IonItem key="listlist"><IonGrid>{listsInnerElem}</IonGrid></IonItem>)
  listsElem.push(<IonItem key="diffNote"><IonText>A * in diff indicates that this list contains values different than the common ones show above.</IonText></IonItem>)

  let modalEditorElem: any = [];
  modalEditorElem.push(
    <IonModal key="item-modal" id="item-list" isOpen={modalState.isOpen}>
      <IonTitle>Editing {modalState.selectedListName} List values</IonTitle>
      <IonList>
        <IonGrid>
          <IonRow>
            <IonCol size="4">Active</IonCol>
            <IonCol size="4">Completed</IonCol>
            <IonCol size="4">Stocked Here</IonCol>
          </IonRow>
          <IonRow>
            <IonCol size="4"><IonCheckbox aria-label="" labelPlacement="end" checked={modalState.itemList.active} onIonChange={(e) => setModalState(prevState =>({...prevState,itemList: {...prevState.itemList, active: e.detail.checked}}) )}></IonCheckbox></IonCol>
            <IonCol size="4"><IonCheckbox aria-label="" labelPlacement="end" checked={modalState.itemList.completed} onIonChange={(e) => setModalState(prevState =>({...prevState,itemList: {...prevState.itemList,completed: e.detail.checked}}) )}></IonCheckbox></IonCol>
            <IonCol size="4"><IonCheckbox aria-label="" labelPlacement="end" checked={modalState.itemList.stockedAt} onIonChange={(e) => setModalState(prevState =>({...prevState,itemList: {...prevState.itemList,stockedAt: e.detail.checked}}) )}></IonCheckbox></IonCol>
          </IonRow>
        </IonGrid>
        <IonItem>
          <IonSelect label="Category" labelPlacement="stacked" interface="popover" onIonChange={(ev) => setModalState(prevState => ({...prevState, itemList: {...prevState.itemList, categoryID: String(ev.detail.value)}}))} value={modalState.itemList.categoryID}>
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
        <IonItem>
          <IonInput key="modal-qty" label="Quantity" labelPlacement="stacked" type="number" min="0" max="9999" value={modalState.itemList.quantity} onIonChange={(e) => setModalState(prevState => ({...prevState,itemList: {...prevState.itemList,quantity: Number(e.detail.value)}}))}></IonInput>
          <IonSelect label="" interface="popover" onIonChange={(ev) => setModalState(prevState => ({...prevState, itemList: {...prevState.itemList, uomName: String(ev.detail.value)}}))} value={modalState.itemList.uomName}>
                    <IonSelectOption key="uom-undefined" value={null}>No UOM</IonSelectOption>
                    {uomDocs.map((uom: any) => (
                      <IonSelectOption key={uom.name} value={uom.name}>{uom.description}</IonSelectOption>
                    ))}
          </IonSelect>
          <IonButton fill="default" onClick={(e) => {addUOMPopup()}}><IonIcon icon={addOutline}></IonIcon></IonButton>
        </IonItem>
        <IonItem><IonText>Item was purchased from here {modalState.itemList.boughtCount} times</IonText><IonButton slot="end" onClick={() => setModalState(prevState => ({...prevState, itemList: {...prevState.itemList, boughtCount: 0}}))}>Reset</IonButton></IonItem>
        <IonItem><IonTextarea label='Note' labelPlacement='stacked' value={modalState.itemList.note} onIonChange={(e) => setModalState(prevState => ({...prevState,itemList: {...prevState.itemList,note: String(e.detail.value)}}))}></IonTextarea></IonItem>
        <IonItem>
          <IonButton key="modalok" onClick={() => saveModal()}>OK</IonButton>
          <IonButton key="modal-close" onClick={() => cancelModal()}>Cancel</IonButton>
        </IonItem>  
      </IonList>
    </IonModal>
  )
  
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
              <IonInput label="Name" labelPlacement="stacked" type="text" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, name: e.detail.value})} value={stateItemDoc.name}></IonInput>
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
                  <IonCol size="3"><IonInput label="" type="number" min="0" max="9999" onIonChange={(e: any) => updateAllKey("quantity",e.detail.value)} value={getCommonKey("quantity")}></IonInput></IonCol>
                  <IonCol size="8">
                    <IonSelect label="" interface="popover" onIonChange={(ev) => updateAllKey("uomName", ev.detail.value)} value={getCommonKey("uomName")}>
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
                <IonSelect label="Category" labelPlacement="stacked" interface="popover" onIonChange={(ev) => updateAllKey("categoryID",ev.detail.value)} value={getCommonKey("categoryID")}>
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
                <IonTextarea label="Note" labelPlacement="stacked" placeholder="Item Note" inputMode='text' debounce={100} rows={4} onIonChange={(ev) => updateAllKey("note",String(ev.detail.value))} value={getCommonKey("note")}>   
                </IonTextarea>
              </IonItem>
            </IonCard>
            {listsElem}
            {modalEditorElem}
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
