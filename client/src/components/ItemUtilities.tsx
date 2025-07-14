import { useEffect, useState } from 'react';
import {initItemRow, ItemRow, ItemSearch, ListCombinedRow, ListCombinedRows,
     ListRow, RowType, ItemSearchType, CategoryRows, CategoryRow, ItemRows, initCategoryRow, ListSelectRow, ListSelectRows} from '../components/DataTypes';
import { GlobalState } from "./GlobalState";
import { AddListOptions, CategoryColors, DefaultColor, GlobalSettings } from './DBSchema';
import { UomDoc, ItemDoc, ItemDocs, ItemList, ListDocs, ListDoc, CategoryDoc, GlobalItemDocs } from './DBSchema';
import { cloneDeep, isEmpty } from 'lodash-es';
import { t } from 'i18next';
import { translatedCategoryName, translatedItemName, translatedItemNameWithUOM, translatedUOMShortName } from './translationUtilities';
import { getListGroupIDFromListOrGroupID } from './Utilities';
import { useGlobalDataStore } from './GlobalData';

export function getGroupIDForList(listID: string, listDocs: ListDocs): string | null {
    let retGID = null;
    for (let i = 0; i < listDocs.length; i++) {
      if (listDocs[i]._id === listID) { retGID=String(listDocs[i].listGroupID); break}
    }
    return retGID;
}

