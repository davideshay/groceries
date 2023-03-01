import {initItemRow, ItemRow, ItemSearch, ListCombinedRow, RowType, ItemDoc, ItemDocs, ItemList} from '../components/DataTypes';
import { cloneDeep } from 'lodash';
import { list } from 'ionicons/icons';

export function getAllSearchRows(allItemDocs: any, listID: string): ItemSearch[] {
    let searchRows: ItemSearch[] = [];
    allItemDocs.forEach((itemDoc: any) => {
      let searchRow: ItemSearch = {
        itemID: itemDoc._id,
        itemName: itemDoc.name,
        quantity: itemDoc.quantity,
        boughtCount: 0
      }
      let list=itemDoc.lists.find((el: any) => el.listID === listID)
      if (list) {searchRow.boughtCount=list.boughtCount}
      if (!list || !list?.active) {
        searchRows.push(searchRow);
      }  
    })
    return searchRows;
  }

export function filterSearchRows(searchRows: ItemSearch[] | undefined, searchCriteria: string) {
    let filteredSearchRows: ItemSearch[] = [];
    if (searchRows !== undefined) {
        searchRows.forEach(searchRow => {
            if (searchRow.itemName.toLowerCase().includes(searchCriteria.toLowerCase())) {
                filteredSearchRows.push(searchRow);
            }    
        });
        filteredSearchRows.sort((a,b) => (
            (Number(b.itemName.toLowerCase().startsWith(searchCriteria.toLowerCase())) - Number(a.itemName.toLowerCase().startsWith(searchCriteria.toLowerCase()))) 
            || (b.boughtCount - a.boughtCount) ||
            (a.itemName.localeCompare(b.itemName))
            ))        
    }
    return filteredSearchRows;
}

function findRightList(itemDoc: ItemDoc, listType: RowType, listOrGroupID: string, listCombinedRow: ListCombinedRow) {
    let list: ItemList | undefined;
    if (listType == RowType.list) {
        list = itemDoc.lists.find((list : ItemList) => (list.listID == listOrGroupID));
        if (list == undefined) {return undefined} else {return list}
    }
    for (let i = 0; i < itemDoc.lists.length; i++) {
        if (listCombinedRow.listGroupLists.includes(itemDoc.lists[i].listID)) {
            list = itemDoc.lists[i];
            break
        }
    }
    if (list == undefined) { return undefined} else {return list}
}


function findCategoryID(itemDoc: ItemDoc, listType: RowType, listOrGroupID: string, listCombinedRow: ListCombinedRow ) {
    let list: ItemList | undefined;
    if (listType == RowType.list) {
        list = itemDoc.lists.find((list : ItemList) => (list.listID == listOrGroupID));
        if (list == undefined) {return null} else {return list.categoryID}
    }
    for (let i = 0; i < itemDoc.lists.length; i++) {
        if (listCombinedRow.listGroupLists.includes(itemDoc.lists[i].listID)) {
            list = itemDoc.lists[i];
            break
        }
    }
    if (list == undefined) { return null} else {return list.categoryID}
}

export function getItemRows(itemDocs: ItemDocs, listCombinedRows: ListCombinedRow[], categoryDocs: any, uomDocs: any, listType: RowType, listOrGroupID: string) {
    let itemRows: Array<ItemRow> =[];
    let listRow=listCombinedRows.find((el: ListCombinedRow) => (el.rowType === listType && el.listOrGroupID === listOrGroupID));
    if (listRow == undefined) {return itemRows};
    let sortedItemDocs = cloneDeep(itemDocs);
    if (sortedItemDocs.length > 0) {
        sortedItemDocs.sort(function(a: any,b: any) {
            var keyA = a.name.toUpperCase();
            var keyB = b.name.toUpperCase();
            if (keyA < keyB) return -1;
            if (keyA > keyB) return 1;
            return 0
      })
    }  
    sortedItemDocs.forEach((itemDoc: ItemDoc) => {
    let itemRow: ItemRow = cloneDeep(initItemRow);
    itemRow.itemID = itemDoc._id;
    itemRow.itemName = itemDoc.name;
    let list = findRightList(itemDoc,listType,listOrGroupID,(listRow as ListCombinedRow));
    if (list == undefined) {return itemRows};
    itemRow.categoryID = list.categoryID;
    if (itemRow.categoryID == null) {
        itemRow.categoryName = "Uncategorized";
        itemRow.categorySeq = -1;
        itemRow.categoryColor = "primary"
    } else {
        let thisCat = (categoryDocs.find((element: any) => (element._id === itemRow.categoryID)) as any);
        if (thisCat != undefined) {
            itemRow.categoryName = thisCat.name;
            if (thisCat.color == undefined) {
                itemRow.categoryColor = "primary"
            } else { itemRow.categoryColor = thisCat.color; };    
        } else {
            itemRow.categoryName = "UNDEFINED";
            itemRow.categoryColor = "primary"
        }
        if (listType ==  RowType.list) {
            const tmpIdx = (listRow?.listDoc.categories.findIndex((element: any) => (element === itemRow.categoryID)));
            if (tmpIdx === -1) {itemRow.categorySeq=Number.MAX_VALUE} else {itemRow.categorySeq=tmpIdx}
        } else {
            itemRow.categorySeq=0;
        }    
    }
    itemRow.quantity =  list.hasOwnProperty("quantity") ? list.quantity : 0;
    const uomName = list.hasOwnProperty("uomName") ? list.uomName : null;
    let uomDesc = "";
    if (uomName != null) {
        const uomDoc = uomDocs.find((el: any) => (el.name === uomName));
        if (uomDoc != undefined) {
            if (itemRow.quantity === 1) {
                uomDesc = uomDoc.description;
            } else {
                uomDesc = uomDoc.pluralDescription;
            }
        }
    }    
    itemRow.uomDesc = uomDesc;
    let quantityUOMDesc = "";
    if (itemRow.quantity !== 1 && itemRow.uomDesc !== "") {
        quantityUOMDesc = itemRow.quantity.toString() + ((itemRow.uomDesc == "" ? "" : " " + itemRow.uomDesc));
        itemRow.quantityUOMDesc = quantityUOMDesc;
    }
    if (listType == RowType.list) {
        const listIdx = itemDoc.lists.findIndex((element: any) => (element.listID === listOrGroupID))
        if (listIdx === -1) {itemRow.completed=false} else {
            itemRow.completed = itemDoc.lists[listIdx].completed;
        }     
    } else { itemRow.completed = false }    
    itemRows.push(itemRow);
    })
    itemRows.sort((a,b) => (
    (Number(a.completed) - Number(b.completed)) || (a.categorySeq - b.categorySeq) || (a.categoryName.localeCompare(b.categoryName)) ||
    (a.itemName.localeCompare(b.itemName))
    ))
    return (itemRows)
}
