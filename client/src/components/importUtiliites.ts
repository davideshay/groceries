import { PouchResponse, PouchResponseInit, RecipeFileType, TandoorRecipe } from "./DataTypes";
import { PickFilesResult } from "@capawesome/capacitor-file-picker";
import zip from 'jszip';
import { InitRecipeDoc, RecipeDoc, RecipeInstruction, RecipeItem, RecipeItemInit } from "./DBSchema";
import { cloneDeep } from "lodash";
import { GlobalDataContextType, GlobalDataState } from "./GlobalDataProvider";

export async function processInputFile(fileType: RecipeFileType,pickResults: PickFilesResult, db: PouchDB.Database, globalData: GlobalDataState) : Promise<[boolean,string]> {
    let success: boolean = false;
    let errorMessage: string = "";
    if ((fileType.type==="tandoor" && fileType.fileType === "application/zip")) {
        [success,errorMessage] = await processTandoorZip(pickResults,db,globalData);
    }
    return [success,errorMessage]
}

async function processTandoorZip(inputFile: PickFilesResult, db: PouchDB.Database, globalData: GlobalDataState) : Promise<[boolean, string]> {
    let success=true;
    let errorMessage="";
    let rzip = new zip();
    try { await rzip.loadAsync(inputFile.files[0].data!,{base64: true});}
    catch(err) {success=false;errorMessage="Invalid ZIP file";return [success,errorMessage]}
    console.log("rzip:",rzip);
    rzip.forEach(async (rp,file) => {
        let indivZip = new zip();
        await indivZip.loadAsync(file.async("base64"),{base64: true});
        let zipObj = indivZip.files["recipe.json"];
        if (zipObj === null) {
            success=false;
            errorMessage="At least one zip file did not contain recipe input";
            return [success,errorMessage]
        }
        console.log("indivZip:",indivZip);
        let recipeJsonText = (await indivZip.files["recipe.json"].async("text"));
        let recipeObj: TandoorRecipe;
        try {recipeObj = JSON.parse(recipeJsonText)}
        catch(err) {success=false; errorMessage="Invalid recipe JSON in file"; return [success,errorMessage]}
        console.log(recipeObj);
        [success,errorMessage] = await createTandoorRecipe(recipeObj,db, globalData);
    })
    return [success,errorMessage]
}

async function createTandoorRecipe(recipeObj: TandoorRecipe, db: PouchDB.Database, globalData: GlobalDataState): Promise<[boolean,string]> {
    let newRecipeDoc: RecipeDoc = cloneDeep(InitRecipeDoc);
    newRecipeDoc.name = recipeObj.name;
    let newInstructions: RecipeInstruction[] = [];
    recipeObj.steps.forEach(step => {
        let recipeInstruction: RecipeInstruction = {stepText: step.instruction}
        newInstructions.push(recipeInstruction);
    })
    newRecipeDoc.instructions = newInstructions;
    let newRecipeItems: RecipeItem[] = [];
    recipeObj.steps.forEach(step => {
        step.ingredients.forEach(ingredient => {
            let recipeItem: RecipeItem = cloneDeep(RecipeItemInit);
            [recipeItem.globalItemID,recipeItem.name] = findMatchingGlobalItem(ingredient.food.name,globalData);  
            if (recipeItem.globalItemID == null) {
                [recipeItem.globalItemID,recipeItem.name] = findMatchingGlobalItem(ingredient.food.plural_name,globalData);
            }
            if (recipeItem.globalItemID == null) {
                recipeItem.name = ingredient.food.name as string;
            }
            newRecipeItems.push(recipeItem);
        })
    })
    newRecipeDoc.items = newRecipeItems;
    let curDateStr=(new Date()).toISOString()
    newRecipeDoc.updatedAt = curDateStr;
    let response: PouchResponse = cloneDeep(PouchResponseInit);
    try { response.pouchData = await db.post(newRecipeDoc); }
    catch(err) { response.successful = false; response.fullError = err; console.log("ERROR:",err);}
    if (!response.pouchData.ok) { response.successful = false;}
    return [response.successful,""]

}

function findMatchingGlobalItem(foodName: string|null, globalData: GlobalDataState) : [string|null,string] {
    console.log("findmatch", foodName);
    if (foodName === null) {return [null,""]}
    let globalItem = globalData.globalItemDocs.find(gi => (gi.name.toUpperCase() == foodName.toUpperCase()));
    if (globalItem == undefined) {return [null,""];}
    else {return [globalItem._id as string,globalItem.name as string]}
}