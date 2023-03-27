import {  IonButton,  IonItem, IonLabel, IonCheckbox, IonIcon, 
    IonGrid, IonRow, IonCol, IonText,  } from '@ionic/react';
import { pencilOutline } from 'ionicons/icons';
import { Fragment, useContext, useEffect, useState } from 'react';
import { sortedItemLists, listIsDifferentThanCommon } from './ItemUtilities';
import { CategoryDoc, UomDoc, ItemDoc, ItemList, ListDoc, ListDocs } from './DBSchema';
import ItemListsModal from '../components/ItemListsModal';
import { cloneDeep } from 'lodash';
import { ModalState, ModalStateInit } from '../components/DataTypes';
import './ItemLists.css';
import { GlobalDataContext } from './GlobalDataProvider';

export type ItemListsProps = { 
    stateItemDoc: ItemDoc,
    setStateItemDoc: any,
    addCategoryPopup: () => void,
    addUOMPopup: () => void
}
    
const ItemLists: React.FC<ItemListsProps> = (props: ItemListsProps) => {
    const [modalState, setModalState] = useState<ModalState>(ModalStateInit)
    const globalData = useContext(GlobalDataContext)

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
        
    function editListModal(listID: string) {
        let listIdx = 0;
        for (let i = 0; i < props.stateItemDoc.lists.length; i++) {
          if (props.stateItemDoc.lists[i].listID == listID) { listIdx=i; break;}
        }
        let listFoundIdx=globalData.listDocs.findIndex((element: ListDoc) => (element._id === listID));
        let listName = (listFoundIdx == -1) ? "" : globalData.listDocs[listFoundIdx].name
        setModalState(prevState => ({...prevState,isOpen: true, selectedListId: listID, 
          selectedListName: listName, selectedListIdx: listIdx, itemList: cloneDeep(props.stateItemDoc.lists[listIdx])}));
    }

    let listsElem=[];
    let listsInnerElem=[];
    listsInnerElem.push(<IonRow key="listlabelrow">
        <IonCol size="10"><IonLabel key="listlabel" position='stacked'>Item is on these lists:</IonLabel></IonCol>
        <IonCol size="2"><IonLabel key="resetlabel" position="stacked">Edit</IonLabel></IonCol></IonRow>
    )
    let sortedLists = sortedItemLists(props.stateItemDoc.lists,globalData.listDocs);
    
    for (let i = 0; i < sortedLists.length; i++) {
      let listID = sortedLists[i].listID;
      let itemFoundIdx=globalData.listDocs.findIndex((element: ListDoc) => (element._id === listID));
      if (itemFoundIdx !== -1) {
        let itemActive=(sortedLists[i].active);
        let listName=globalData.listDocs[itemFoundIdx].name;
        let stockedAt=(sortedLists[i].stockedAt);
        listsInnerElem.push(
          <IonRow key={listID} class={listIsDifferentThanCommon(sortedLists,i) ? "highlighted-row ion-no-padding" : "ion-no-padding"}>
            <IonCol class="ion-no-padding" size="1"><IonCheckbox aria-label="" onIonChange={(e: any) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox></IonCol>
            <IonCol class="ion-no-padding ion-align-self-center" size="9"><IonLabel>{listName}</IonLabel></IonCol>
            <IonCol class="ion-no-padding" size="2"><IonButton onClick={(e) => {console.log(e); editListModal(listID)}} ><IonIcon icon={pencilOutline}></IonIcon></IonButton></IonCol>
          </IonRow>
        )
      }
    }
    listsElem.push(<IonItem key="listlist"><IonGrid>{listsInnerElem}</IonGrid></IonItem>)
    listsElem.push(<IonItem key="diffNote"><IonText class="small-note-text">Highlighted lists have different values at the item-list level</IonText></IonItem>)
  
    return (
        <Fragment key="itemlists">
        {listsElem}
        <ItemListsModal stateItemDoc={props.stateItemDoc} setStateItemDoc={props.setStateItemDoc} 
                        modalState={modalState} setModalState={setModalState}
                        addCategoryPopup={props.addCategoryPopup} addUOMPopup={props.addUOMPopup} />
        </Fragment>
    )

}

export default ItemLists;