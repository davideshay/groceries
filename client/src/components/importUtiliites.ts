import { PouchResponse, PouchResponseInit, RecipeFileType, TandoorRecipe } from "./DataTypes";
import { PickFilesResult } from "@capawesome/capacitor-file-picker";
import zip from 'jszip';
import { GlobalItemDoc, InitGlobalItem, InitRecipeDoc, RecipeDoc, RecipeInstruction, RecipeItem, RecipeItemInit } from "./DBSchema";
import { cloneDeep } from "lodash";
import { GlobalDataContext, GlobalDataContextType, GlobalDataState } from "./GlobalDataProvider";
import { usePouch } from "use-pouchdb";
import { useCallback, useContext } from "react";
import { AlertInput, useIonAlert, useIonLoading } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { t } from 'i18next';

export function useProcessInputFile() {
    const db = usePouch();
    const globalData = useContext(GlobalDataContext);
    const [ presentAlert, dismissAlert ] = useIonAlert();
    const [ presentLoading,dismissLoading] = useIonLoading();
    const { t } = useTranslation();
    return useCallback(
        async (fileType: RecipeFileType, pickResults: PickFilesResult): Promise<[boolean,string]> => {
            let success: boolean = false;
            let errorMessage: string = "";
            async function triggerLoadTandoor(alertData: any, recipeObjs: TandoorRecipe[]) {
                await presentLoading("Importing Recipe(s)...");
                const statusMessage = await loadTandoorRecipes(alertData,recipeObjs,db,globalData)
                await dismissLoading();
                await presentAlert({
                      header: "Recipe Import Results",
                      message: statusMessage,
                      buttons: [
                        {text: t("general.ok"), role: "confirm"}
                      ],
                      cssClass: "import-status-alert"
                })              
            }
            if ((fileType.type==="tandoor" && fileType.fileType === "application/zip")) {
                await presentLoading("Processing Zip file...");
                const tandoorResponse = await processTandoorZip(pickResults);
                await dismissLoading();
                success=tandoorResponse.success;
                errorMessage=tandoorResponse.errorMessage;
                let alertInputs: AlertInput[] = getTandoorAlertInputs(tandoorResponse.recipeObjs);
                if (success) {
                    await presentAlert({
                        header: "Import Recipes?",
                        subHeader: "Select the recipes to import below",
                        buttons: [
                            { text: t("general.cancel"), role: "cancel", handler: () => {}},
                            { text: t("general.ok"), role: "confirm", handler: (alertData) => {triggerLoadTandoor(alertData,tandoorResponse.recipeObjs)}},
                            ],
                        inputs: alertInputs
                })
                }
            }
            return [success,errorMessage]
        }
    ,[globalData,db])
}

function getTandoorAlertInputs(recipeObjs: TandoorRecipe[]): AlertInput[] {
    let alertInputs: AlertInput[] = [];
    recipeObjs.forEach(recipe => {
        alertInputs.push({
            type: "checkbox",
            checked: true,
            name: recipe.name,
            value: recipe.name,
            label: recipe.name
        })
    })
    return alertInputs;
}

type TandoorResponse = {
    success: boolean,
    errorMessage: string,
    recipeObjs: TandoorRecipe[]
}

async function processTandoorZip(inputFile: PickFilesResult) : Promise<TandoorResponse> {
    let response: TandoorResponse = {
        success : true,
        errorMessage: "",
        recipeObjs: []
    }
    let rzip = new zip();
    try { await rzip.loadAsync(inputFile.files[0].data!,{base64: true});}
    catch(err) {response.success=false;response.errorMessage="Invalid ZIP file";return response}
    for (const [key, value] of Object.entries(rzip.files)) {
        let indivZip = new zip();
        await indivZip.loadAsync(value.async("base64"),{base64: true});
        let zipObj = indivZip.files["recipe.json"];
        if (zipObj === null) {
            response.success=false;
            response.errorMessage="At least one zip file did not contain recipe input";
            return response
        }
        let recipeJsonText = (await indivZip.files["recipe.json"].async("text"));
        let recipeObj: TandoorRecipe;
        try {recipeObj = JSON.parse(recipeJsonText)}
        catch(err) {response.success=false; response.errorMessage="Invalid recipe JSON in file"; return response}
        response.recipeObjs.push(recipeObj);
    }
    return response;
}

