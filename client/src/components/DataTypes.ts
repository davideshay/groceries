import { History } from "history";
import { FriendDoc, InitFriendDoc, ListDoc, ItemList, ItemListInit } from "./DBSchema";

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

export type ItemRows = ItemRow[];

export const initItemRow: ItemRow = {
    itemID: "", itemName: "",categoryID: "", categoryName: "",
    categorySeq: 0, categoryColor: "#ffffff", quantity: 0,
    uomDesc: "", quantityUOMDesc: "", completed: false
  }

export enum ItemSearchType {
  Local= "L",
  Global="G"
}

  export interface ItemSearch {
    itemID: string,
    itemName: string,
    itemType: ItemSearchType,
    globalItemID: string | null,
    globalItemCategoryID: string | null,
    globalItemUOM: string | null,
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
    groupIDforSelectedList: null | string,
    doingUpdate: boolean,
    itemRows: Array<ItemRow>,
    ignoreCheckOffWarning: boolean,
    showAlert: boolean,
    alertHeader: string,
    alertMessage: string
  }


  export enum ResolvedFriendStatus {
    PendingConfirmation = "PENDING",
    Requested = "REQUESTED",
    WaitingToRegister= "WAITREGISTER",
    Confirmed = "CONFIRMED",
    Deleted = "DELETED"
  }


  export type FriendRow = {
    friendDoc: FriendDoc,
    targetUserName: string,
    targetEmail: string,
    targetFullName: string,
    resolvedStatus: ResolvedFriendStatus
    friendStatusText: string,
  }

  export const InitFriendRow: FriendRow = {
    friendDoc: InitFriendDoc,
    targetUserName: "", targetEmail: "", targetFullName: "", 
    resolvedStatus: ResolvedFriendStatus.Deleted, friendStatusText: ""
  }

  export type ListRow = {
    listGroupID: string | null,
    listGroupName: string,
    listGroupDefault: boolean,
    listGroupOwner: string | null,
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
    listGroupOwner: string | null,
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

  export type HistoryProps =  { history: History }

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
