export interface IToDoList {
    type: string;
    name: string;
    sharedWith: Array<string>;
}

export interface ItemRow {
    itemID: string,
    itemName: string,
    categoryID: string,
    categoryName: string,
    categorySeq: number,
    quantity: number,
    completed: boolean | null
  }

  export interface ItemSearch {
    itemID: string
    itemName: string
    quantity: number
    boughtCount: number
  }

  export interface SearchState {
    searchCriteria: string,
    isOpen: boolean,
    event: Event | undefined,
    filteredSearchRows: Array<ItemSearch>,
    dismissEvent: CustomEvent | undefined
  }

  export interface PageState {
    selectedListID: string,
    doingUpdate: boolean,
    itemRows: Array<ItemRow>,
  }
