import {ItemRow, ItemSearch} from '../components/DataTypes';

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

export function getItemRows(itemDocs: any, listDocs: any, categoryDocs: any, listID: string) {
    let itemRows: Array<ItemRow> =[];
    let listDoc=listDocs.find((el: any) => el._id === listID);
    if (listDoc == undefined) {return itemRows};
    itemDocs.forEach((itemDoc: any) => {
    let itemRow: ItemRow = {
        itemID:"",
        itemName:"",
        categoryID: "",
        categoryName: "",
        categorySeq: 0,
        categoryColor: "",
        quantity: 0,
        completed: false
    };
    itemRow.itemID = itemDoc._id;
    itemRow.itemName = itemDoc.name;
    itemRow.categoryID = itemDoc.categoryID;
    if (itemRow.categoryID == null) {
        itemRow.categoryName = "Uncategorized";
        itemRow.categorySeq = -1;
        itemRow.categoryColor = "primary"
    } else {
        let thisCat = (categoryDocs.find((element: any) => (element._id === itemDoc.categoryID)) as any);
        if (thisCat != undefined) {
            itemRow.categoryName = thisCat.name;
            if (thisCat.color == undefined) {
                itemRow.categoryColor = "primary"
            } else { itemRow.categoryColor = thisCat.color; };    
        } else {
            itemRow.categoryName = "UNDEFINED";
            itemRow.categoryColor = "primary"
        }
        const tmpIdx = ((listDoc as any).categories.findIndex((element: any) => (element === itemDoc.categoryID)));
        if (tmpIdx === -1) {itemRow.categorySeq=Number.MAX_VALUE} else {itemRow.categorySeq=tmpIdx}
    }
    itemRow.quantity = itemDoc.quantity;
    const listIdx = itemDoc.lists.findIndex((element: any) => (element.listID === listID))
    if (listIdx === -1) {itemRow.completed=false} else {
        itemRow.completed = itemDoc.lists[listIdx].completed;
    }  
    itemRows.push(itemRow);
    })
    itemRows.sort((a,b) => (
    (Number(a.completed) - Number(b.completed)) || (a.categorySeq - b.categorySeq) || (a.categoryName.localeCompare(b.categoryName)) ||
    (a.itemName.localeCompare(b.itemName))
    ))
    return (itemRows)
}
