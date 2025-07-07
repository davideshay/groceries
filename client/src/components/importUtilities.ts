import { PouchResponse, PouchResponseInit, RecipeFileType, TandoorRecipe } from "./DataTypes";
import { PickFilesResult } from "@capawesome/capacitor-file-picker";
import zip from 'jszip';
import { GlobalItemDoc, InitGlobalItem, InitRecipeDoc, RecipeDoc, RecipeInstruction, RecipeItem, RecipeItemInit } from "./DBSchema";
import { cloneDeep, isEmpty } from "lodash-es";
import { GlobalDataContext, GlobalDataState } from "./GlobalDataProvider";
import { usePouch } from "use-pouchdb";
import { useCallback, useContext } from "react";
import { AlertInput, useIonAlert, useIonLoading } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { t } from 'i18next';
import log from "./logger";

export function useProcessInputFile() {
    const db = usePouch();
    const globalData = useContext(GlobalDataContext);
    const [ presentAlert ] = useIonAlert();
    const [ presentLoading,dismissLoading] = useIonLoading();
    const { t } = useTranslation();
    return useCallback(
        async (fileType: RecipeFileType, pickResults: PickFilesResult): Promise<[boolean,string]> => {
            let success: boolean = false;
            let errorMessage: string = "";
            async function triggerLoadTandoor(alertData: any, recipeObjs: TandoorRecipe[]) {
                await presentLoading(t("general.importing_recipes") as string);
                const statusMessage = await loadTandoorRecipes(alertData,recipeObjs,db,globalData)
                await dismissLoading();
                await presentAlert({
                      header: t("general.import_recipe_results"),
                      message: statusMessage,
                      buttons: [
                        {text: t("general.ok"), role: "confirm"}
                      ],
                      cssClass: "import-status-alert"
                })              
            }
            if ((fileType.type==="tandoor" && fileType.fileType === "application/zip")) {
                await presentLoading(t("general.processing_zip_file") as string);
                const tandoorResponse = await processTandoorZip(pickResults);
                await dismissLoading();
                success=tandoorResponse.success;
                errorMessage=tandoorResponse.errorMessage;
                let alertInputs: AlertInput[] = getTandoorAlertInputs(tandoorResponse.recipeObjs);
                if (success) {
                    await presentAlert({
                        header: t("general.import_recipes_q"),
                        subHeader: t("general.select_recipes_import"),
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
    ,[globalData,db,dismissLoading,presentAlert,presentLoading,t])
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
    catch(err) {response.success=false;response.errorMessage=t("error.invalid_zip_file");return response}
    for (const [, value] of Object.entries(rzip.files)) {
        let indivZip = new zip();
        await indivZip.loadAsync(value.async("base64"),{base64: true});
        let zipObj = indivZip.files["recipe.json"];
        if (zipObj === null) {
            response.success=false;
            response.errorMessage=t("error.zip_not_contain_recipe");
            return response
        }
        let recipeJsonText = (await indivZip.files["recipe.json"].async("text"));
        let recipeObj: TandoorRecipe;
        try {recipeObj = JSON.parse(recipeJsonText)}
        catch(err) {response.success=false; response.errorMessage=t("error.invalid_recipe_json"); return response}
        response.recipeObjs.push(recipeObj);
    }
    return response;
}

async function loadTandoorRecipes(alertData: string[],recipeObjs: TandoorRecipe[],db: PouchDB.Database,globalData: GlobalDataState) : Promise<string> {
    if (alertData === undefined || alertData.length === 0) {return t("error.nothing_to_load") as string};
    let statusFull = ""
    for (let i = 0; i < alertData.length; i++) {
        let recipe = recipeObjs.find((recipe) => (recipe.name === alertData[i]));
        if (recipe === undefined) {log.error("Could not find recipe - "+alertData[i]); continue};
        if (await checkRecipeExists(recipe.name,db)) {
            log.warn("Could not import: "+alertData[i]+" - Duplicate");
            statusFull=statusFull+"\n"+t("error.could_not_import_recipe_dup",{recipe:alertData[i]});
            continue;
        }
        const [,statusMessage] = await createTandoorRecipe(recipe,db,globalData);
        statusFull=statusFull+"\n"+statusMessage
    }
    return statusFull;
}

async function createTandoorRecipe(recipeObj: TandoorRecipe, db: PouchDB.Database, globalData: GlobalDataState): Promise<[boolean,string]> {
    let newRecipeDoc: RecipeDoc = cloneDeep(InitRecipeDoc);
    newRecipeDoc.name = recipeObj.name;
    let newInstructions: RecipeInstruction[] = [];
    recipeObj.steps.forEach(step => {
        if (!isEmpty(step.instruction)) {
            let recipeInstruction: RecipeInstruction = {stepText: step.instruction}
            newInstructions.push(recipeInstruction);
        }
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
                if (recipeItem.recipeUOMName === "") {
                    recipeItem.recipeUOMName = findMatchingUOM(ingredient.unit.plural_name as string,globalData);
                }
                if (recipeItem.recipeUOMName === "" && recipeItem.globalItemID !== null && matchGlobalItem.defaultUOM !== null) {
                    recipeItem.recipeUOMName = matchGlobalItem.defaultUOM;
                }
                if (recipeItem.recipeUOMName === "" && (ingredient.unit.name !== "" || ingredient.unit.plural_name !== "")) {
                    recipeItem.recipeUOMName = null;
                    recipeItem.note = t("error.could_not_match_uom",{name: ingredient.unit.name ,pluralName: ingredient.unit.plural_name});
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
    catch(err) { response.successful = false; response.fullError = err; log.error("Creating recipe failed",err);}
    if (!response.pouchData.ok) { response.successful = false;}
    return [response.successful,t("general.loaded_recipe_successfully", {name: recipeObj.name})]
}

function findMatchingUOM(uom: string, globalData: GlobalDataState): string {
    if (uom === null || uom === undefined) {return ""};
    let foundUOM = globalData.uomDocs.find(u => ( ["system",globalData.recipeListGroup].includes(String(u.listGroupID)) && (u.description.toUpperCase() === uom.toUpperCase() || u.pluralDescription.toUpperCase() === uom.toUpperCase())));
    if (foundUOM === undefined) {
        foundUOM = globalData.uomDocs.find(u => {
            if (!["system",globalData.recipeListGroup].includes(String(u.listGroupID))) {return false}
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
        if (foundUOM !== undefined) {
            return foundUOM.name;
        }
    }
    if (foundUOM === undefined) {
        let translatedUOM = globalData.uomDocs.find(u=> ( ["system",globalData.recipeListGroup].includes(u.listGroupID) && (t("uom."+u.name,{count:1})).toLocaleUpperCase() === uom.toLocaleUpperCase() ) || (t("uom."+u.name,{count: 2}).toLocaleUpperCase() === uom.toLocaleUpperCase()) );
        if (translatedUOM === undefined) {
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
    let globalItem = globalData.globalItemDocs.find(gi => (gi.name.toUpperCase() === foodName.toUpperCase()));
    if (globalItem === undefined) {
        let translatedGlobal = globalData.globalItemDocs.find(git =>{
        return(
        (t("globalitem."+(git._id as string).substring(sysItemKey.length+1),{count: 1}).toLocaleUpperCase() === foodName.toLocaleUpperCase()) || 
        (t("globalitem."+(git._id as string).substring(sysItemKey.length+1),{count: 2}).toLocaleUpperCase() === foodName.toLocaleUpperCase()) )  })
        if (translatedGlobal === undefined) {return [null,"",returnInitGlobalItem]}
        else {return [translatedGlobal._id as string,t("globalitem."+(translatedGlobal._id as string).substring(sysItemKey.length+1),{count: 2}),translatedGlobal]}
    }
    else {return [globalItem._id as string,globalItem.name as string,globalItem]}
}

async function checkRecipeExists(recipeName: string, db: PouchDB.Database): Promise<boolean> {
    let exists=false;
    let recipeResults: PouchDB.Find.FindResponse<{}> = {docs: []}
    try {recipeResults = await db.find({
        use_index: "stdTypeName",
        selector: {
          type: "recipe",
          name: recipeName }
      })}
    catch(err) {exists=false; return exists};
    if (recipeResults.docs.length > 0) {exists = true};
    return exists;
}