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
        const newItemDoc=cloneDeep(props.stateItemDoc) as ItemDoc;
        let listFound=false
        for (let i = 0; i < newItemDoc.lists.length; i++) {
            if (newItemDoc.lists[i].listID === listID) {
              newItemDoc.lists[i].active = updateVal;
              listFound=true;
              if(updateVal) {newItemDoc.lists[i].boughtCount++}
            }    
        }
        if (!listFound) {
            const listObj: ItemList = cloneDeep(ItemListInit) as ItemList;
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
        const listFoundIdx=listDocs.findIndex((element: ListDoc) => (element._id === listID));
        const listName = (listFoundIdx === -1) ? "" : listDocs[listFoundIdx].name
        setModalState(prevState => ({...prevState,isOpen: true, selectedListId: listID, 
          selectedListName: listName, selectedListIdx: listIdx, itemList: cloneDeep(props.stateItemDoc.lists[listIdx])}));
    }

    const sortedLists = sortedItemLists(props.stateItemDoc.lists,listDocs);
      
    return (
        <Fragment key="itemlists">
        <IonItem key="listlist">
            <IonGrid>
                <IonRow key="listlabelrow">
                    <IonCol size="10">
                        <IonLabel key="listlabel" position='stacked'>{t('itemtext.item_is_on_these_lists')}</IonLabel>
                    </IonCol>
                    <IonCol size="2">
                        <IonLabel key="resetlabel" position="stacked">{t('general.edit')}</IonLabel>
                    </IonCol>
                </IonRow>
                {
                  sortedLists.map((list,idx) => {
                    const itemFoundIdx=listDocs.findIndex((element: ListDoc) => (element._id === list.listID));
                    if (itemFoundIdx !== -1) {
                      let rowClassName = "ion-no-padding";
                      if (listIsDifferentThanCommon(sortedLists,idx)) {
                        rowClassName += " highlighted-row";
                      }
                      return (
                        <IonRow key={list.listID} className={rowClassName}>
                            <IonCol className="ion-no-padding" size="1">
                                <IonCheckbox aria-label="" onIonChange={(e: CheckboxCustomEvent) => selectList(list.listID,Boolean(e.detail.checked))}
                                             checked={sortedLists[idx].active}>
                                </IonCheckbox>
                            </IonCol>
                            <IonCol className="ion-no-padding ion-align-self-center" size="9">
                                <IonLabel>{listDocs[idx].name}</IonLabel>
                            </IonCol>
                            <IonCol className="ion-no-padding" size="2">
                                <IonButton onClick={() => {editListModal(list.listID)}}>
                                    <IonIcon icon={pencilOutline}></IonIcon>
                                </IonButton>
                            </IonCol>
                        </IonRow>
                      )
                    }
                  })}
            </IonGrid>
        </IonItem>
        <IonItem key="diffNote">
            <IonText className="small-note-text">{t('itemtext.highlighted_lists_diff_values')}</IonText>
        </IonItem>
        <ItemListsModal stateItemDoc={props.stateItemDoc} setStateItemDoc={props.setStateItemDoc} 
                        modalState={modalState} setModalState={setModalState}
                        addCategoryPopup={props.addCategoryPopup} addUOMPopup={props.addUOMPopup} />
        </Fragment>
    )
}

export default ItemLists;