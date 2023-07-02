import { IonItem,  IonPopover, IonContent, IonList, IonSearchbar } from "@ionic/react"
import { cloneDeep } from "lodash"
import { useEffect, useState, KeyboardEvent, forwardRef, useImperativeHandle, Ref, useId, useRef } from "react"
import "./GenericSearchBar.css"
import { Capacitor } from "@capacitor/core"

export type SearchRow = {
    id: string,
    display: string,
    data: any
}

type SearchState = {
    searchCriteria: string,
    isOpen: boolean,
    isFocused: boolean,
    filteredRows: SearchRow[]
}

const searchStateInit: SearchState = {
    searchCriteria:"",
    isOpen: false,
    isFocused: false,
    filteredRows: []
}

export interface SearchRefType {
    resetSearch: () => void;
}

export type SearchBarProps = { 
    searchRows: SearchRow[],
    rowSelected: (id: string, data: any) => void,
    addItemWithoutRow: (name: string) => void,
}

function  GenericSearchBar({searchRows, rowSelected, addItemWithoutRow}: SearchBarProps,ref: Ref<SearchRefType>) {
    const [searchState, setSearchState] = useState<SearchState>(searchStateInit)
    const componentID = useId()
    const localSearchRef=useRef<any>(null);
    const enterKeyValueRef=useRef<string>("");

    function resetSearch() {
//        setSearchState(searchStateInit)
        setSearchState(prevState=>({...prevState,searchCriteria:"",isOpen:false,isFocused:false}))
    }

    useImperativeHandle(ref, () => ({resetSearch}));

    useEffect( () => {
        function beforeInputData(e:any) {
            if (e && e.data && e.data.includes("\n")) {
                enterKeyValueRef.current= e.data.length > 1 ? e.data.slice(0,-1) : "";
                addItemWithoutRow(searchState.searchCriteria)
            }
        }
        if (localSearchRef && localSearchRef.current && (Capacitor.getPlatform() === "android")) {
            let localRef=localSearchRef.current;
            localRef.addEventListener('beforeinput',beforeInputData,false)
            return () => {
                localRef.removeEventListener('beforeinput',beforeInputData,false)
            }
        }
    },[searchState.searchCriteria,localSearchRef,addItemWithoutRow])

    useEffect( () => {
        let newFilteredRows: SearchRow[] = cloneDeep(searchRows.filter(sr => (sr.display.toUpperCase().includes(searchState.searchCriteria.toUpperCase()))))
        newFilteredRows.sort((a,b)=> (
            (Number(b.display.toLocaleUpperCase().startsWith(searchState.searchCriteria.toLocaleUpperCase())) -
            Number(a.display.toLocaleUpperCase().startsWith(searchState.searchCriteria.toLocaleUpperCase()))) ||
            a.display.toLocaleUpperCase().localeCompare(b.display.toLocaleUpperCase())
           ))
        let toOpen = newFilteredRows.length > 0 && (searchState.isFocused || searchState.searchCriteria.length > 0)
        setSearchState(prevState=>({...prevState,filteredRows: newFilteredRows, isOpen: toOpen}))   
    },[searchRows,searchState.searchCriteria,searchState.isFocused])

    function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
        if (event.key === "Enter") {
          addItemWithoutRow(searchState.searchCriteria)
          enterKeyValueRef.current= searchState.searchCriteria.length > 1 ? searchState.searchCriteria.slice(0,-1) : "";
        }
    }
    
    function updateSearchCriteria(event: CustomEvent) {
        if (event.detail.value !== enterKeyValueRef.current) {
            setSearchState(prevState => ({...prevState, searchCriteria: event.detail.value}));
            enterKeyValueRef.current="";
        } else {
            resetSearch();
        }
    }
    
    function enterSearchBox() {
        let toOpen = searchState.filteredRows.length !== 0;
        setSearchState(prevState => ({...prevState, isFocused: true,isOpen: toOpen}));
    }

    function leaveSearchBox() {
        setSearchState(prevState => ({...prevState, isOpen: false, isFocused: false}));
    }

    return (
        <IonItem key="searchbar" className="generic-search-item">
        <IonPopover side="bottom" trigger={componentID} isOpen={searchState.isOpen} keyboardClose={false} dismissOnSelect={true}  onDidDismiss={(e) => {leaveSearchBox()}}>
            <IonContent>
                <IonList key="popoverItemList">
                 {searchState.filteredRows.map((sr) => (
                  <IonItem button key={sr.id} onClick={(e) => {rowSelected(sr.id,sr.data)}}>{sr.display}</IonItem>
                 ))}
                </IonList>
            </IonContent>
        </IonPopover>
        <IonSearchbar id={componentID} aria-label="" className="ion-no-padding generic-input-search generic-input-search-class"
                    debounce={5} value={searchState.searchCriteria} inputmode="search" enterkeyhint="enter" ref={localSearchRef}
                    onIonInput={(e: any) => {updateSearchCriteria(e)}}
//                    onInput={(e: any) => {console.log("oninput",e.nativeEvent.data)}}
//                    onIonChange={(e:any) => {console.log("onionchange",e)}}
                    onKeyDown={(e:any) => {searchKeyPress(e)}}
                    onClick={() => enterSearchBox()}>
         </IonSearchbar>           
     </IonItem>


    )
}

export default forwardRef(GenericSearchBar);