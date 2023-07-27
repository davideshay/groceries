import {initItemRow, ItemRow, ItemSearch, ListCombinedRow, ListCombinedRows,
     ListRow, RowType, ItemSearchType, CategoryRows, CategoryRow, ItemRows, initCategoryRow} from '../components/DataTypes';
import { GlobalState } from "./GlobalState";
import { AddListOptions, CategoryColors, DefaultColor, GlobalSettings } from './DBSchema';
import { UomDoc, ItemDoc, ItemDocs, ItemList, ListDocs, ListDoc, CategoryDoc, GlobalItemDocs } from './DBSchema';
import { cloneDeep } from 'lodash';
import { t } from 'i18next';
import { translatedCategoryName, translatedItemName, translatedUOMShortName } from './translationUtilities';
import { isEmpty } from 'lodash';
import { getListGroupIDFromListOrGroupID } from './Utilities';

export function getGroupIDForList(listID: string, listDocs: ListDocs): string | null {
    let retGID = null;
    for (let i = 0; i < listDocs.length; i++) {
      if (listDocs[i]._id === listID) { retGID=String(listDocs[i].listGroupID); break}
    }
    return retGID;
}

export function getAllSearchRows(allItemDocs: ItemDocs, listID: string | null,listType: RowType ,listDocs: ListDocs, globalItemDocs: GlobalItemDocs, settings: GlobalSettings): ItemSearch[] {
    let searchRows: ItemSearch[] = [];
    allItemDocs.forEach((itemDoc) => {
      let searchRow: ItemSearch = {
        itemID: String(itemDoc._id),
        itemName: translatedItemName(itemDoc.globalItemID,itemDoc.name,itemDoc.pluralName),
        itemType: ItemSearchType.Local,
        globalItemID: itemDoc.globalItemID,
        globalItemCategoryID: null,
        globalItemUOM: null,
        quantity: getMaxKey(itemDoc,"quantity",listDocs),
        boughtCount: getMaxKey(itemDoc,"quantity",listDocs)
      }
      let addRowToSearch=true;
      if (listType === RowType.list) {
        let list = itemDoc.lists.find((el) => el.listID === listID);
        if (list !== undefined) {
            searchRow.boughtCount = list.boughtCount;
            if (list.active && !list.completed) {addRowToSearch=false}
        }
      } else { // RowType is ListGroup
        if (itemDoc.listGroupID !== listID) {
            addRowToSearch=false
        } else {
            if (itemDoc.lists.filter((il) => il.active).length > 0) {
                addRowToSearch=false
            }
        }
      }
      if (addRowToSearch) {
        searchRows.push(searchRow);
      }  
    })
    if (!settings.includeGlobalInSearch) {return searchRows};
    globalItemDocs.forEach((globalItem) => {
      let itemExistsInSearchIdx = searchRows.findIndex((sr) => (sr.globalItemID === globalItem._id || sr.itemName === globalItem.name));
      let itemExistsInItem = false;
      if (listType === RowType.list) {
        let itemNameMatch = allItemDocs.find((item) => (item.name.toUpperCase() === globalItem.name.toUpperCase() || item.globalItemID === globalItem._id));
        if (itemNameMatch !== undefined) {
            itemNameMatch.lists.forEach((list) => {
                if (list.active && list.listID===listID) {
                    itemExistsInItem=true;
                }
            })
        }
      } else {
        let itemNameMatch = allItemDocs.find((item) => (item.name.toUpperCase() === globalItem.name.toUpperCase() && item.listGroupID === listID))
        if (itemNameMatch !== undefined) {
            itemExistsInItem = true;
        }
      }
      if (itemExistsInSearchIdx === -1 && !itemExistsInItem) {
        let searchRow: ItemSearch = {
            itemID: String(globalItem._id),
            itemName: translatedItemName(globalItem._id!,globalItem.name, globalItem.name),
            itemType: ItemSearchType.Global,
            globalItemID: String(globalItem._id),
            globalItemCategoryID: globalItem.defaultCategoryID,
            globalItemUOM: globalItem.defaultUOM,
            quantity: 0,
            boughtCount: 0        }
        searchRows.push(searchRow);
      }   
    })
    return searchRows;
  }

