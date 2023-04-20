import { cloneDeep } from "lodash";
import { ItemDoc, ItemDocInit, ItemList, ItemListInit, RecipeItem } from "./DBSchema";
import { GlobalDataState } from "./GlobalDataProvider";
import { AddListOptions, GlobalSettings } from "./GlobalState";
import { getListGroupIDFromListOrGroupID, getRowTypeFromListOrGroupID } from "./Utilities";
import { translatedItemName, translatedUOMShortName } from "./translationUtilities";
import { RowType } from "./DataTypes";
import { getCommonKey } from "./ItemUtilities";
import { isEmpty } from "lodash";

export async function isRecipeItemOnList({ recipeItem, listOrGroupID,globalData, db} : 
    {recipeItem: RecipeItem, listOrGroupID: string | null,
    globalData : GlobalDataState, db: PouchDB.Database}): Promise<[boolean, string|null]> {

    let inList = false;
    let itemID: string|null = null
    const listGroupID = getListGroupIDFromListOrGroupID(listOrGroupID as string,globalData.listCombinedRows);
    if (listGroupID === null) {return [inList,itemID]}
    let itemExists=true;
    let itemResults: PouchDB.Find.FindResponse<{}> = {docs: []}
    try {itemResults = await db.find({
        selector: {
            type: "item",
            listGroupID: listGroupID }
    })}
    catch(err) {itemExists=false;};
    if (itemExists && itemResults.docs.length < 1) { itemExists = false};
    let foundItem: ItemDoc | null = null;
    if (itemExists) {
        for (let i = 0; i < itemResults.docs.length; i++) {
            const item = itemResults.docs[i] as ItemDoc;
// TODO : Add other plural checking once built
            if (translatedItemName(item.globalItemID,item.name).toLocaleUpperCase() == recipeItem.name.toLocaleUpperCase() ||
                (item.globalItemID !== null && (item.globalItemID == recipeItem.globalItemID) )) {
                    foundItem = cloneDeep(item);
            } 
        }
    }
    if (foundItem === null) {return [inList,itemID]}
    else { inList = true; itemID = foundItem._id as string}
    return [inList,itemID]
}
//TODO : We are relying on globalData, but after an update or add of item it won't change 
// within the outer loop/function calls so will fail 
export async function updateItemFromRecipeItem({itemID,listOrGroupID,recipeItem,globalData, settings, db}:
    {itemID: string, listOrGroupID: string | null, recipeItem: RecipeItem, globalData: GlobalDataState, 
        settings: GlobalSettings, db: PouchDB.Database}) : Promise<string> {
    
    let status="";
    if (!recipeItem.addToList) {return "Item "+recipeItem.name+" not selected to add."}
    let uomMismatch = false;
    let existingUOM = null;
    let overwroteNote = false;
    let updateError = false;
    let foundItem = null;
    let itemExists=true;
    try {foundItem = await db.get(itemID)}
    catch(err) {console.log("ERROR: ",err);itemExists=false};
    if (itemExists && foundItem == null) {itemExists =false}
    if (!itemExists) {return "No item found to update for "+recipeItem.name};
    let rowType: RowType | null = getRowTypeFromListOrGroupID(listOrGroupID as string,globalData.listCombinedRows)
    let updItem: ItemDoc = cloneDeep(foundItem);
    // TODO: filter updating of lists based on whether adding to listgroup or list
    // should also check on setting?
    updItem.lists.forEach(itemList => {
        if (!itemList.stockedAt) {return}
        if (settings.addListOption == AddListOptions.dontAddAutomatically && 
            rowType == RowType.list &&
            itemList.listID !== listOrGroupID) { return }
        itemList.active = true;
        itemList.completed = false;
        if (recipeItem.note != "") {
            if (itemList.note = "") {
                itemList.note = recipeItem.note;
            } else {
                overwroteNote = true;
                itemList.note = recipeItem.note;
            }
        }
        existingUOM = getCommonKey(updItem,"uomName",globalData.listDocs)
        if ( existingUOM === recipeItem.shoppingUOMName) {
            itemList.quantity = recipeItem.shoppingQuantity
        } else {
            uomMismatch = true;
//            itemList.quantity = recipeItem.shoppingQuantity  -- May not want to update if different
            if (itemList.note === "") {
                itemList.note = "WARNING: Unit of measure mismatch on recipe import. Recipe shopping quantity/UoM is "+ recipeItem.shoppingQuantity + " " + translatedUOMShortName(recipeItem.shoppingUOMName,globalData);
            }
        }
    })
    try {await db.put(updItem)}
    catch(err) {console.log("ERROR updating item:",err); updateError = true;}
    if (updateError) {
        status = "Error Updating item:" + updItem.name;
    } else {
        status = "Updated item successfully: " + updItem.name;
        if (uomMismatch && (!isEmpty(recipeItem.shoppingUOMName) || !isEmpty(existingUOM))) {
            status=status+"\nWARNING: Unit of measure mismatch on " + updItem.name + "(shopping UoM is "+translatedUOMShortName(recipeItem.shoppingUOMName,globalData) + ",list was "+translatedUOMShortName(String(existingUOM),globalData)+") - please check."
        }
        if (overwroteNote) {
            status=status+"\nWARNING: Note on item overwritten with recipe note"
        }
    }
    return status;

}

