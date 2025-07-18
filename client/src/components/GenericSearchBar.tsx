import { IonItem,  IonPopover, IonContent, IonList, IonSearchbar } from "@ionic/react"
import { cloneDeep } from "lodash-es"
import { useEffect, useState, KeyboardEvent, forwardRef, useImperativeHandle, Ref, useId, useRef } from "react"
import "./GenericSearchBar.css"
import { Capacitor } from "@capacitor/core"

export type SearchRow = {
    id: string,
    display: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rowSelected: (id: string, data: any) => void,
    addItemWithoutRow: (name: string) => void,
}

function  GenericSearchBar({searchRows, rowSelected, addItemWithoutRow}: SearchBarProps,ref: Ref<SearchRefType>) {
    const [searchState, setSearchState] = useState<SearchState>(searchStateInit)
    const componentID = useId()
    const localSearchRef=useRef<HTMLIonSearchbarElement>(null);
    const enterKeyValueRef=useRef<string>("");

    function resetSearch() {
//        setSearchState(searchStateInit)
        setSearchState(prevState=>({...prevState,searchCriteria:"",isOpen:false,isFocused:false}))
    }

    useImperativeHandle(ref, () => ({resetSearch}));

    useEffect( () => {
        function beforeInputData(e:InputEvent) {
            if (e && e.data && e.data.includes("\n")) {
                enterKeyValueRef.current= e.data.length > 1 ? e.data.slice(0,-1) : "";
                addItemWithoutRow(searchState.searchCriteria)
            }
        }
        if (localSearchRef && localSearchRef.current && (Capacitor.getPlatform() === "android")) {
            const localRef=localSearchRef.current;
            localRef.addEventListener('beforeinput',beforeInputData,false)
            return () => {
                localRef.removeEventListener('beforeinput',beforeInputData,false)
            }
        }
    },[searchState.searchCriteria,localSearchRef,addItemWithoutRow])

    useEffect( () => {
        const newFilteredRows: SearchRow[] = cloneDeep(searchRows.filter(sr => (sr.display.toUpperCase().includes(searchState.searchCriteria.toUpperCase()))))
        newFilteredRows.sort((a,b)=> (
            (Number(b.display.toLocaleUpperCase().startsWith(searchState.searchCriteria.toLocaleUpperCase())) -
            Number(a.display.toLocaleUpperCase().startsWith(searchState.searchCriteria.toLocaleUpperCase()))) ||
            a.display.toLocaleUpperCase().localeCompare(b.display.toLocaleUpperCase())
           ))
        const toOpen = newFilteredRows.length > 0 && (searchState.isFocused || searchState.searchCriteria.length > 0)
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
        const toOpen = searchState.filteredRows.length !== 0;
        setSearchState(prevState => ({...prevState, isFocused: true,isOpen: toOpen}));
    }

    function leaveSearchBox() {
        setSearchState(prevState => ({...prevState, isOpen: false, isFocused: false}));
    }

    return (
        <IonItem key="searchbar" className="generic-search-item">
        <IonPopover side="bottom" trigger={componentID} isOpen={searchState.isOpen} keyboardClose={false} dismissOnSelect={true}  onDidDismiss={() => {leaveSearchBox()}}>
            <IonContent>
                <IonList key="popoverItemList">
                 {searchState.filteredRows.map((sr) => (
                  <IonItem button key={sr.id} onClick={() => {rowSelected(sr.id,sr.data)}}>{sr.display}</IonItem>
                 ))}
                </IonList>
            </IonContent>
        </IonPopover>
        <IonSearchbar id={componentID} aria-label="" className="ion-no-padding generic-input-search generic-input-search-class"
                    debounce={5} value={searchState.searchCriteria} inputmode="search" enterkeyhint="enter" ref={localSearchRef}
                    onIonInput={(e: CustomEvent) => {updateSearchCriteria(e)}}
//                    onInput={(e: any) => {console.log("oninput",e.nativeEvent.data)}}
//                    onIonChange={(e:any) => {console.log("onionchange",e)}}
                    onKeyDown={(e) => {searchKeyPress(e)}}
                    onClick={() => enterSearchBox()}>
         </IonSearchbar>           
     </IonItem>


    )
}

export default forwardRef(GenericSearchBar);