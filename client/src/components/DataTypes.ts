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
    itemID: string,
    itemName: string,
    quantity: number,
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

  export interface DBCreds {
    apiServerURL: string | undefined,
    couchBaseURL: string | undefined,
    database: string | undefined,
    dbUsername: string | undefined,
    email: string | undefined,
    fullName: string | undefined,
    JWT: string | undefined
  }

  export enum FriendStatus {
    PendingFrom1 = "PENDFROM1",
    PendingFrom2 = "PENDFROM2",
    WaitingToRegister = "WAITREGISTER",
    RegisteredNotConfirmed = "REFNOTCONF",
    Confirmed = "CONFIRMED",
    Deleted = "DELETED"
  }

  export type FriendRow = {
    friendRelID: string,
    friendID1: string,
    friendID2: string,
    targetUserName: string,
    targetEmail: string,
    targetFullName: string,
    friendStatusCode: string,
    friendStatusText: string,
  }
