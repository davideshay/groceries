import { AddListOptions, GlobalState } from "./GlobalState";
import { ListRow, ItemList, ItemDoc, RowType } from "./DataTypes";
import { cloneDeep } from "lodash";

export function createEmptyItemDoc(listRows:ListRow[], globalState: GlobalState) {
  let newItemLists: any =[];
  let listGroupID = "";
  if (globalState.callingListType == RowType.listGroup) {
    listGroupID = String(globalState.callingListID);
  } else {
    let baseList=listRows.find((listRow:ListRow) => listRow.listDoc._id === globalState.callingListID);
    listGroupID = String(baseList?.listGroupID);  
  }
  listRows.forEach((listRow: ListRow) => {
    if (listRow.listGroupID == listGroupID) {
      let newListDoc: ItemList ={
        listID: listRow.listDoc._id,
        quantity: 1,
        boughtCount: 0,
        note: "",
        uomName: null,
        categoryID: null,
        active: true,
        completed: false,
        stockedAt: true
      };
      if (globalState.settings.addListOption == AddListOptions.addToAllListsAutomatically) {
        newListDoc.active = true;
      } else if (listRow.listDoc._id !== globalState.callingListID && globalState.callingListType != RowType.listGroup) {
        newListDoc.active = false;
        newListDoc.stockedAt = false;
        newListDoc.quantity = 0;
      }
      newItemLists.push(newListDoc);
    }

  });
  let newItemDoc: ItemDoc ={
    type: "item",
    name: String(globalState.newItemName),
    listGroupID: String(listGroupID),
    lists: newItemLists
  }
  return(newItemDoc);
}