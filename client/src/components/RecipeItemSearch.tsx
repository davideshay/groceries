import { useContext, useEffect, useRef, useState } from "react";
import { useLists } from "./Usehooks";
import { useFind } from "use-pouchdb";
import { GlobalDataContext } from "./GlobalDataProvider";
import { translatedItemName } from "./translationUtilities";
import { ItemDoc, ItemDocs } from "./DBSchema";
import { cloneDeep } from "lodash";
import GenericSearchBar, { SearchRefType } from "./GenericSearchBar";

type PageState = {
    allListGroups: Set<string>,
    listGroupsNeedInit: boolean,
    itemsNeedLoaded: boolean,
    recipeSearchRows: RecipeSearchRow[],
}

export type RecipeSearchData = {
    name: string,
    globalItemID: string | null
}

export type RecipeSearchRow = {
    id: string,
    display: string,
    data: RecipeSearchData
}

type RecipeItemSearchProps = {
    rowSelected: (id: string, data: RecipeSearchData) => void,
    addItemWithoutRow: (name: string) => void,
}


const RecipeItemSearch: React.FC<RecipeItemSearchProps> = (props: RecipeItemSearchProps) => {
    const {dbError: listError,listRowsLoaded,listRows} = useLists()
    const [pageState,setPageState] = useState<PageState>({
        allListGroups: new Set(""),
        listGroupsNeedInit: true,
        itemsNeedLoaded: true,
        recipeSearchRows: [],
    });
    const {docs: itemDocs, loading: itemsLoading, error: itemsError} = useFind({
        index: { fields: ["type","listGroupID"] },
        selector: { type: "item", "listGroupID": { "$in": Array.from(pageState.allListGroups)} } 
    });
    const globalData = useContext(GlobalDataContext); 
    const searchRef = useRef<SearchRefType>(null);

    useEffect( () => {
        if (listRowsLoaded) {
            let newListGroups: Set<string> = new Set();
            listRows.forEach((lr) => {
                newListGroups.add(String(lr.listDoc.listGroupID))
            })
            setPageState(prevState=>({...prevState,allListGroups: newListGroups,listGroupsNeedInit: false}))
        }
    },[listRows, listRowsLoaded])

    useEffect( () => {
        if (!pageState.listGroupsNeedInit && pageState.itemsNeedLoaded && !itemsLoading && !globalData.globalItemsLoading) {
            let searchIdx=0;
            let newSearchRows: RecipeSearchRow[] = [];
            globalData.globalItemDocs.forEach(idoc => {
                newSearchRows.push({id: String(searchIdx++),display: translatedItemName(String(idoc._id),idoc.name), data: {name: idoc.name,globalItemID: String(idoc._id) }})
            });
            (itemDocs as ItemDocs).forEach((idoc: ItemDoc) => {
                if ( idoc.globalItemID === null && !newSearchRows.some( sr => sr.display === idoc.name)) {
                    newSearchRows.push({id: String(searchIdx++), display: idoc.name, data: {name: idoc.name, globalItemID: null}})
                }
            })
            newSearchRows.sort((a,b)=> {
                return translatedItemName(a.data.globalItemID,a.display).toLocaleUpperCase().localeCompare(translatedItemName(b.data.globalItemID,b.display).toLocaleUpperCase())
            })
            setPageState(prevState=>({...prevState,itemsNeedLoaded: false,recipeSearchRows: newSearchRows}))
        }
    },[pageState.listGroupsNeedInit,itemsLoading,globalData.globalItemsLoading])

    function selectRow(id: string, data: RecipeSearchData) {
        console.log("select Row:",id,data);
        props.rowSelected(id,data);
        if (searchRef.current) {
            searchRef.current.resetSearch()
        }    
    }

    function addNewRecipeItem(name: string) {
        console.log("ADD NEW RECIPE ITEM",name)
        props.addItemWithoutRow(name);
        if (searchRef.current) {
            searchRef.current.resetSearch()
        }    
    }


    return (

        <GenericSearchBar searchRows={pageState.recipeSearchRows} rowSelected={selectRow} addItemWithoutRow={addNewRecipeItem} ref={searchRef}/>

    )
}

export default RecipeItemSearch;