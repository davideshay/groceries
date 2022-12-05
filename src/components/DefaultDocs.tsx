
export function createEmptyItemDoc(listDocs:any,listID: string, itemName: string | null) {
    let newItemLists: any =[];
    listDocs.forEach((listDoc: any) => {
      let newListDoc={
        listID: listDoc.listID,
        boughtCount: 0,
        active: true,
        completed: false
      };
      if (listDoc.listID !== listID) {
        newListDoc.active = false;
        newListDoc.completed = false;
      } 
      newItemLists.push(newListDoc);    
    });
    let newItemDoc={
      type: "item",
      name: itemName,
      quantity: 0,
      categoryID: null,
      lists: newItemLists
    }
    return(newItemDoc);
}