export function getAllSearchRows(allItemDocs: ItemDocs, listID: string | null,listType: RowType ,listDocs: ListDocs, globalItemDocs: GlobalItemDocs, settings: GlobalSettings): ItemSearch[] {
    const searchRows: ItemSearch[] = [];
    allItemDocs.forEach((itemDoc) => {
      const searchRow: ItemSearch = {
        itemID: String(itemDoc._id),
        itemName: translatedItemName(itemDoc.globalItemID,itemDoc.name,itemDoc.pluralName,2),
        itemType: ItemSearchType.Local,
        globalItemID: itemDoc.globalItemID,
        globalItemCategoryID: null,
        globalItemUOM: null,
        quantity: getMaxKey(itemDoc,"quantity",listDocs),
        boughtCount: getMaxKey(itemDoc,"boughtcount",listDocs)
      }
      let addRowToSearch=true;
      if (listType === RowType.list) {
        const list = itemDoc.lists.find((el) => el.listID === listID);
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
      const itemExistsInSearchIdx = searchRows.findIndex((sr) => (sr.globalItemID === globalItem._id || sr.itemName === globalItem.name));
      let itemExistsInItem = false;
      if (listType === RowType.list) {
        const itemNameMatch = allItemDocs.find((item) => (item.name.toUpperCase() === globalItem.name.toUpperCase() || item.globalItemID === globalItem._id));
        if (itemNameMatch !== undefined) {
            itemNameMatch.lists.forEach((list) => {
                if (list.active && list.listID===listID) {
                    itemExistsInItem=true;
                }
            })
        }
      } else {
        const itemNameMatch = allItemDocs.find((item) => (item.name.toUpperCase() === globalItem.name.toUpperCase() && item.listGroupID === listID))
        if (itemNameMatch !== undefined) {
            itemExistsInItem = true;
        }
      }
      if (itemExistsInSearchIdx === -1 && !itemExistsInItem) {
        const searchRow: ItemSearch = {
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
    const filteredSearchRows: ItemSearch[] = [];
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
    const lcr = listCombinedRows.find((el) => (el.rowType===RowType.list && el.listOrGroupID===listID))
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
    const itemRows: Array<ItemRow> =[];
    const categoryRows: Array<CategoryRow> = [];
    const listGroupID = getListGroupIDFromListOrGroupID(String(listOrGroupID), listCombinedRows);
    const listRow=listCombinedRows.find((el: ListCombinedRow) => (el.rowType === listType && el.listOrGroupID === listOrGroupID));
    if (listRow === undefined) {return [itemRows,categoryRows]};
    const sortedItemDocs: ItemDocs = cloneDeep(itemDocs);
    if (sortedItemDocs.length > 0) {
        sortedItemDocs.sort(function(a,b) {
            return a.name.toUpperCase().localeCompare(b.name.toUpperCase())
      })
    }  
    sortedItemDocs.forEach((itemDoc: ItemDoc) => {
        const itemRow: ItemRow = cloneDeep(initItemRow);
        itemRow.itemID = String(itemDoc._id);
        itemRow.globalItemID = itemDoc.globalItemID;
        const list = findRightList(itemDoc,listType,listOrGroupID,(listRow as ListCombinedRow), listCombinedRows);
        if (list === undefined) {return itemRows};
        itemRow.itemName =  translatedItemNameWithUOM(itemDoc.globalItemID,itemDoc.name,itemDoc.pluralName,Object.prototype.hasOwnProperty.call(list, "quantity") ? list.quantity : 0,list.uomName);
        itemRow.categoryID = list.categoryID;
        if (itemRow.categoryID === null) {
            itemRow.categoryName = t("general.uncategorized");
            itemRow.categorySeq = -1;
            itemRow.categoryColor = DefaultColor
        } else {
            const thisCat = (categoryDocs.find((element: CategoryDoc) => (element._id === itemRow.categoryID)) as CategoryDoc);
            if (thisCat !== undefined) {
                itemRow.categoryName =  translatedCategoryName(itemRow.categoryID,thisCat.name);
                if (Object.prototype.hasOwnProperty.call(categoryColors, String(thisCat._id))) {
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
        itemRow.quantity =  Object.prototype.hasOwnProperty.call(list, "quantity") ? list.quantity : 0;
        if (!isEmpty(list.note)) {itemRow.hasNote = true;}
        const uomName = Object.prototype.hasOwnProperty.call(list, "uomName") ? list.uomName : null;
        const uomDesc=translatedUOMShortName(uomName,uomDocs,String(listGroupID),itemRow.quantity)
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
      const foundCat = categoryRows.find((catRow) => (item.categoryID === catRow.id && item.completed === catRow.completed))
      const foundCurCat = curCategoryRows.find((catRow) => (item.categoryID === catRow.id && item.completed === catRow.completed))
      if (foundCat === undefined) {
        const newCatRow: CategoryRow = cloneDeep(initCategoryRow);
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
    const sortedLists = cloneDeep(itemList);
    sortedLists.sort(function (a: ItemList, b: ItemList) {
        const aList: ListDoc | undefined = listDocs.find((listDoc: ListDoc) => (listDoc._id === a.listID));
        const bList: ListDoc | undefined = listDocs.find((listDoc: ListDoc) => (listDoc._id === b.listID));
        if (aList === undefined || bList === undefined) {return 0 }
        else { return aList.name.toUpperCase().localeCompare(bList.name.toUpperCase());
        }
    })
    return sortedLists;
}

export function getCommonKey(stateItemDoc: ItemDoc, key: string, listDocs: ListDocs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const freqObj: any = {};
    let maxKey = null; let maxCnt=0;
    const sortedLists = sortedItemLists(stateItemDoc.lists,listDocs);
    sortedLists.forEach( (list: ItemList) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value=(list as any)[key]
      if (Object.prototype.hasOwnProperty.call(freqObj, value)) {
        freqObj[value]=freqObj[value]+1;
        if (freqObj[value] > maxCnt) {maxCnt = freqObj[value]; maxKey=value;} 
      } else {
        freqObj[value]=1
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (maxCnt === 0 && sortedLists.length > 0 ) {maxKey = (sortedLists[0] as any)[key]}
    return maxKey;
  }

  export function getMaxKey(stateItemDoc: ItemDoc, key: string, listDocs: ListDocs) {
    let maxKey=0;
    const sortedLists = sortedItemLists(stateItemDoc.lists,listDocs);
    sortedLists.forEach( (list: ItemList) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value=(list as any)[key];
      if (value > maxKey) {maxKey = value};
    });
    return maxKey;
  }

  export function createEmptyItemDoc(listRows:ListRow[], globalState: GlobalState, globalItems: GlobalItemDocs) {
    const newItemLists: ItemList[] =[];
    let listGroupID = "";
    if (globalState.callingListType === RowType.listGroup) {
      listGroupID = String(globalState.callingListID);
    } else {
      const baseList=listRows.find((listRow:ListRow) => listRow.listDoc._id === globalState.callingListID);
      listGroupID = String(baseList?.listGroupID);  
    }
    const foundGlobalItem = globalItems.find(gi => (gi._id === globalState.newItemGlobalItemID));
    listRows.forEach((listRow: ListRow) => {
      if (listRow.listGroupID === listGroupID) {
        const newListDoc: ItemList ={
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
    const newItemDoc: ItemDoc ={
      type: "item",
      name: (foundGlobalItem === undefined) ? String(globalState.newItemName) : translatedItemName(String(foundGlobalItem._id),foundGlobalItem.name,foundGlobalItem.name,1),
      pluralName: (foundGlobalItem === undefined) ? String(globalState.newItemName) : translatedItemName(String(foundGlobalItem._id),foundGlobalItem.name,foundGlobalItem.name,2),
      globalItemID: globalState.newItemGlobalItemID,
      listGroupID: String(listGroupID),
      imageID: null,
      lists: newItemLists
    }
    return(newItemDoc);
  }

export function listIsDifferentThanCommon(sortedLists: ItemList[], listIdx: number): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combinedKeys: any ={};
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
        if (Object.prototype.hasOwnProperty.call(combinedKeys, listKey)) {
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

function getListHasUnchecked(listID: string | null,itemDocs: ItemDocs): boolean {
  return itemDocs.some( (itemDoc)=> {
    return (itemDoc.lists.some( (itemList) => {
      if (itemList.listID !== listID) {return false};
      return (itemList.active && !itemList.completed);
    }))
  })
}

function getListGroupHasUnchecked(listGroupID: string | null, currentListSelectRows: ListSelectRows) {
  return currentListSelectRows.some( (listSelectRow) => {
    return (listSelectRow.rowType === RowType.list && 
            listSelectRow.listGroupID === listGroupID &&
            listSelectRow.hasUncheckedItems )
  })
}

function getListSelectRows(listCombinedRows: ListCombinedRows, itemDocs: ItemDocs): ListSelectRows {
  const listSelectRows: ListSelectRows = [];
  for (const listCombinedRow of listCombinedRows) {
    const newListSelectRow: ListSelectRow = Object.assign({hasUncheckedItems: false},listCombinedRow);
    if (listCombinedRow.rowType === RowType.list && !listCombinedRow.hidden) {
      newListSelectRow.hasUncheckedItems = getListHasUnchecked(listCombinedRow.listOrGroupID,itemDocs)
    }
    listSelectRows.push(newListSelectRow);
  }
  for (const listSelectRow of listSelectRows) {
    if (listSelectRow.rowType === RowType.listGroup) {
      listSelectRow.hasUncheckedItems = getListGroupHasUnchecked(listSelectRow.listGroupID,listSelectRows);
    }  
  }
  return listSelectRows;
}

export function useListSelectRows() {
  const listCombinedRows = useGlobalDataStore((state) => state.listCombinedRows);
  const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
  const itemDocs = useGlobalDataStore((state) => state.itemDocs);
  const loading = useGlobalDataStore((state) => state.isLoading);

  const [ listSelectRows, setListSelectRows ] = useState<ListSelectRows>([]);

  useEffect( () => {
    if (listRowsLoaded && !loading) {
      setListSelectRows(getListSelectRows(listCombinedRows,itemDocs));
    }
  },[listRowsLoaded,loading,listCombinedRows,itemDocs])

  return listSelectRows;
}
