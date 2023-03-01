export interface IToDoList {
    type: string;
    name: string;
    sharedWith: Array<string>;
}

export interface ItemRow {
    itemID: string,
    itemName: string,
    categoryID: string | null,
    categoryName: string,
    categorySeq: number,
    categoryColor: string,
    quantity: number,
    uomDesc: string,
    quantityUOMDesc: string,
    completed: boolean | null
  }

export const initItemRow: ItemRow = {
    itemID: "", itemName: "",categoryID: "", categoryName: "",
    categorySeq: 0, categoryColor: "#ffffff", quantity: 0,
    uomDesc: "", quantityUOMDesc: "", completed: false
  }


export interface ItemList {
  listID: string,
  active: boolean,
  completed: boolean,
  stockedAt: boolean,
  boughtCount: number,
  note: string,
  quantity: number,
  categoryID: string,
  uomName: string
}

export interface ItemDoc {
  _id: string,
  _rev: string,
  type: string,
  listGroupID: string,
  name: string,
  uomName: string,
  lists: ItemList[],
  updatedAt: string
}

export type ItemDocs = ItemDoc[];

export const ItemDocInit:ItemDoc = {
  _id: "",
  _rev: "",
  type: "",
  listGroupID: "",
  name: "",
  uomName: "",
  lists: [],
  updatedAt: ""
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
    isFocused: boolean,
    event: Event | undefined,
    filteredSearchRows: Array<ItemSearch>,
    dismissEvent: CustomEvent | undefined
  }

  export interface PageState {
    selectedListOrGroupID: string,
    doingUpdate: boolean,
    itemRows: Array<ItemRow>,
    showAlert: boolean,
    alertHeader: string,
    alertMessage: string
  }

  export enum FriendStatus {
    PendingFrom1 = "PENDFROM1",
    PendingFrom2 = "PENDFROM2",
    WaitingToRegister = "WAITREGISTER",
    RegisteredNotConfirmed = "REFNOTCONF", // do we need this, or reverts to pendfrom1 I think!
    Confirmed = "CONFIRMED",
    Deleted = "DELETED"
  }

  export enum ResolvedFriendStatus {
    PendingConfirmation = "PENDING",
    Requested = "REQUESTED",
    WaitingToRegister= "WAITREGISTER",
    Confirmed = "CONFIRMED",
    Deleted = "DELETED"
  }

  export type FriendRow = {
    friendDoc: any,
    targetUserName: string,
    targetEmail: string,
    targetFullName: string,
    resolvedStatus: ResolvedFriendStatus
    friendStatusText: string,
  }

  export type ListRow = {
    listGroupID: string | null,
    listGroupName: string,
    listGroupLists: string[],
    listDoc: any,
    participants: string[]
  }

  export enum RowType {
    listGroup = "G",
    list = "L"
  }

  export type ListCombinedRow = {
    rowType: RowType,
    rowName: string,
    rowKey: string,
    listOrGroupID: string,
    listGroupID: string | null,
    listGroupName: string,
    listGroupLists: string[],
    listDoc: any
  }


  export type PouchResponse = {
    pouchData: any,
    successful: boolean,
    errorCode: number,
    errorText: string,
    fullError: any
  }

  export const PouchResponseInit:PouchResponse = {
    pouchData: {},
    successful: true,
    errorCode: 0,
    errorText: "",
    fullError: undefined
  }

  export type UserIDList = {
    userIDs: string[]
  }

  export const initUserIDList:UserIDList = { userIDs: []};

  export type UserInfo = {
    name: string, email: string, fullname: string
  }

  export type UsersInfo = UserInfo[];

  export const initUserInfo: UserInfo = {
    name: "", email: "", fullname: ""
  }

  export const initUsersInfo: UserInfo[] = [];

  export type HistoryProps =  { history: any }