import { useCallback } from "react";
import { PouchResponse, PouchResponseInit } from "./DataTypes";
import { cloneDeep } from "lodash-es";
import { ItemDoc, RecipeDoc } from "./DBSchema";
import log from "./logger";
import { useGlobalDataStore } from "./GlobalData";

export function useDeleteUomFromItems() {
    const db=useGlobalDataStore((state)=>state.db);
  
    return useCallback(
      async (uomID: string) => {
        const response: PouchResponse = cloneDeep(PouchResponseInit);
        let itemResults: PouchDB.Find.FindResponse<object>
        if (db === null) {
          response.successful = false;
          response.errorText = "No database available";
          return response;
        }
        try { itemResults = await db.find({
            use_index: "stdTypeLists",
            selector: {
              type: "item",
              lists: { $elemMatch: { "uomName": uomID } }
            }
          }) }
        catch(err) {log.debug("Could not get items in list");
                    response.successful = false; response.fullError = err;
                    return response;}  
        for (let i = 0; i < itemResults.docs.length; i++) {
          const itemDoc: ItemDoc = itemResults.docs[i] as ItemDoc;
          for (let j = 0; j < itemDoc.lists.length; j++) {
            if (itemDoc.lists[j].uomName === uomID) {
              itemDoc.lists[j].uomName = null;
            }
          }
          try {await db.put(itemDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }
        return response;
      },[db]) 
  }

  export function useDeleteUomFromRecipes() {
    const db=useGlobalDataStore((state)=>state.db);
  
    return useCallback(
      async (uomID: string) => {
        const response: PouchResponse = cloneDeep(PouchResponseInit);
        let recipeResults: PouchDB.Find.FindResponse<object>
        if (db === null) {response.successful = false; response.errorText="No database available"; return response;}
        try { recipeResults = await db.find({
          use_index: "stdType",
          selector: {
            type: "recipe",
            "$or": [
                  {items: { $elemMatch: { "recipeUOMName": uomID } } },
                  {items: { $elemMatch: { "shoppingUOMName": uomID}} } ]
          }
        }) }
        catch(err) { log.debug("Could not update recipe");
                    response.successful = false; response.fullError = err;
                    return response;
                    }
        for (let i = 0; i < recipeResults.docs.length; i++) {
          const recipeDoc: RecipeDoc = recipeResults.docs[i] as RecipeDoc;
          for (let j = 0; j < recipeDoc.items.length; j++) {
            if (recipeDoc.items[j].recipeUOMName === uomID) {
              recipeDoc.items[j].recipeUOMName = null
            }
            if (recipeDoc.items[j].shoppingUOMName === uomID) {
              recipeDoc.items[j].shoppingUOMName = null
            }
          }
          try {await db.put(recipeDoc)}
          catch(err) {response.successful = false; response.fullError = err; }
        }
        return response;
      },[db]) 
  }
  