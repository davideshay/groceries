import { PouchResponse, PouchResponseInit, RecipeFileType, TandoorRecipe } from "./DataTypes";
import { PickFilesResult } from "@capawesome/capacitor-file-picker";
import zip from 'jszip';
import { GlobalItemDoc, InitGlobalItem, InitRecipeDoc, RecipeDoc, RecipeInstruction, RecipeItem, RecipeItemInit } from "./DBSchema";
import { cloneDeep, isEmpty } from "lodash-es";
import { useCallback } from "react";
import { AlertInput, useIonAlert, useIonLoading } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { t } from 'i18next';
import log from "./logger";
import { useGlobalDataStore } from "./GlobalData";

export function useProcessInputFile() {
    const db = useGlobalDataStore((state) => state.db);
    const [ presentAlert ] = useIonAlert();
    const [ presentLoading,dismissLoading] = useIonLoading();
    const { t } = useTranslation();
    return useCallback(
        async (fileType: RecipeFileType, pickResults: PickFilesResult): Promise<[boolean,string]> => {
            let success: boolean = false;
            let errorMessage: string = "";
            if (db === null) {return [false,""]};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async function triggerLoadTandoor(alertData: any, recipeObjs: TandoorRecipe[]) {
                await presentLoading(t("general.importing_recipes") as string);
                const statusMessage = await loadTandoorRecipes(alertData,recipeObjs)
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
                const alertInputs: AlertInput[] = getTandoorAlertInputs(tandoorResponse.recipeObjs);
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
    ,[db,dismissLoading,presentAlert,presentLoading,t])
}

function getTandoorAlertInputs(recipeObjs: TandoorRecipe[]): AlertInput[] {
    const alertInputs: AlertInput[] = [];
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
    const response: TandoorResponse = {
        success : true,
        errorMessage: "",
        recipeObjs: []
    }
    const rzip = new zip();
    try { await rzip.loadAsync(inputFile.files[0].data!,{base64: true});}
    catch {response.success=false;response.errorMessage=t("error.invalid_zip_file");return response}
    for (const [, value] of Object.entries(rzip.files)) {
        const indivZip = new zip();
        await indivZip.loadAsync(value.async("base64"),{base64: true});
        const zipObj = indivZip.files["recipe.json"];
        if (zipObj === null) {
            response.success=false;
            response.errorMessage=t("error.zip_not_contain_recipe");
            return response
        }
        const recipeJsonText = (await indivZip.files["recipe.json"].async("text"));
        let recipeObj: TandoorRecipe;
        try {recipeObj = JSON.parse(recipeJsonText)}
        catch {response.success=false; response.errorMessage=t("error.invalid_recipe_json"); return response}
        response.recipeObjs.push(recipeObj);
    }
    return response;
}

async function loadTandoorRecipes(alertData: string[],recipeObjs: TandoorRecipe[]) : Promise<string> {
    if (alertData === undefined || alertData.length === 0) {return t("error.nothing_to_load") as string};
    let statusFull = ""
    for (let i = 0; i < alertData.length; i++) {
        const recipe = recipeObjs.find((recipe) => (recipe.name === alertData[i]));
        if (recipe === undefined) {log.error("Could not find recipe - "+alertData[i]); continue};
        if (await checkRecipeExists(recipe.name)) {
            log.warn("Could not import: "+alertData[i]+" - Duplicate");
            statusFull=statusFull+"\n"+t("error.could_not_import_recipe_dup",{recipe:alertData[i]});
            continue;
        }
        const [,statusMessage] = await createTandoorRecipe(recipe);
        statusFull=statusFull+"\n"+statusMessage
    }
    return statusFull;
}

async function createTandoorRecipe(recipeObj: TandoorRecipe): Promise<[boolean,string]> {
    const db = useGlobalDataStore.getState().db
    const newRecipeDoc: RecipeDoc = cloneDeep(InitRecipeDoc);
    newRecipeDoc.name = recipeObj.name;
    const newInstructions: RecipeInstruction[] = [];
    recipeObj.steps.forEach(step => {
        if (!isEmpty(step.instruction)) {
            const recipeInstruction: RecipeInstruction = {stepText: step.instruction}
            newInstructions.push(recipeInstruction);
        }
    })
    newRecipeDoc.instructions = newInstructions;
    const newRecipeItems: RecipeItem[] = [];
    let matchGlobalItem: GlobalItemDoc;
    recipeObj.steps.forEach(step => {
        step.ingredients.forEach(ingredient => {
            const recipeItem: RecipeItem = cloneDeep(RecipeItemInit);
            [recipeItem.globalItemID,recipeItem.name,matchGlobalItem] = findMatchingGlobalItem(ingredient.food.name);  
            if (recipeItem.globalItemID == null) {
                [recipeItem.globalItemID,recipeItem.name,matchGlobalItem] = findMatchingGlobalItem(ingredient.food.plural_name);
            }
            if (recipeItem.globalItemID == null) {
                recipeItem.name = ingredient.food.name as string;
            }
            if (ingredient.unit !== null) {
                recipeItem.recipeUOMName = findMatchingUOM(ingredient.unit.name as string);
                if (recipeItem.recipeUOMName === "") {
                    recipeItem.recipeUOMName = findMatchingUOM(ingredient.unit.plural_name as string);
                }
                if (recipeItem.recipeUOMName === "" && recipeItem.globalItemID !== null && matchGlobalItem.defaultUOM !== null) {
                    recipeItem.recipeUOMName = matchGlobalItem.defaultUOM;
                }
                if (recipeItem.recipeUOMName === "" && (ingredient.unit.name !== "" || ingredient.unit.plural_name !== "")) {
                    recipeItem.recipeUOMName = null;
                    recipeItem.note = t("error.could_not_match_uom",{name: ingredient.unit.name ,pluralName: ingredient.unit.plural_name});
                }
            }
            const qtyToUse = ingredient.amount === 0 ? 1 : ingredient.amount
            recipeItem.recipeQuantity = qtyToUse;
            recipeItem.shoppingQuantity = qtyToUse;
            recipeItem.shoppingUOMName =recipeItem.recipeUOMName;
            newRecipeItems.push(recipeItem);
        })
    })
    newRecipeDoc.items = newRecipeItems;
    const curDateStr=(new Date()).toISOString()
    newRecipeDoc.updatedAt = curDateStr;
    const response: PouchResponse = cloneDeep(PouchResponseInit);
    if (db === null) {return [false,"No DB Available"];}
    try { response.pouchData = await db.post(newRecipeDoc); }
    catch(err) { response.successful = false; response.fullError = err; log.error("Creating recipe failed",err);}
    if (!response.pouchData.ok) { response.successful = false;}
    return [response.successful,t("general.loaded_recipe_successfully", {name: recipeObj.name})]
}

function findMatchingUOM(uom: string): string {
    const uomDocs = useGlobalDataStore.getState().uomDocs;
    const recipeListGroup = useGlobalDataStore.getState().recipeListGroup;

    if (uom === null || uom === undefined) {return ""};
    let foundUOM = uomDocs.find(u => ( ["system",recipeListGroup].includes(String(u.listGroupID)) && (u.description.toUpperCase() === uom.toUpperCase() || u.pluralDescription.toUpperCase() === uom.toUpperCase())));
    if (foundUOM === undefined) {
        foundUOM = uomDocs.find(u => {
            if (!["system",recipeListGroup].includes(String(u.listGroupID))) {return false}
            let foundAlt = false;
            if (Object.prototype.hasOwnProperty.call(u, "alternates") && u.alternates !== null) {
                const upperAlternates = u.alternates!.map(el => (el.replace(/\W|_/g, '').toUpperCase()))
                foundAlt = upperAlternates.includes(uom.replace(/\W|_/g, '').toUpperCase());
            }
            if (!foundAlt && Object.prototype.hasOwnProperty.call(u, "customAlternates") && u.customAlternates !== null) {
                const upperCustomAlternates = u.customAlternates!.map(el => (el.replace(/\W|_/g, '').toUpperCase()))
                foundAlt = upperCustomAlternates.includes(uom.replace(/\W|_/g, '').toUpperCase());
            }
            return foundAlt;
        })
        if (foundUOM !== undefined) {
            return foundUOM.name;
        }
    }
    if (foundUOM === undefined) {
        const translatedUOM = uomDocs.find(u=> ( ["system",recipeListGroup].includes(u.listGroupID) && (t("uom."+u.name,{count:1})).toLocaleUpperCase() === uom.toLocaleUpperCase() ) || (t("uom."+u.name,{count: 2}).toLocaleUpperCase() === uom.toLocaleUpperCase()) );
        if (translatedUOM === undefined) {
            return "";
        } else {
            return translatedUOM.name
        }
    }
    else { return foundUOM.name}
}

export function findMatchingGlobalItem(foodName: string|null) : [string|null,string, GlobalItemDoc] {
    const globalItemDocs = useGlobalDataStore.getState().globalItemDocs;
    const sysItemKey = "system:item";
    const returnInitGlobalItem = cloneDeep(InitGlobalItem)
    if (foodName === null) {return [null,"",returnInitGlobalItem]}
    const globalItem = globalItemDocs.find(gi => (gi.name.toUpperCase() === foodName.toUpperCase()));
    if (globalItem === undefined) {
        const translatedGlobal = globalItemDocs.find(git =>{
        return(
        (t("globalitem."+(git._id as string).substring(sysItemKey.length+1),{count: 1}).toLocaleUpperCase() === foodName.toLocaleUpperCase()) || 
        (t("globalitem."+(git._id as string).substring(sysItemKey.length+1),{count: 2}).toLocaleUpperCase() === foodName.toLocaleUpperCase()) )  })
        if (translatedGlobal === undefined) {return [null,"",returnInitGlobalItem]}
        else {return [translatedGlobal._id as string,t("globalitem."+(translatedGlobal._id as string).substring(sysItemKey.length+1),{count: 2}),translatedGlobal]}
    }
    else {return [globalItem._id as string,globalItem.name as string,globalItem]}
}

async function checkRecipeExists(recipeName: string): Promise<boolean> {
    let exists=false;
    const recipeDocs = useGlobalDataStore.getState().recipeDocs;
    exists = recipeDocs.some((recipe) => recipe.name === recipeName);
    return exists;
}