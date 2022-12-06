import {ItemRow, ItemSearch, SearchState, PageState} from '../components/DataTypes';
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
      searchRows.push(searchRow);
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

export function getItemRows(itemDocs: any, listDocs: any, categoryDocs: any, listID: string) {
    let itemRows: Array<ItemRow> =[];
    let listDoc=listDocs.find((el: any) => el._id === listID);
    itemDocs.forEach((itemDoc: any) => {
    let itemRow: ItemRow = {
        itemID:"",
        itemName:"",
        categoryID: "",
        categoryName: "",
        categorySeq: 0,
        quantity: 0,
        completed: false
    };
    itemRow.itemID = itemDoc._id;
    itemRow.itemName = itemDoc.name;
    itemRow.categoryID = itemDoc.categoryID;
    if (itemRow.categoryID == null) {
        itemRow.categoryName = "Uncategorized";
        itemRow.categorySeq = -1;
    } else {
        itemRow.categoryName = (categoryDocs.find((element: any) => (element._id === itemDoc.categoryID)) as any).name;
        itemRow.categorySeq = ((listDoc as any).categories.findIndex((element: any) => (element === itemDoc.categoryID)));  
    }
    itemRow.quantity = itemDoc.quantity;
    const listIdx = itemDoc.lists.findIndex((element: any) => (element.listID === listID))
    if (listIdx === -1) {itemRow.completed=false} else {
        itemRow.completed = itemDoc.lists[listIdx].completed;
    }  
    itemRows.push(itemRow);
    })
    itemRows.sort((a,b) => (
    (Number(a.completed) - Number(b.completed)) || (a.categorySeq - b.categorySeq) ||
    (a.itemName.localeCompare(b.itemName))
    ))
    return (itemRows)
    }
