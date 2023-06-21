import { useContext } from "react";
import { GlobalDataContext } from "./GlobalDataProvider";
import { translatedItemName } from "./translationUtilities";
import { RecipeDoc, UomDoc } from "./DBSchema";
import { IonButton, IonCheckbox, IonCol, IonGrid, IonIcon, IonItem, IonRow } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { cloneDeep } from "lodash";
import { pencilOutline, trashOutline } from "ionicons/icons";
let fracty = require('fracty');

type RecipeItemRowProps = {
    recipeDoc: RecipeDoc,
    updateRecipeDoc: (newRecipeDoc: RecipeDoc) => void,
    editItemModal: (index: number) => void
}

const RecipeItemRows: React.FC<RecipeItemRowProps> = (props: RecipeItemRowProps) => {
    const globalData = useContext(GlobalDataContext); 
    const { t } = useTranslation();

    function checkItemOnList(checked: boolean,index: number) {
        let updRecipeDoc : RecipeDoc= cloneDeep(props.recipeDoc);
        updRecipeDoc.items[index].addToList = checked;
        props.updateRecipeDoc(updRecipeDoc);
      }
    
    function deleteItemFromList(index: number) {
        let updRecipeDoc: RecipeDoc = cloneDeep(props.recipeDoc);
        updRecipeDoc.items.splice(index,1);
        props.updateRecipeDoc(updRecipeDoc);
      }

    type RecipeItemRow = {
        index: number,
        checked: boolean,
        name: string,
    }

    let recipeItemRows: RecipeItemRow[] = [];

    props.recipeDoc.items.forEach((item,index) => {
      let recipeItemRow: RecipeItemRow = {
            index: index, checked: item.addToList, name: ""};
      let itemName = translatedItemName(item.globalItemID,item.name,item.name,item.recipeQuantity)
      let uomDesc = "";
      if (item.recipeUOMName !== null && item.recipeUOMName !== "") {
          const uomDoc = globalData.uomDocs.find((el: UomDoc) => (el.name === item.recipeUOMName && ["system","recipe"].includes(String(el.listGroupID))));
          if (uomDoc !== undefined) {
              uomDesc = t("uom."+item.recipeUOMName,{ count: item.recipeQuantity});
          }
      }
      let quantityUOMDesc = "";
      if ((item.recipeQuantity !== 0) && ((item.recipeQuantity > 1) || uomDesc !== "")) {
          quantityUOMDesc = fracty(item.recipeQuantity).toString() + ((uomDesc === "" ? "" : " " + uomDesc));
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
            <IonRow key={"item-"+itemRow.index}>
            <IonCol size="2"><IonCheckbox aria-label="" checked={itemRow.checked}
                onIonChange={(ev) => checkItemOnList(ev.detail.checked,itemRow.index)}></IonCheckbox></IonCol>
            <IonCol size="8">{itemRow.name}</IonCol>
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