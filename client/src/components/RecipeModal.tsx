import { useContext } from "react";
import { GlobalDataContext } from "./GlobalDataProvider";
import { translatedItemName, translatedUOMName } from "./translationUtilities";
import { RecipeDoc, RecipeItem } from "./DBSchema";
import { IonButton, IonIcon, IonInput, IonItem, IonList, IonModal, IonSelect, IonSelectOption, IonTextarea, IonTitle } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { cloneDeep } from "lodash-es";
import { returnDownBackOutline } from "ionicons/icons";

export type RecipeSearchData = {
    name: string,
    globalItemID: string | null
}

export type RecipeSearchRow = {
    id: string,
    display: string,
    data: RecipeSearchData
}

type RecipeModalProps = {
    isOpen: boolean;
    setIsOpenFalse: () => void
    recipeItem: RecipeItem,
    selectedItemIdx: number,
    recipeDoc: RecipeDoc,
    updateRecipeDoc: (newRecipeDoc: RecipeDoc) => void
    updateRecipeName: (name: string) => void
}

const RecipeModal: React.FC<RecipeModalProps> = (props: RecipeModalProps) => {
    const globalData = useContext(GlobalDataContext); 
    const { t } = useTranslation();

return (
    <IonModal id="recipe-item" isOpen={props.isOpen} onDidDismiss={(ev)=>{props.setIsOpenFalse()}}>
        <IonTitle className="modal-title">{t('general.item_on_recipe') + translatedItemName(props.recipeItem.globalItemID,props.recipeItem.name, props.recipeItem.name)}</IonTitle>
        <IonList>
        <IonItem key="name">
            <IonInput type="text" label={t("general.name") as string} labelPlacement="stacked"
                disabled={props.recipeItem.globalItemID !== null}
                value={translatedItemName(props.recipeItem.globalItemID,props.recipeItem.name, props.recipeItem.name)}
                onIonInput={(ev)=>{ props.updateRecipeName(String(ev.detail.value))}}>
            </IonInput>
        </IonItem>
        <IonItem key="r-qty">
            <IonInput type="number" label={t("general.recipe_quantity") as string} labelPlacement="stacked"
            value={props.recipeItem.recipeQuantity}
            onIonInput={(ev) => {
                let updRecipeDoc: RecipeDoc = cloneDeep(props.recipeDoc);
                updRecipeDoc.items[props.selectedItemIdx].recipeQuantity = Number(ev.detail.value);
                props.updateRecipeDoc(updRecipeDoc);
            }} />
        </IonItem>
        <IonItem key="r-uom">
            <IonSelect label={t("general.recipe_uom") as string} labelPlacement="stacked" interface="popover"
                value={props.recipeItem.recipeUOMName} onIonChange={(ev) => {
                    let updRecipeDoc: RecipeDoc=cloneDeep(props.recipeDoc);
                    updRecipeDoc.items[props.selectedItemIdx].recipeUOMName = ev.detail.value;
                    props.updateRecipeDoc(updRecipeDoc); }}>
                <IonSelectOption key="uom-undefined" value={null}>{t('general.no_uom')}</IonSelectOption>
                {globalData.uomDocs.filter(uom => (["system",props.recipeDoc.listGroupID].includes(String(uom.listGroupID)))).map((uom) => (
                        <IonSelectOption key={uom.name} value={uom.name}>
                        {translatedUOMName(uom._id as string,uom.description,uom.pluralDescription)}
                        </IonSelectOption>
                    ))}
            </IonSelect>
        </IonItem>
        <IonItem key="s-qty">
            <IonInput type="number" label={t("general.shopping_quantity") as string} labelPlacement="stacked"
                value={props.recipeItem.shoppingQuantity} onIonInput={(ev) => {
                    let updRecipeDoc: RecipeDoc=cloneDeep(props.recipeDoc);
                    updRecipeDoc.items[props.selectedItemIdx].shoppingQuantity = Number(ev.detail.value);
                    props.updateRecipeDoc(updRecipeDoc);}} />
        </IonItem>  
        <IonItem key="s-uom">
            <IonSelect label={t("general.shopping_uom") as string} labelPlacement="stacked" interface="popover"
                value={props.recipeItem.shoppingUOMName} onIonChange={(ev) => {
                    let updRecipeDoc: RecipeDoc=cloneDeep(props.recipeDoc);
                    updRecipeDoc.items[props.selectedItemIdx].shoppingUOMName = ev.detail.value;
                    props.updateRecipeDoc(updRecipeDoc);}}>
                <IonSelectOption key="uom-undefined" value={null}>{t('general.no_uom')}</IonSelectOption>
                {globalData.uomDocs.filter(uom => (["system",props.recipeDoc.listGroupID].includes(String(uom.listGroupID)))).map((uom) => (
                        <IonSelectOption key={uom.name} value={uom.name}>
                        {translatedUOMName(uom._id as string,uom.description, uom.pluralDescription)}
                        </IonSelectOption>
                    ))}
            </IonSelect>
        </IonItem>
        <IonItem key="note">
            <IonTextarea label={t("general.note") as string} labelPlacement="stacked"
                value={props.recipeItem.note} onIonInput={(ev) => {
                    let updRecipeDoc: RecipeDoc=cloneDeep(props.recipeDoc);
                    updRecipeDoc.items[props.selectedItemIdx].note = String(ev.detail.value);
                    props.updateRecipeDoc(updRecipeDoc);}} />
        </IonItem>
        <IonItem key="button">
            <IonButton fill="solid" onClick={()=>{props.setIsOpenFalse()}}>
            <IonIcon icon={returnDownBackOutline}></IonIcon>
            Go Back</IonButton>
        </IonItem>
        </IonList>
    </IonModal>
        
    )
}

export default RecipeModal;