import { IonTitle,  IonButton, IonList, IonInput, IonItem, IonSelect, IonCheckbox, IonIcon,
    IonSelectOption, IonTextarea, IonGrid, IonRow, IonCol, IonText, IonModal, IonToolbar, IonButtons } from '@ionic/react';
import { addOutline, closeCircleOutline, saveOutline } from 'ionicons/icons';    
import { SetStateAction, useContext } from 'react';    
import {  ModalState, ModalStateInit } from '../components/DataTypes';
import {  ItemDoc, ItemList} from '../components/DBSchema';
import { cloneDeep } from 'lodash';
import { GlobalDataContext } from './GlobalDataProvider';

type ModalProps = {
    stateItemDoc: ItemDoc,
    setStateItemDoc: React.Dispatch<SetStateAction<ItemDoc>>,
    modalState: ModalState,
    setModalState: React.Dispatch<SetStateAction<ModalState>>,
    addCategoryPopup: () => void,
    addUOMPopup: () => void
}
  
const ItemListsModal: React.FC<ModalProps> = (props: ModalProps) => {
    const globalData = useContext(GlobalDataContext);
    
      function saveModal() {
        let newItemLists: ItemList[] = cloneDeep(props.stateItemDoc.lists);
        for (let i = 0; i < newItemLists.length; i++) {
          if (newItemLists[i].listID === props.modalState.selectedListId) {
            newItemLists[i]=cloneDeep(props.modalState.itemList); break;
          }
        }
        props.setStateItemDoc(prevState => ({...prevState, lists : newItemLists}))
        props.setModalState(cloneDeep(ModalStateInit));
      }
    
      function cancelModal() {
        props.setModalState(cloneDeep(ModalStateInit));
      }
    
     return ( 
    <IonModal key="item-modal" id="item-list" isOpen={props.modalState.isOpen}>
     <IonTitle class="modal-title">Editing {props.modalState.selectedListName} List Values</IonTitle>
     <IonList>
        <IonGrid>
          <IonRow>
            <IonCol size="4">Active</IonCol>
            <IonCol size="4">Completed</IonCol>
            <IonCol size="4">Stocked Here</IonCol>
          </IonRow>
          <IonRow>
            <IonCol size="4"><IonCheckbox aria-label="" labelPlacement="end" checked={props.modalState.itemList.active} onIonChange={(e) => props.setModalState(prevState =>({...prevState,itemList: {...prevState.itemList, active: e.detail.checked}}) )}></IonCheckbox></IonCol>
            <IonCol size="4"><IonCheckbox aria-label="" labelPlacement="end" checked={props.modalState.itemList.completed} onIonChange={(e) => props.setModalState(prevState =>({...prevState,itemList: {...prevState.itemList,completed: e.detail.checked}}) )}></IonCheckbox></IonCol>
            <IonCol size="4"><IonCheckbox aria-label="" labelPlacement="end" checked={props.modalState.itemList.stockedAt} onIonChange={(e) => props.setModalState(prevState =>({...prevState,itemList: {...prevState.itemList,stockedAt: e.detail.checked}}) )}></IonCheckbox></IonCol>
          </IonRow>
        </IonGrid>
        <IonItem>
          <IonSelect label="Category" labelPlacement="stacked" interface="popover" onIonChange={(ev) => props.setModalState(prevState => ({...prevState, itemList: {...prevState.itemList, categoryID: ev.detail.value}}))} value={props.modalState.itemList.categoryID}>
                  <IonSelectOption key="cat-undefined" value={null}>Uncategorized</IonSelectOption>
                  {globalData.categoryDocs.map((cat) => (
                      <IonSelectOption key={cat._id} value={cat._id}>
                        {cat.name}
                      </IonSelectOption>
                  ))}
          </IonSelect>
          <IonButton slot="end" fill="default" onClick={() => {props.addCategoryPopup()}}>
            <IonIcon slot="end" icon={addOutline} ></IonIcon>
          </IonButton>  
        </IonItem>
        <IonItem>
          <IonInput key="modal-qty" label="Quantity" labelPlacement="stacked" type="number" min="0" max="9999" value={props.modalState.itemList.quantity} onIonInput={(e) => props.setModalState(prevState => ({...prevState,itemList: {...prevState.itemList,quantity: Number(e.detail.value)}}))}></IonInput>
          <IonSelect label="UoM" labelPlacement="stacked" interface="popover" onIonChange={(ev) => props.setModalState(prevState => ({...prevState, itemList: {...prevState.itemList, uomName: ev.detail.value}}))} value={props.modalState.itemList.uomName}>
                    <IonSelectOption key="uom-undefined" value={null}>No UOM</IonSelectOption>
                    {globalData.uomDocs.map((uom) => (
                      <IonSelectOption key={uom.name} value={uom.name}>{uom.description}</IonSelectOption>
                    ))}
          </IonSelect>
          <IonButton fill="default" onClick={(e) => {props.addUOMPopup()}}><IonIcon icon={addOutline}></IonIcon></IonButton>
        </IonItem>
        <IonItem><IonText>Item was purchased from here {props.modalState.itemList.boughtCount} times</IonText><IonButton slot="end" onClick={() => props.setModalState(prevState => ({...prevState, itemList: {...prevState.itemList, boughtCount: 0}}))}>Reset</IonButton></IonItem>
        <IonItem><IonTextarea label='Note' labelPlacement='stacked' value={props.modalState.itemList.note} onIonChange={(e) => props.setModalState(prevState => ({...prevState,itemList: {...prevState.itemList,note: String(e.detail.value)}}))}></IonTextarea></IonItem>
      </IonList>
      <IonToolbar>       
        <IonButtons slot="secondary"> 
          <IonButton fill="outline" color="secondary" key="modal-close" onClick={() => cancelModal()}><IonIcon icon={closeCircleOutline}></IonIcon>Cancel</IonButton>
        </IonButtons>
        <IonButtons slot="end">
          <IonButton fill="solid" color="primary" key="modalok" onClick={() => saveModal()}><IonIcon icon={saveOutline}></IonIcon>Save</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonModal>
    )
}

export default ItemListsModal;

  