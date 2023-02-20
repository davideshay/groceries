import { GlobalSettings, AddListOptions } from "./GlobalState";
import { ListRow } from "./DataTypes";
import { isEqual } from "lodash";

export function createEmptyItemDoc(listRows:ListRow[],listID: string | null | undefined, itemName: string | undefined, settings: GlobalSettings) {
  let newItemLists: any =[];
  let baseList=listRows.find((listRow:ListRow) => listRow.listDoc._id === listID);
  let baseParticipants=baseList?.participants;
    listRows.forEach((listRow: ListRow) => {
      let newListDoc={
        listID: listRow.listDoc._id,
        boughtCount: 0,
        active: true,
        completed: false,
        stockedAt: true
      };
      if (settings.addListOption == AddListOptions.addToAllListsAutomatically) {
        newListDoc.active = true;
      } else if (listRow.listDoc._id !== listID) {
        newListDoc.active = false
      }
      if (isEqual(baseParticipants,listRow.participants)) {
        newItemLists.push(newListDoc);    
      } else {
        newListDoc.active = false;
        newItemLists.push(newListDoc);
      } 
    });
    let newItemDoc={
      type: "item",
      name: itemName,
      quantity: 1,
      uomName: null,
      categoryID: null,
      note:"",
      lists: newItemLists
    }
    return(newItemDoc);
}