async function loadTandoorRecipes(alertData: string[],recipeObjs: TandoorRecipe[],db: PouchDB.Database,globalData: GlobalDataState) : Promise<string> {
    if (alertData == undefined || alertData.length === 0) {return "Nothing to Load"};
    let statusFull = ""
    for (let i = 0; i < alertData.length; i++) {
        let recipe = recipeObjs.find((recipe) => (recipe.name === alertData[i]));
        if (recipe === undefined) {console.log("Could not find recipe - "+alertData[i]); continue};
        if (await checkRecipeExists(recipe.name,db)) {
            console.log("Could not import: "+alertData[i]+" - Duplicate");
            statusFull=statusFull+"\n"+"Could not import: "+alertData[i]+" - Duplicate"
            continue;
        }
        const [success,statusMessage] = await createTandoorRecipe(recipe,db,globalData);
        statusFull=statusFull+"\n"+statusMessage
    }
    return statusFull;
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
    let matchGlobalItem: GlobalItemDoc;
    recipeObj.steps.forEach(step => {
        step.ingredients.forEach(ingredient => {
            let recipeItem: RecipeItem = cloneDeep(RecipeItemInit);
            [recipeItem.globalItemID,recipeItem.name,matchGlobalItem] = findMatchingGlobalItem(ingredient.food.name,globalData);  
            if (recipeItem.globalItemID == null) {
                [recipeItem.globalItemID,recipeItem.name,matchGlobalItem] = findMatchingGlobalItem(ingredient.food.plural_name,globalData);
            }
            if (recipeItem.globalItemID == null) {
                recipeItem.name = ingredient.food.name as string;
            }
            if (ingredient.unit !== null) {
                recipeItem.recipeUOMName = findMatchingUOM(ingredient.unit.name as string,globalData);
                if (recipeItem.recipeUOMName == "") {
                    recipeItem.recipeUOMName = findMatchingUOM(ingredient.unit.plural_name as string,globalData);
                }
                if (recipeItem.recipeUOMName == "" && recipeItem.globalItemID !== null && matchGlobalItem.defaultUOM !== null) {
                    recipeItem.recipeUOMName = matchGlobalItem.defaultUOM;
                }
                if (recipeItem.recipeUOMName == "" && (ingredient.unit.name != "" || ingredient.unit.plural_name != "")) {
                    recipeItem.note = "Could Not find UoM. Original was: "+ingredient.unit.name + " or "+ingredient.unit.plural_name;
                }
            }
            let qtyToUse = ingredient.amount === 0 ? 1 : ingredient.amount
            recipeItem.recipeQuantity = qtyToUse;
            recipeItem.shoppingQuantity = qtyToUse;
            recipeItem.shoppingUOMName =recipeItem.recipeUOMName;
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
    return [response.successful,"Loaded Recipe "+recipeObj.name+ " successfully."]

}

function findMatchingUOM(uom: string, globalData: GlobalDataState): string {
    if (uom == null || uom == undefined) {return ""};
    let foundUOM = globalData.uomDocs.find(u => (u.description.toUpperCase() == uom.toUpperCase() || u.pluralDescription.toUpperCase() == uom.toUpperCase()));
    if (foundUOM == undefined) {
        foundUOM = globalData.uomDocs.find(u => {
            let foundAlt = false;
            if (u.hasOwnProperty("alternates") && u.alternates !== null) {
                let upperAlternates = u.alternates!.map(el => (el.replace(/\W|_/g, '').toUpperCase()))
                foundAlt = upperAlternates.includes(uom.replace(/\W|_/g, '').toUpperCase());
            }
            if (!foundAlt && u.hasOwnProperty("customAlternates") && u.customAlternates !== null) {
                let upperCustomAlternates = u.customAlternates!.map(el => (el.replace(/\W|_/g, '').toUpperCase()))
                foundAlt = upperCustomAlternates.includes(uom.replace(/\W|_/g, '').toUpperCase());
            }
            return foundAlt;
        })
        if (foundUOM != undefined) {
            return foundUOM.name;
        }
    }
    if (foundUOM == undefined) {
        let translatedUOM = globalData.uomDocs.find(u=> ((t("uom."+u.name,{count:1})).toLocaleUpperCase() == uom.toLocaleUpperCase() ) || (t("uom."+u.name,{count: 2}).toLocaleUpperCase() == uom.toLocaleUpperCase()) );
        if (translatedUOM == undefined) {
            return "";
        } else {
            return translatedUOM.name
        }
    }
    else { return foundUOM.name}
}

export function findMatchingGlobalItem(foodName: string|null, globalData: GlobalDataState) : [string|null,string, GlobalItemDoc] {
    let sysItemKey = "system:item";
    let returnInitGlobalItem = cloneDeep(InitGlobalItem)
    if (foodName === null) {return [null,"",returnInitGlobalItem]}
    let globalItem = globalData.globalItemDocs.find(gi => (gi.name.toUpperCase() == foodName.toUpperCase()));
    if (globalItem == undefined) {
        let translatedGlobal = globalData.globalItemDocs.find(git => (t("globalitem."+(git._id as string).substring(sysItemKey.length+1),{count: 1}).toLocaleUpperCase() == foodName.toLocaleUpperCase()) || 
        (t("globalitem."+(git._id as string).substring(sysItemKey.length+1),{count: 2}).toLocaleUpperCase() == foodName.toLocaleUpperCase()) )
        if (translatedGlobal == undefined) {return [null,"",returnInitGlobalItem]}
        else {return [translatedGlobal._id as string,t(translatedGlobal._id as string),translatedGlobal]}
    }
    else {return [globalItem._id as string,globalItem.name as string,globalItem]}
}

async function checkRecipeExists(recipeName: string, db: PouchDB.Database): Promise<boolean> {
    let exists=false;
    let recipeResults: PouchDB.Find.FindResponse<{}> = {docs: []}
    try {recipeResults = await db.find({
        selector: {
          type: "recipe",
          name: recipeName }
      })}
    catch(err) {exists=false; return exists};
    if (recipeResults.docs.length > 0) {exists = true};
    return exists;
}