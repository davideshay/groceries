import { useEffect, useRef, useState } from "react";
import { translatedItemName } from "./translationUtilities";
import { ItemDoc, ItemDocs } from "./DBSchema";
import GenericSearchBar, { SearchRefType } from "./GenericSearchBar";
import { useGlobalDataStore } from "./GlobalData";

type PageState = {
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
    const [pageState,setPageState] = useState<PageState>({
        itemsNeedLoaded: true,
        recipeSearchRows: [],
    });
    const itemDocs = useGlobalDataStore((state) => state.itemDocs);
    const loading = useGlobalDataStore((state) => state.isLoading);
    const listRows = useGlobalDataStore((state) => state.listRows);
    const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
    const globalItemDocs = useGlobalDataStore((state) => state.globalItemDocs);
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
        if (pageState.itemsNeedLoaded && !loading ) {
            let searchIdx=0;
            let newSearchRows: RecipeSearchRow[] = [];
            globalItemDocs.forEach(idoc => {
                newSearchRows.push({id: String(searchIdx++),display: translatedItemName(String(idoc._id),idoc.name,idoc.name), data: {name: idoc.name,globalItemID: String(idoc._id) }})
            });
            (itemDocs as ItemDocs).forEach((idoc: ItemDoc) => {
                if ( idoc.globalItemID === null && !newSearchRows.some( sr => sr.display === idoc.name)) {
                    newSearchRows.push({id: String(searchIdx++), display: idoc.name, data: {name: idoc.name, globalItemID: null}})
                }
            })
            newSearchRows.sort((a,b)=> {
                return translatedItemName(a.data.globalItemID,a.display,a.display).toLocaleUpperCase().localeCompare(translatedItemName(b.data.globalItemID,b.display,b.display).toLocaleUpperCase())
            })
            setPageState(prevState=>({...prevState,itemsNeedLoaded: false,recipeSearchRows: newSearchRows}))
        }
    },[loading,globalItemDocs, itemDocs,pageState.itemsNeedLoaded])

    function selectRow(id: string, data: RecipeSearchData) {
        props.rowSelected(id,data);
        if (searchRef.current) {
            searchRef.current.resetSearch()
        }    
    }

    function addNewRecipeItem(name: string) {
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