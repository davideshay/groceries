import {  IonButton,  IonItem, IonLabel, IonCheckbox, IonIcon, 
    IonGrid, IonRow, IonCol, IonText, CheckboxCustomEvent,  } from '@ionic/react';
import { pencilOutline } from 'ionicons/icons';
import { Fragment, useState, SetStateAction } from 'react';
import { sortedItemLists, listIsDifferentThanCommon } from './ItemUtilities';
import { ItemDoc,  ItemList,  ItemListInit,  ListDoc } from './DBSchema';
import ItemListsModal from '../components/ItemListsModal';
import { cloneDeep } from 'lodash-es';
import { ModalState, ModalStateInit } from '../components/DataTypes';
import './ItemLists.css';
import { useTranslation } from 'react-i18next';
import { useGlobalDataStore } from './GlobalData';

export type ItemListsProps = { 
    stateItemDoc: ItemDoc,
    setStateItemDoc: React.Dispatch<SetStateAction<ItemDoc>>,
    addCategoryPopup: () => void,
    addUOMPopup: () => void
}
    
const ItemLists: React.FC<ItemListsProps> = (props: ItemListsProps) => {
    const [modalState, setModalState] = useState<ModalState>(ModalStateInit)
    const listDocs = useGlobalDataStore((state) => state.listDocs);
    const { t } = useTranslation()
    
    function selectList(listID: string, updateVal: boolean) {
        let newItemDoc=cloneDeep(props.stateItemDoc) as ItemDoc;
        let listFound=false
        for (let i = 0; i < newItemDoc.lists.length; i++) {
            if (newItemDoc.lists[i].listID === listID) {
            newItemDoc.lists[i].active = updateVal;
            listFound=true;
            if(updateVal) {newItemDoc.lists[i].boughtCount++}
            }    
        }
        if (!listFound) {
            let listObj: ItemList = cloneDeep(ItemListInit) as ItemList;
            listObj.listID = listID;
            listObj.boughtCount = 0;
            listObj.active = updateVal;
            listObj.completed = false;
            newItemDoc.lists.push(listObj);
        }
        props.setStateItemDoc(newItemDoc);
    }
        
    function editListModal(listID: string) {
        let listIdx = 0;
        for (let i = 0; i < props.stateItemDoc.lists.length; i++) {
          if (props.stateItemDoc.lists[i].listID === listID) { listIdx=i; break;}
        }
        let listFoundIdx=listDocs.findIndex((element: ListDoc) => (element._id === listID));
        let listName = (listFoundIdx === -1) ? "" : listDocs[listFoundIdx].name
        setModalState(prevState => ({...prevState,isOpen: true, selectedListId: listID, 
          selectedListName: listName, selectedListIdx: listIdx, itemList: cloneDeep(props.stateItemDoc.lists[listIdx])}));
    }

    let listsElem=[];
    let listsInnerElem=[];
    listsInnerElem.push(<IonRow key="listlabelrow">
        <IonCol size="10"><IonLabel key="listlabel" position='stacked'>{t('itemtext.item_is_on_these_lists')}</IonLabel></IonCol>
        <IonCol size="2"><IonLabel key="resetlabel" position="stacked">{t('general.edit')}</IonLabel></IonCol></IonRow>
    )
    let sortedLists = sortedItemLists(props.stateItemDoc.lists,listDocs);
    
    for (let i = 0; i < sortedLists.length; i++) {
      let listID = sortedLists[i].listID;
      let itemFoundIdx=listDocs.findIndex((element: ListDoc) => (element._id === listID));
      if (itemFoundIdx !== -1) {
        let itemActive=(sortedLists[i].active);
        let listName=listDocs[itemFoundIdx].name;
        listsInnerElem.push(
          <IonRow key={listID} className={listIsDifferentThanCommon(sortedLists,i) ? "highlighted-row ion-no-padding" : "ion-no-padding"}>
            <IonCol className="ion-no-padding" size="1"><IonCheckbox aria-label="" onIonChange={(e: CheckboxCustomEvent) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox></IonCol>
            <IonCol className="ion-no-padding ion-align-self-center" size="9"><IonLabel>{listName}</IonLabel></IonCol>
            <IonCol className="ion-no-padding" size="2"><IonButton onClick={() => {editListModal(listID)}} ><IonIcon icon={pencilOutline}></IonIcon></IonButton></IonCol>
          </IonRow>
        )
      }
    }
    listsElem.push(<IonItem key="listlist"><IonGrid>{listsInnerElem}</IonGrid></IonItem>)
    listsElem.push(<IonItem key="diffNote"><IonText className="small-note-text">{t('itemtext.highlighted_lists_diff_values')}</IonText></IonItem>)
  
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