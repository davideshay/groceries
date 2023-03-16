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
    categorySeq: number | undefined,
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
  categoryID: string | null ,
  uomName: string | null
}

export interface ItemDoc {
  _id?: string,
  _rev?: string,
  type: string,
  listGroupID: string,
  name: string,
  lists: ItemList[],
  updatedAt?: string
}

export type ItemDocs = ItemDoc[];

export const ItemDocInit:ItemDoc = {
  type: "item",
  listGroupID: "",
  name: "",
  lists: [],
  updatedAt: ""
}

export const ItemListInit:ItemList = {
  listID: "",
  active: true,
  completed: false,
  stockedAt: true,
  boughtCount: 0,
  note: "",
  quantity: 0,
  categoryID: null,
  uomName: null
}


export interface ListDoc {
  _id: string,
  _rev: string,
  type: string,
  name: string,
  listGroupID: string,
  listOwner: string,
  categories: string[],
  updatedAt: string
}

export type ListDocs = ListDoc[];

export const ListDocInit:ListDoc = {
  _id: "",
  _rev: "",
  type: "list",
  name: "",
  listGroupID: "",
  listOwner: "",
  categories: [],
  updatedAt: ""  
}

export interface ListGroupDoc {
  _id: string,
  _rev: string,
  type: string,
  name: string,
  default: boolean,
  listGroupOwner: string,
  sharedWith: string[];
  updatedAt: string
}

export type ListGroupDocs = ListGroupDoc[];

export const ListGroupDocInit:ListGroupDoc = {
  _id: "",
  _rev: "",
  type: "listgroup",
  name: "",
  default: false,
  listGroupOwner: "",
  sharedWith: [],
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
    selectedListType: RowType,
    groupIDforSelectedList: string,
    doingUpdate: boolean,
    itemRows: Array<ItemRow>,
    ignoreCheckOffWarning: boolean,
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
    listGroupDefault: boolean,
    listDoc: ListDoc,
  }

  export enum RowType {
    listGroup = "G",
    list = "L"
  }

  export type ListCombinedRow = {
    rowType: RowType,
    rowName: string,
    rowKey: string,
    listOrGroupID: string | null,
    listGroupID: string | null,
    listGroupName: string,
    listGroupDefault: boolean,
    listDoc: ListDoc 
  }

  export type ListCombinedRows = ListCombinedRow[];

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

  export type ModalState = {
    selectedListId: string,
    selectedListIdx: number,
    selectedListName: string,
    isOpen: boolean,
    itemList: ItemList
}

export const ModalStateInit : ModalState = {
    selectedListId: "",
    selectedListIdx: 0,
    selectedListName: "",
    isOpen: false,
    itemList: ItemListInit
  }
