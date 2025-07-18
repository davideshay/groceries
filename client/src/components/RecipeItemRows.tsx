import { translatedItemName, translatedUOMShortName } from "./translationUtilities";
import { RecipeDoc, UomDoc } from "./DBSchema";
import { IonButton, IonCheckbox, IonCol, IonGrid, IonIcon, IonItem, IonRow } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { cloneDeep } from "lodash-es";
import { pencilOutline, trashOutline } from "ionicons/icons";
import Fraction from 'fraction.js';
import { useGlobalDataStore } from "./GlobalData";

type RecipeItemRowProps = {
    recipeDoc: RecipeDoc,
    updateRecipeDoc: (newRecipeDoc: RecipeDoc) => void,
    editItemModal: (index: number) => void
}

const RecipeItemRows: React.FC<RecipeItemRowProps> = (props: RecipeItemRowProps) => {
    const uomDocs = useGlobalDataStore((state) => state.uomDocs);
    const recipeListGroup = useGlobalDataStore((state) => state.recipeListGroup);
    const { t } = useTranslation();

    function checkItemOnList(checked: boolean,index: number) {
        const updRecipeDoc : RecipeDoc= cloneDeep(props.recipeDoc);
        updRecipeDoc.items[index].addToList = checked;
        props.updateRecipeDoc(updRecipeDoc);
      }
    
    function deleteItemFromList(index: number) {
        const updRecipeDoc: RecipeDoc = cloneDeep(props.recipeDoc);
        updRecipeDoc.items.splice(index,1);
        props.updateRecipeDoc(updRecipeDoc);
      }

    type RecipeItemRow = {
        index: number,
        checked: boolean,
        name: string,
    }

    const recipeItemRows: RecipeItemRow[] = [];

    props.recipeDoc.items.forEach((item,index) => {
      const recipeItemRow: RecipeItemRow = {
            index: index, checked: item.addToList, name: ""};
      const itemName = translatedItemName(item.globalItemID,item.name,item.name,item.recipeQuantity)
      let uomDesc = "";
      if (item.recipeUOMName !== null && item.recipeUOMName !== "") {
          const uomDoc = uomDocs.find((el: UomDoc) => (el.name === item.recipeUOMName && ["system",recipeListGroup].includes(String(el.listGroupID))));
          if (uomDoc !== undefined) {
              uomDesc = translatedUOMShortName(item.recipeUOMName,uomDocs,props.recipeDoc.listGroupID,item.recipeQuantity)
          }
      }
      let quantityUOMDesc = "";
      if ((item.recipeQuantity !== 0) && ((item.recipeQuantity > 1) || uomDesc !== "")) {
          const rq = new Fraction(item.recipeQuantity);
          quantityUOMDesc = rq.toFraction(true).toString() + ((uomDesc === "" ? "" : " " + uomDesc));
      }
      let fullItemName = itemName;
      if (quantityUOMDesc !== "") { fullItemName = fullItemName + " (" + quantityUOMDesc +")"}
      recipeItemRow.name = fullItemName;
      recipeItemRows.push(recipeItemRow);
    })
    
return (
    <IonItem key="items-in-recipe">
    <IonGrid>
      <IonRow key="item-header">
        <IonCol size="2">{t("general.add_question")}</IonCol>
        <IonCol size="10">{t('general.item')}</IonCol>
      </IonRow>
      {recipeItemRows.map(itemRow => (
            <IonRow key={"item-"+itemRow.index} class="ion-align-items-center">
            <IonCol size="2"><IonCheckbox aria-label="" checked={itemRow.checked}
                onIonChange={(ev) => checkItemOnList(ev.detail.checked,itemRow.index)}></IonCheckbox></IonCol>
            <IonCol  size="8">{itemRow.name}</IonCol>
            <IonCol size="1"><IonButton fill="clear" onClick={() => props.editItemModal(itemRow.index)}>
                <IonIcon icon={pencilOutline}/></IonButton></IonCol>
            <IonCol size="1"><IonButton fill="clear" onClick={() => deleteItemFromList(itemRow.index)}>
              <IonIcon icon={trashOutline} /></IonButton>
            </IonCol>
          </IonRow>
      ))
        }
    </IonGrid>
  </IonItem>
    )
}

export default RecipeItemRows;