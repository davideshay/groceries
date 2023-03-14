import {  IonButton,  IonItem, IonLabel, IonCheckbox, IonIcon, 
    IonGrid, IonRow, IonCol, IonText,  } from '@ionic/react';
import { pencilOutline } from 'ionicons/icons';
import { Fragment, useState } from 'react';
import { getCommonKey } from './ItemUtilities';
import { ItemDoc  } from '../components/DataTypes';
import ItemListsModal from '../components/ItemListsModal';
import { cloneDeep } from 'lodash';
import { ModalState, ModalStateInit } from '../components/DataTypes';

export type ItemListsProps = { 
    history: any,
    stateItemDoc: ItemDoc,
    setStateItemDoc: any,
    listDocs: any,
    categoryDocs: any,
    uomDocs: any,
    addCategoryPopup: () => void,
    addUOMPopup: () => void
}
    
const ItemLists: React.FC<ItemListsProps> = (props: ItemListsProps) => {
    const [modalState, setModalState] = useState<ModalState>(ModalStateInit)

    function changeStockedAt(listID: string, updateVal: boolean) {
        let newItemDoc=cloneDeep(props.stateItemDoc);
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
        props.setStateItemDoc(newItemDoc);
      }
    
    function selectList(listID: string, updateVal: boolean) {
        let newItemDoc=cloneDeep(props.stateItemDoc);
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
        props.setStateItemDoc(newItemDoc);
    }
    
    function listIsDifferentThanCommon(listIdx: number) {
        let anyDifferences=false;
        for (const [key, value] of Object.entries(props.stateItemDoc.lists[listIdx])) {
          if (key != "listID") { 
            let commonVal = getCommonKey(props.stateItemDoc,key);
            if (commonVal != value) { anyDifferences=true}
          }  
        }
        return (anyDifferences ? "*" : "")
      }
    
    function editListModal(listID: string) {
        console.log("in ELM: list: ",listID);
        let listIdx = 0;
        for (let i = 0; i < props.stateItemDoc.lists.length; i++) {
          if (props.stateItemDoc.lists[i].listID == listID) { listIdx=i; break;}
        }
        let listFoundIdx=props.listDocs.findIndex((element: any) => (element._id === listID));
        let listName = (listFoundIdx == -1) ? "" : props.listDocs[listFoundIdx].name
        console.log("edit list modal, listID: ",listID, listIdx);
        setModalState(prevState => ({...prevState,isOpen: true, selectedListId: listID, 
          selectedListName: listName, selectedListIdx: listIdx, itemList: cloneDeep(props.stateItemDoc.lists[listIdx])}));
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
    for (let i = 0; i < (props.stateItemDoc as any).lists.length; i++) {
      let listID = (props.stateItemDoc as any).lists[i].listID;
      let itemFoundIdx=props.listDocs.findIndex((element: any) => (element._id === listID));
      if (itemFoundIdx !== -1) {
        let itemActive=(((props.stateItemDoc as any).lists[i].active));
        let listName=(props.listDocs as any)[itemFoundIdx].name;
        let stockedAt=((props.stateItemDoc as any).lists[i].stockedAt);
        listsInnerElem.push(
          <IonRow key={listID}>
            <IonCol size="1"><IonCheckbox aria-label="" onIonChange={(e: any) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox></IonCol>
            <IonCol size="4"><IonLabel>{listName}</IonLabel></IonCol>
            <IonCol size="2"><IonCheckbox aria-label="" onIonChange={(e: any) => changeStockedAt(listID,Boolean(e.detail.checked))} checked={stockedAt}></IonCheckbox></IonCol>
            <IonCol size="2">{props.stateItemDoc.lists[i].quantity}</IonCol>
            <IonCol size="2">{listIsDifferentThanCommon(i)}</IonCol>
            <IonCol size="1"><IonButton onClick={(e) => {console.log(e); editListModal(listID)}} ><IonIcon icon={pencilOutline}></IonIcon></IonButton></IonCol>
          </IonRow>
        )
      }
    }
    listsElem.push(<IonItem key="listlist"><IonGrid>{listsInnerElem}</IonGrid></IonItem>)
    listsElem.push(<IonItem key="diffNote"><IonText>A * in diff indicates that this list contains values different than the common ones show above.</IonText></IonItem>)
  

    return (
        <Fragment key="itemlists">
        {listsElem}
        <ItemListsModal history={props.history} stateItemDoc={props.stateItemDoc} setStateItemDoc={props.setStateItemDoc} 
                        categoryDocs={props.categoryDocs} uomDocs={props.uomDocs} modalState={modalState} setModalState={setModalState}
                        addCategoryPopup={props.addCategoryPopup} addUOMPopup={props.addUOMPopup} />
        </Fragment>
    )

}

export default ItemLists;