export function filterSearchRows(searchRows: ItemSearch[] | undefined, searchCriteria: string) {
    let filteredSearchRows: ItemSearch[] = [];
    if (searchRows !== undefined) {
        searchRows.forEach(searchRow => {
            if (searchRow.itemName.toLocaleUpperCase().includes(searchCriteria.toLocaleUpperCase())) {
                filteredSearchRows.push(searchRow);
            }    
        });
        filteredSearchRows.sort((a,b) => (
            (Number(b.itemName.toLocaleUpperCase().startsWith(searchCriteria.toLocaleUpperCase())) - Number(a.itemName.toLocaleUpperCase().startsWith(searchCriteria.toLocaleUpperCase()))) 
            || (b.boughtCount - a.boughtCount) ||
            (a.itemName.toLocaleUpperCase().localeCompare(b.itemName.toLocaleUpperCase()))
            ))        
    }
    return filteredSearchRows;
}

function isListPartOfGroup(listID: string, listGroupID: string | null, listCombinedRows: ListCombinedRows): boolean {
    let isPart = false;
    let lcr = listCombinedRows.find((el) => (el.rowType===RowType.list && el.listOrGroupID===listID))
    if (lcr === undefined) return isPart;
    isPart = (lcr.listDoc.listGroupID === listGroupID)
    return isPart;
}

function findRightList(itemDoc: ItemDoc, listType: RowType, listOrGroupID: string | null, listCombinedRow: ListCombinedRow, listCombinedRows: ListCombinedRows) : ItemList | undefined {
    let list: ItemList | undefined;
// for requested row type of list, just match on listID
    if (listType === RowType.list) {
        list = itemDoc.lists.find((list : ItemList) => (list.listID === listOrGroupID));
        if (list === undefined) {return undefined}
        else
        {return cloneDeep(list)}
    }
// otherwise, for group type of list, just find the first list that is a member of the listgroup    
    for (let i = 0; i < itemDoc.lists.length; i++) {
        if ( listCombinedRow.listGroupID === itemDoc.listGroupID && isListPartOfGroup(itemDoc.lists[i].listID,listOrGroupID,listCombinedRows) ) {
            list = itemDoc.lists[i];
            break
        }
    }
    if (list === undefined) { return undefined} else {return cloneDeep(list)}
}

