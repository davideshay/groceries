import {  IonButton,  IonItem, IonLabel, IonCheckbox, IonIcon, 
    IonGrid, IonRow, IonCol, IonText,  } from '@ionic/react';
import { pencilOutline } from 'ionicons/icons';
import { Fragment, useState } from 'react';
import { getCommonKey, sortedItemLists } from './ItemUtilities';
import { ItemDoc, ItemList, ListDoc  } from '../components/DataTypes';
import ItemListsModal from '../components/ItemListsModal';
import { cloneDeep } from 'lodash';
import { ModalState, ModalStateInit } from '../components/DataTypes';
import './ItemLists.css';

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
    
    function listIsDifferentThanCommon(sortedLists: ItemList[], listIdx: number): boolean {
        let combinedKeys: any ={};
        let maxKey="";
        let maxCnt=1;
        let thisKey="";
        for (let i = 0; i < sortedLists.length; i++) {
          const thisList=sortedLists[i];
          let listKey="";
          for (const [key, value] of Object.entries(thisList).sort((a,b) => a[0].toUpperCase().localeCompare(b[0].toUpperCase()))) {
            if (!["listID","boughtCount"].includes(key)) {
              listKey=listKey+key+value;
            }
          }
          if (combinedKeys.hasOwnProperty(listKey)) {
            combinedKeys[listKey] = combinedKeys[listKey] + 1;
            if (combinedKeys[listKey] > maxCnt) {
              maxCnt=combinedKeys[listKey];
              maxKey=listKey;
            }
          } else {
            combinedKeys[listKey] = 1;
          }
          if (i === listIdx) {
            thisKey=listKey;
          }
        }
        // check if max count occurs > 1 in the list, if so all rows should be different
        let maxCheckCount=0;
        for (const [key, value] of Object.entries(combinedKeys)) {
          if (value == maxCnt) { maxCheckCount++;}
        }
        console.log(cloneDeep({combinedKeys,thisKey,maxCnt,maxCheckCount}));
        return ((combinedKeys[thisKey] < maxCnt) || (maxCheckCount > 1)) ;
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
        <IonCol size="10"><IonLabel key="listlabel" position='stacked'>Item is on these lists:</IonLabel></IonCol>
        <IonCol size="2"><IonLabel key="resetlabel" position="stacked">Edit</IonLabel></IonCol></IonRow>
    )
    let sortedLists = sortedItemLists(props.stateItemDoc.lists,props.listDocs);
    
    for (let i = 0; i < sortedLists.length; i++) {
      let listID = sortedLists[i].listID;
      let itemFoundIdx=props.listDocs.findIndex((element: any) => (element._id === listID));
      if (itemFoundIdx !== -1) {
        let itemActive=(sortedLists[i].active);
        let listName=(props.listDocs as any)[itemFoundIdx].name;
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
        <ItemListsModal history={props.history} stateItemDoc={props.stateItemDoc} setStateItemDoc={props.setStateItemDoc} 
                        categoryDocs={props.categoryDocs} uomDocs={props.uomDocs} modalState={modalState} setModalState={setModalState}
                        addCategoryPopup={props.addCategoryPopup} addUOMPopup={props.addUOMPopup} />
        </Fragment>
    )

}

export default ItemLists;