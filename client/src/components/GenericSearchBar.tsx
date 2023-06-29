import { IonItem,  IonPopover, IonContent, IonList, IonSearchbar } from "@ionic/react"
import { cloneDeep } from "lodash"
import { useEffect, useState, KeyboardEvent, forwardRef, useImperativeHandle, Ref, useId } from "react"
import "./GenericSearchBar.css"
import log from "loglevel"

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

function  GenericSearchBar(props: SearchBarProps,ref: Ref<SearchRefType>) {
    const [searchState, setSearchState] = useState<SearchState>(searchStateInit)
    const componentID = useId()

    function resetSearch() {
//        setSearchState(searchStateInit)
        setSearchState(prevState=>({...prevState,searchCriteria:"",isOpen:false,isFocused:false}))
    }

    useImperativeHandle(ref, () => ({resetSearch}));

    useEffect( () => {
    },[searchState.filteredRows,searchState.isFocused,searchState.isOpen,searchState.searchCriteria])

    useEffect( () => {
        let newFilteredRows: SearchRow[] = cloneDeep(props.searchRows.filter(sr => (sr.display.toUpperCase().includes(searchState.searchCriteria.toUpperCase()))))
        newFilteredRows.sort((a,b)=> (
            (Number(b.display.toLocaleUpperCase().startsWith(searchState.searchCriteria.toLocaleUpperCase())) -
            Number(a.display.toLocaleUpperCase().startsWith(searchState.searchCriteria.toLocaleUpperCase()))) ||
            a.display.toLocaleUpperCase().localeCompare(b.display.toLocaleUpperCase())
           ))
        let toOpen = newFilteredRows.length > 0 && (searchState.isFocused || searchState.searchCriteria.length > 0)
        setSearchState(prevState=>({...prevState,filteredRows: newFilteredRows, isOpen: toOpen}))   
    },[props.searchRows,searchState.searchCriteria,searchState.isFocused])

    function searchKeyPress(event: KeyboardEvent<HTMLElement>) {
        if (event.key === "Enter") {
          props.addItemWithoutRow(searchState.searchCriteria)
        }
    }
    
    function updateSearchCriteria(event: CustomEvent) {
        setSearchState(prevState => ({...prevState, searchCriteria: event.detail.value}));
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
                  <IonItem button key={sr.id} onClick={(e) => {props.rowSelected(sr.id,sr.data)}}>{sr.display}</IonItem>
                 ))}
                </IonList>
            </IonContent>
        </IonPopover>
        <IonSearchbar id={componentID} aria-label="" className="ion-no-padding generic-input-search generic-input-search-class"
                    debounce={5} value={searchState.searchCriteria} inputmode="text" enterkeyhint="enter"
                    onIonInput={(e: any) => {log.debug("ioninp",e);updateSearchCriteria(e)}}
                    onInputCapture={(e:any) => {log.debug("inpcap",e)}}
                    onInput={(e:any) => {log.debug("inp",e,e.nativeEvent, e.nativeEvent.data,e.nativeEvent.inputType)}}
//                    onIonChange={(e: any) =>{console.log("search change:",e); searchInputChange(e)}}
                    onKeyDown={(e:any) => {log.debug("keydown",e,e.nativeEvent,e.nativeEvent.code,e.nativeEvent.keyCode,e.nativeEvent.key,e.nativeEvent.charCode,e.nativeEvent.type,e.nativeEvent.returnValue); searchKeyPress(e)}}
                    onClick={() => enterSearchBox()}>
         </IonSearchbar>           
     </IonItem>


    )
}

export default forwardRef(GenericSearchBar);