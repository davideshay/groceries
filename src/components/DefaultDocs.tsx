
export function createEmptyItemDoc(listDocs:any,listID: string | null | undefined, itemName: string | undefined) {
    let newItemLists: any =[];
    console.log("creating empty doc:", {listDocs,listID, itemName })
    listDocs.forEach((listDoc: any) => {
      let newListDoc={
        listID: listDoc._id,
        boughtCount: 0,
        active: true,
        completed: false
      };
      if (listDoc._id !== listID) {
        newListDoc.active = false;
        newListDoc.completed = false;
      } 
      newItemLists.push(newListDoc);    
    });
    let newItemDoc={
      type: "item",
      name: itemName,
      quantity: 1,
      categoryID: null,
      lists: newItemLists
    }
    return(newItemDoc);
}