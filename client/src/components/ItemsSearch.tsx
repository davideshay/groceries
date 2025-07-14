import { useEffect, useState } from "react";
import { translatedItemName } from "./translationUtilities";
import { ItemDoc, ItemDocs } from "./DBSchema";
// import { SearchRefType } from "./GenericSearchBar";
import { ItemSearch } from "./DataTypes";
import { useGlobalDataStore } from "./GlobalData";

type PageState = {
    itemsNeedLoaded: boolean,
    itemSearchRows: ItemSearch[],
}

export type ItemSearchData = {
    name: string,
    globalItemID: string | null
}

export type RecipeSearchRow = {
    id: string,
    display: string,
    data: ItemSearchData
}

type ItemsSearchProps = {
    rowSelected: (id: string, data: ItemSearchData) => void,
    addItemWithoutRow: (name: string) => void,
}

const ItemsSearch: React.FC<ItemsSearchProps> = () => {
    const [pageState,setPageState] = useState<PageState>({
        itemsNeedLoaded: true,
        itemSearchRows: [],
    });
    const itemDocs = useGlobalDataStore((state) => state.itemDocs);
    const loading = useGlobalDataStore((state) => state.isLoading);
    const globalItemDocs = useGlobalDataStore((state) => state.globalItemDocs);
    
//    const searchRef = useRef<SearchRefType>(null);

    useEffect( () => {
        if (pageState.itemsNeedLoaded && !loading) {
            let searchIdx=0;
            const newSearchRows: RecipeSearchRow[] = [];
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
    },[pageState,loading,globalItemDocs, itemDocs,pageState.itemsNeedLoaded])

    // function selectRow(id: string, data: ItemSearchData) {
    //     props.rowSelected(id,data);
    //     if (searchRef.current) {
    //         searchRef.current.resetSearch()
    //     }    
    // }

    // function addNewRecipeItem(name: string) {
    //     props.addItemWithoutRow(name);
    //     if (searchRef.current) {
    //         searchRef.current.resetSearch()
    //     }    
    // }

    return (
        <></>
//        <GenericSearchBar searchRows={pageState.itemSearchRows} rowSelected={selectRow} addItemWithoutRow={addNewRecipeItem} ref={searchRef}/>
    )
}

export default ItemsSearch;