export async function createNewItemFromRecipeItem({listOrGroupID,recipeItem,globalData,settings, db} : 
    {listOrGroupID: string | null, recipeItem: RecipeItem, globalData: GlobalDataState, settings: GlobalSettings, db: PouchDB.Database}) : Promise<string> {

    let status="";
    if (!recipeItem.addToList) {return "Item "+recipeItem.name+" not selected to add."};
    let addError = false;
    let rowType: RowType | null = getRowTypeFromListOrGroupID(listOrGroupID as string,globalData.listCombinedRows)
    let existingGlobalItem = globalData.globalItemDocs.find(gi => gi._id === recipeItem.globalItemID)
    let newItem: ItemDoc = cloneDeep(ItemDocInit);
    // TODO: filter updating of lists based on whether adding to listgroup or list
    // should also check on setting?
    newItem.globalItemID = recipeItem.globalItemID;
    newItem.listGroupID = getListGroupIDFromListOrGroupID(listOrGroupID as string, globalData.listCombinedRows);
    newItem.name = recipeItem.name;
    console.log("CNIFRI: lgid:",listOrGroupID,"newLGID:",newItem.listGroupID,"item",recipeItem);
    console.log("listrows:",globalData.listRows);
    console.log("filtered listrows",globalData.listRows.filter(lr => lr.listGroupID === newItem.listGroupID));
    globalData.listRows.filter(lr => lr.listGroupID === newItem.listGroupID).forEach(lr => {
        let newItemList :ItemList = cloneDeep(ItemListInit);
        if (settings.addListOption == AddListOptions.dontAddAutomatically && 
            rowType == RowType.list &&
            lr.listDoc._id !== listOrGroupID) {
                newItemList.active = false
            } else {
                newItemList.active = true;
                newItemList.completed = false;
            }
        newItemList.note = recipeItem.note;
        if (existingGlobalItem !== undefined) {
            newItemList.categoryID = existingGlobalItem.defaultCategoryID
        } else {
            newItemList.categoryID = null;
        }    
        newItemList.listID = lr.listDoc._id as string;
        newItemList.stockedAt = true;
        newItemList.quantity = recipeItem.shoppingQuantity;
        if (recipeItem.shoppingUOMName !== null && recipeItem.shoppingUOMName !== "") {
            newItemList.uomName = recipeItem.shoppingUOMName
        } else if (existingGlobalItem !== undefined){
            newItemList.uomName = existingGlobalItem.defaultUOM
        }
        console.log("pushing itemlist:",newItemList)
        newItem.lists.push(newItemList);
    })
    try {await db.post(newItem)}
    catch(err) {console.log("ERROR adding item:",err); addError = true;}
    if (addError) {
        status = "Error Adding item:" + newItem.name;
    } else {
        status = "Added item successfully: " + newItem.name;
    }
    return status;
}

