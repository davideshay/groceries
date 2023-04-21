import { useCallback } from "react";
import { usePouch } from "use-pouchdb";
import { PouchResponse, PouchResponseInit } from "./DataTypes";
import { cloneDeep } from "lodash";
import { ItemDoc } from "./DBSchema";

export function useDeleteUomFromItems() {
    const db=usePouch()
  
    return useCallback(
      async (listID: string) => {
        let response: PouchResponse = cloneDeep(PouchResponseInit);
        let itemResults = await db.find({
          selector: {
            type: "item",
            name: { $exists: true },
            lists: { $elemMatch: { "listID": listID } }
          }
        })
        for (let i = 0; i < itemResults.docs.length; i++) {
          const itemDoc: ItemDoc = itemResults.docs[i] as ItemDoc;
          const newLists = []
          for (let j = 0; j < itemDoc.lists.length; j++) {
            if (itemDoc.lists[j].listID !== listID) {
              newLists.push(itemDoc.lists[j])
            }
          }
          itemDoc.lists = newLists;
          try {await db.put(itemDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }
        return response;
      },[db]) 
  }

  export function useDeleteUomFromRecipes() {
    const db=usePouch()
  
    return useCallback(
      async (listID: string) => {
        let response: PouchResponse = cloneDeep(PouchResponseInit);
        let itemResults = await db.find({
          selector: {
            type: "item",
            name: { $exists: true },
            lists: { $elemMatch: { "listID": listID } }
          }
        })
        for (let i = 0; i < itemResults.docs.length; i++) {
          const itemDoc: ItemDoc = itemResults.docs[i] as ItemDoc;
          const newLists = []
          for (let j = 0; j < itemDoc.lists.length; j++) {
            if (itemDoc.lists[j].listID !== listID) {
              newLists.push(itemDoc.lists[j])
            }
          }
          itemDoc.lists = newLists;
          try {await db.put(itemDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }
        return response;
      },[db]) 
  }
  