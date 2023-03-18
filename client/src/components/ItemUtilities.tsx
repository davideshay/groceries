import {initItemRow, ItemRow, ItemSearch, ListCombinedRow, ListCombinedRows, RowType, ItemDoc, ItemDocs, ItemList, ListDocs, ListDoc} from '../components/DataTypes';
import { cloneDeep } from 'lodash';

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
            if (searchRow.itemName.toUpperCase().includes(searchCriteria.toUpperCase())) {
                filteredSearchRows.push(searchRow);
            }    
        });
        filteredSearchRows.sort((a,b) => (
            (Number(b.itemName.toUpperCase().startsWith(searchCriteria.toUpperCase())) - Number(a.itemName.toUpperCase().startsWith(searchCriteria.toUpperCase()))) 
            || (b.boughtCount - a.boughtCount) ||
            (a.itemName.toUpperCase().localeCompare(b.itemName.toUpperCase()))
            ))        
    }
    return filteredSearchRows;
}

function isListPartOfGroup(listID: string, listGroupID: string, listCombinedRows: ListCombinedRows): boolean {
    let isPart = false;
    let lcr = listCombinedRows.find((el) => (el.rowType==RowType.list && el.listOrGroupID==listID))
    if (lcr == undefined) return isPart;
    isPart = (lcr.listDoc.listGroupID == listGroupID)
    return isPart;
}

function findRightList(itemDoc: ItemDoc, listType: RowType, listOrGroupID: string, listCombinedRow: ListCombinedRow, listCombinedRows: ListCombinedRows) {
    let list: ItemList | undefined;
// for requested row type of list, just match on listID
    if (listType == RowType.list) {
        list = itemDoc.lists.find((list : ItemList) => (list.listID == listOrGroupID));
        if (list == undefined) {return undefined}
        else
        {return list}
    }
// otherwise, for group type of list, just find the first list that is a member of the listgroup    
    for (let i = 0; i < itemDoc.lists.length; i++) {
        let lcr = listCombinedRows.find((el) => el.rowType == RowType.list && el.listGroupID == itemDoc.listGroupID)
        if ( listCombinedRow.listGroupID == itemDoc.listGroupID && isListPartOfGroup(itemDoc.lists[i].listID,listOrGroupID,listCombinedRows) ) {
            list = itemDoc.lists[i];
            break
        }
    }
    if (list == undefined) { return undefined} else {return list}
}


/* function findCategoryID(itemDoc: ItemDoc, listType: RowType, listOrGroupID: string, listCombinedRow: ListCombinedRow ) {
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
} */

export function getItemRows(itemDocs: ItemDocs, listCombinedRows: ListCombinedRow[], categoryDocs: any, uomDocs: any, listType: RowType, listOrGroupID: string) {
    let itemRows: Array<ItemRow> =[];
    let listRow=listCombinedRows.find((el: ListCombinedRow) => (el.rowType === listType && el.listOrGroupID === listOrGroupID));
    if (listRow == undefined) {return itemRows};
    let sortedItemDocs = cloneDeep(itemDocs);
    if (sortedItemDocs.length > 0) {
        sortedItemDocs.sort(function(a: any,b: any) {
            return a.name.toUpperCase().localeCompare(b.name.toUpperCase())
      })
    }  
    sortedItemDocs.forEach((itemDoc: ItemDoc) => {
        let itemRow: ItemRow = cloneDeep(initItemRow);
        itemRow.itemID = String(itemDoc._id);
        itemRow.itemName = itemDoc.name;
        let list = findRightList(itemDoc,listType,listOrGroupID,(listRow as ListCombinedRow), listCombinedRows);
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
                if (Number(itemRow.quantity) === 1) {
                    uomDesc = uomDoc.description;
                } else {
                    uomDesc = uomDoc.pluralDescription;
                }
            }
        }    
        itemRow.uomDesc = uomDesc;
        let quantityUOMDesc = "";
        if (! (itemRow.quantity == 1 && itemRow.uomDesc == "")) {
            quantityUOMDesc = itemRow.quantity.toString() + ((itemRow.uomDesc == "" ? "" : " " + itemRow.uomDesc));
            itemRow.quantityUOMDesc = quantityUOMDesc;
        }
        if (listType == RowType.list) {
            const listIdx = itemDoc.lists.findIndex((element: any) => (element.listID === listOrGroupID))
            if (listIdx === -1) {itemRow.completed=false} else {
                itemRow.completed = itemDoc.lists[listIdx].completed;
            }     
        } else { 
            let allCompleted=true;
            for (let i = 0; i < itemDoc.lists.length; i++) {
                if (!itemDoc.lists[i].completed) {allCompleted=false; break;}
            }
            itemRow.completed = allCompleted;
        }    
        itemRows.push(itemRow);
    })
    itemRows.sort((a,b) => (
    (Number(a.completed) - Number(b.completed)) || (Number(a.categorySeq) - Number(b.categorySeq)) || 
    (a.categoryName.toUpperCase().localeCompare(b.categoryName.toUpperCase())) ||
    (a.itemName.toUpperCase().localeCompare(b.itemName.toUpperCase()))
    ))
    return (itemRows)
}

export function sortedItemLists(itemList: ItemList[], listDocs: ListDocs) {
    let sortedLists = cloneDeep(itemList);
    sortedLists.sort(function (a: ItemList, b: ItemList) {
        let aList: ListDoc | undefined = listDocs.find((listDoc: ListDoc) => (listDoc._id == a.listID));
        let bList: ListDoc | undefined = listDocs.find((listDoc: ListDoc) => (listDoc._id == b.listID));
        if (aList == undefined || bList == undefined) {return 0 }
        else { return aList.name.toUpperCase().localeCompare(bList.name.toUpperCase());
        }
    })
    return sortedLists;
}

export function getCommonKey(stateItemDoc: ItemDoc, key: string, listDocs: ListDocs) {
    let freqObj: any = {};
    let maxKey = null; let maxCnt=0;
    let sortedLists = sortedItemLists(stateItemDoc.lists,listDocs);
    sortedLists.forEach( (list: ItemList) => {
      let value=(list as any)[key]
      if (freqObj.hasOwnProperty(value)) {
        freqObj[value]=freqObj[value]+1;
        if (freqObj[value] > maxCnt) {maxCnt = freqObj[value]; maxKey=value;} 
      } else {
        freqObj[value]=1
      }
    });
    if (maxCnt === 0 && sortedLists.length > 0 ) {maxKey = (sortedLists[0] as any)[key]}
    return maxKey;
  }
