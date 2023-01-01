import { GlobalSettings, AddListOptions } from "./GlobalState";
import { ListRow } from "./DataTypes";
import { isEqual } from "lodash";

export function createEmptyItemDoc(listRows:ListRow[],listID: string | null | undefined, itemName: string | undefined, settings: GlobalSettings) {
  console.log(settings.addListOption);
  let newItemLists: any =[];
  console.log({listRows,listID});
  let baseList=listRows.find((listRow:ListRow) => listRow.listDoc._id === listID);
  let baseParticipants=baseList?.participants;
  console.log("base participants:",baseParticipants);
    listRows.forEach((listRow: ListRow) => {
      let newListDoc={
        listID: listRow.listDoc._id,
        boughtCount: 0,
        active: true,
        completed: false
      };
      if (settings.addListOption == AddListOptions.addToAllListsAutomatically) {
        newListDoc.active = true;
      } else if (listRow.listDoc._id !== listID) {
        newListDoc.active = false
      }
      console.log("list row participants:",listRow.participants)
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
      categoryID: null,
      note:"",
      lists: newItemLists
    }
    return(newItemDoc);
}