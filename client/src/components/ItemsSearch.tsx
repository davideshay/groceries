import { useContext, useEffect, useState } from "react";
import { useFind } from "use-pouchdb";
import { GlobalDataContext } from "./GlobalDataProvider";
import { translatedItemName } from "./translationUtilities";
import { ItemDoc, ItemDocs } from "./DBSchema";
// import { SearchRefType } from "./GenericSearchBar";
import { ItemSearch } from "./DataTypes";

type PageState = {
    allListGroups: Set<string>,
    listGroupsNeedInit: boolean,
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


const ItemsSearch: React.FC<ItemsSearchProps> = (props: ItemsSearchProps) => {
    const [pageState,setPageState] = useState<PageState>({
        allListGroups: new Set(""),
        listGroupsNeedInit: true,
        itemsNeedLoaded: true,
        itemSearchRows: [],
    });
    const {docs: itemDocs, loading: itemsLoading } = useFind({
        index: "stdTypeListGroupID",
        selector: { type: "item", "listGroupID": { "$in": Array.from(pageState.allListGroups)} } 
    });
    const globalData = useContext(GlobalDataContext); 
//    const searchRef = useRef<SearchRefType>(null);

    useEffect( () => {
        if (globalData.listRowsLoaded) {
            let newListGroups: Set<string> = new Set();
            globalData.listRows.forEach((lr) => {
                newListGroups.add(String(lr.listDoc.listGroupID))
            })
            setPageState(prevState=>({...prevState,allListGroups: newListGroups,listGroupsNeedInit: false}))
        }
    },[globalData.listRows, globalData.listRowsLoaded])

    useEffect( () => {
        if (!pageState.listGroupsNeedInit && pageState.itemsNeedLoaded && !itemsLoading && !globalData.globalItemsLoading) {
            let searchIdx=0;
            let newSearchRows: RecipeSearchRow[] = [];
            globalData.globalItemDocs.forEach(idoc => {
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
    },[pageState.listGroupsNeedInit,itemsLoading,globalData.globalItemsLoading,globalData.globalItemDocs, itemDocs,pageState.itemsNeedLoaded])

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