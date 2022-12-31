import { GlobalSettings, AddListOptions } from "./GlobalState";

export function createEmptyItemDoc(listDocs:any,listID: string | null | undefined, itemName: string | undefined, settings: GlobalSettings) {
  console.log(settings.addListOption);
  let newItemLists: any =[];
    listDocs.forEach((listDoc: any) => {
      let newListDoc={
        listID: listDoc._id,
        boughtCount: 0,
        active: true,
        completed: false
      };
      if (settings.addListOption == AddListOptions.addToAllListsAutomatically) {
        newListDoc.active = true;
      } else if (listDoc._id !== listID) {
        newListDoc.active = false
      }
      newItemLists.push(newListDoc);    
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