export function getItemRows(itemDocs: ItemDocs, listCombinedRows: ListCombinedRow[], categoryDocs: CategoryDoc[], uomDocs: UomDoc[], listType: RowType, listOrGroupID: string | null, curCategoryRows: CategoryRows, categoryColors: CategoryColors) : [ItemRows, CategoryRows] {
    let itemRows: Array<ItemRow> =[];
    let categoryRows: Array<CategoryRow> = [];
    let listGroupID = getListGroupIDFromListOrGroupID(String(listOrGroupID), listCombinedRows);
    let listRow=listCombinedRows.find((el: ListCombinedRow) => (el.rowType === listType && el.listOrGroupID === listOrGroupID));
    if (listRow === undefined) {return [itemRows,categoryRows]};
    let sortedItemDocs: ItemDocs = cloneDeep(itemDocs);
    if (sortedItemDocs.length > 0) {
        sortedItemDocs.sort(function(a,b) {
            return a.name.toUpperCase().localeCompare(b.name.toUpperCase())
      })
    }  
    sortedItemDocs.forEach((itemDoc: ItemDoc) => {
        let itemRow: ItemRow = cloneDeep(initItemRow);
        itemRow.itemID = String(itemDoc._id);
        itemRow.globalItemID = itemDoc.globalItemID;
        let list = findRightList(itemDoc,listType,listOrGroupID,(listRow as ListCombinedRow), listCombinedRows);
        if (list === undefined) {return itemRows};
        itemRow.itemName =  translatedItemName(itemDoc.globalItemID,itemDoc.name,itemDoc.pluralName,list.hasOwnProperty("quantity") ? list.quantity : 0);
        itemRow.categoryID = list.categoryID;
        if (itemRow.categoryID === null) {
            itemRow.categoryName = t("general.uncategorized");
            itemRow.categorySeq = -1;
            itemRow.categoryColor = DefaultColor
        } else {
            let thisCat = (categoryDocs.find((element: CategoryDoc) => (element._id === itemRow.categoryID)) as CategoryDoc);
            if (thisCat !== undefined) {
                itemRow.categoryName =  translatedCategoryName(itemRow.categoryID,thisCat.name);
                if (categoryColors.hasOwnProperty(String(thisCat._id))) {
                  itemRow.categoryColor = categoryColors[String(thisCat._id)];
                } else {
                  itemRow.categoryColor = DefaultColor;
                }
            } else {
                itemRow.categoryName = t("general.undefined");
                itemRow.categoryColor = DefaultColor
            }
            if (listType === RowType.list) {
                const tmpIdx = (listRow?.listDoc.categories.findIndex((element: string) => (element === itemRow.categoryID)));
                if (tmpIdx === -1) {itemRow.categorySeq=Number.MAX_VALUE} else {itemRow.categorySeq=tmpIdx}
            } else {
                itemRow.categorySeq=0;
            }    
        }
        itemRow.quantity =  list.hasOwnProperty("quantity") ? list.quantity : 0;
        if (!isEmpty(list.note)) {itemRow.hasNote = true;}
        const uomName = list.hasOwnProperty("uomName") ? list.uomName : null;
        let uomDesc=translatedUOMShortName(uomName,uomDocs,String(listGroupID),itemRow.quantity)
        itemRow.uomDesc = uomDesc;

        let quantityUOMDesc = "";
        if ((itemRow.quantity !== 0) && ((itemRow.quantity > 1) || itemRow.uomDesc !== "")) {
            quantityUOMDesc = itemRow.quantity.toString() + ((itemRow.uomDesc === "" ? "" : " " + itemRow.uomDesc));
            itemRow.quantityUOMDesc = quantityUOMDesc;
        }
        if (listType === RowType.list) {
            const listIdx = itemDoc.lists.findIndex((element: ItemList) => (element.listID === listOrGroupID))
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
    (a.categoryName.toLocaleUpperCase().localeCompare(b.categoryName.toLocaleUpperCase())) ||
    (a.itemName.toLocaleUpperCase().localeCompare(b.itemName.toLocaleUpperCase()))
    ))
    itemRows.forEach((item) => {
      let foundCat = categoryRows.find((catRow) => (item.categoryID === catRow.id && item.completed === catRow.completed))
      let foundCurCat = curCategoryRows.find((catRow) => (item.categoryID === catRow.id && item.completed === catRow.completed))
      if (foundCat === undefined) {
        let newCatRow: CategoryRow = cloneDeep(initCategoryRow);
        newCatRow.id = item.categoryID;
        newCatRow.name = item.categoryName;
        newCatRow.seq = item.categorySeq;
        newCatRow.completed = Boolean(item.completed);
        newCatRow.color = item.categoryColor;
        if (foundCurCat === undefined) {
          newCatRow.collapsed = false;
        } else {
          newCatRow.collapsed = foundCurCat.collapsed;
        }
        categoryRows.push(newCatRow);
      }
    })
    return ([itemRows,categoryRows])
}

export function sortedItemLists(itemList: ItemList[], listDocs: ListDocs) : ItemList[] {
    let sortedLists = cloneDeep(itemList);
    sortedLists.sort(function (a: ItemList, b: ItemList) {
        let aList: ListDoc | undefined = listDocs.find((listDoc: ListDoc) => (listDoc._id === a.listID));
        let bList: ListDoc | undefined = listDocs.find((listDoc: ListDoc) => (listDoc._id === b.listID));
        if (aList === undefined || bList === undefined) {return 0 }
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

  export function getMaxKey(stateItemDoc: ItemDoc, key: string, listDocs: ListDocs) {
    let maxKey=0;
    let sortedLists = sortedItemLists(stateItemDoc.lists,listDocs);
    sortedLists.forEach( (list: ItemList) => {
      let value=(list as any)[key];
      if (value > maxKey) {maxKey = value};
    });
    return maxKey;
  }

  export function createEmptyItemDoc(listRows:ListRow[], globalState: GlobalState, globalItems: GlobalItemDocs) {
    let newItemLists: ItemList[] =[];
    let listGroupID = "";
    if (globalState.callingListType === RowType.listGroup) {
      listGroupID = String(globalState.callingListID);
    } else {
      let baseList=listRows.find((listRow:ListRow) => listRow.listDoc._id === globalState.callingListID);
      listGroupID = String(baseList?.listGroupID);  
    }
    let foundGlobalItem = globalItems.find(gi => (gi._id === globalState.newItemGlobalItemID));
    listRows.forEach((listRow: ListRow) => {
      if (listRow.listGroupID === listGroupID) {
        let newListDoc: ItemList ={
          listID: String(listRow.listDoc._id),
          quantity: 1,
          boughtCount: 0,
          note: "",
          uomName: (foundGlobalItem === undefined) ? null : foundGlobalItem.defaultUOM,
          categoryID: (foundGlobalItem === undefined) ? null : foundGlobalItem.defaultCategoryID,
          active: true,
          completed: false,
          stockedAt: true
        };
        if (globalState.settings.addListOption === AddListOptions.addToAllListsAutomatically) {
          newListDoc.active = true;
        } else if (globalState.settings.addListOption === AddListOptions.addToListsWithCategoryAutomatically) {
          if (isEmpty(globalState.newItemGlobalItemID)) {
            newListDoc.active = true
          } else {
            newListDoc.active = listRow.listDoc.categories.includes(String(newListDoc.categoryID))
            if (!newListDoc.active) {newListDoc.categoryID = null;}
          }
        } else if (listRow.listDoc._id !== globalState.callingListID && globalState.callingListType !== RowType.listGroup) {
          newListDoc.active = false;;
          newListDoc.quantity = 0;
        }
        newItemLists.push(newListDoc);
      }
  
    });
    let newItemDoc: ItemDoc ={
      type: "item",
      name: (foundGlobalItem === undefined) ? String(globalState.newItemName) : foundGlobalItem.name,
      pluralName: String(globalState.newItemName),
      globalItemID: globalState.newItemGlobalItemID,
      listGroupID: String(listGroupID),
      imageID: null,
      lists: newItemLists
    }
    return(newItemDoc);
  }

export function listIsDifferentThanCommon(sortedLists: ItemList[], listIdx: number): boolean {
    let combinedKeys: any ={};
//    let maxKey="";
    let maxCnt=1;
    let thisKey="";
    for (let i = 0; i < sortedLists.length; i++) {
        const thisList=sortedLists[i];
        let listKey="";
        for (const [key, value] of Object.entries(thisList).sort((a,b) => a[0].toUpperCase().localeCompare(b[0].toUpperCase()))) {
        if (!["listID","boughtCount"].includes(key)) {
            listKey=listKey+key+value;
        }
        }
        if (combinedKeys.hasOwnProperty(listKey)) {
        combinedKeys[listKey] = combinedKeys[listKey] + 1;
        if (combinedKeys[listKey] > maxCnt) {
            maxCnt=combinedKeys[listKey];
//            maxKey=listKey;
        }
        } else {
        combinedKeys[listKey] = 1;
        }
        if (i === listIdx) {
        thisKey=listKey;
        }
    }
    // check if max count occurs > 1 in the list, if so all rows should be different
    let maxCheckCount=0;
    for (const [, value] of Object.entries(combinedKeys)) {
        if (value === maxCnt) { maxCheckCount++;}
    }
    return ((combinedKeys[thisKey] < maxCnt) || (maxCheckCount > 1)) ;
}

export function checkNameInGlobalItems(globalItemDocs: GlobalItemDocs, name: string, pluralName: string): [boolean, string|null] {
  let nameExists=false;
  let globalID: string|null = null;
  const sysItemKey="system:item";
  const compName = name.toLocaleUpperCase();
  const compPluralName = pluralName.toLocaleUpperCase();
  globalItemDocs.every(item => {
    const tkey = "globalitem." + item._id?.substring(sysItemKey.length+1)
    if (item.name.toLocaleUpperCase() === compName ||
        item.name.toLocaleUpperCase() === compPluralName ||
        t(tkey, {count: 1}).toLocaleUpperCase() === compName ||
        t(tkey, {count: 1}).toLocaleUpperCase() === compPluralName ||
        t(tkey, {count: 1}).toLocaleUpperCase() === compName ||
        t(tkey, {count: 2}).toLocaleUpperCase() === compPluralName  
        ) {
          nameExists = true;
          globalID = item._id!;
        }
        return !nameExists;
  });
  return [nameExists,globalID];
}
