import { History } from "history";
import { FriendDoc, InitFriendDoc, ListDoc, ItemList, ItemListInit, DefaultColor } from "./DBSchema";

export interface ItemRow {
    itemID: string,
    globalItemID: string | null,
    itemName: string,
    categoryID: string | null,
    categoryName: string,
    categorySeq: number | undefined,
    categoryColor: string,
    quantity: number,
    uomDesc: string,
    quantityUOMDesc: string,
    hasNote: boolean,
    completed: boolean | null
  }

export type ItemRows = ItemRow[];

export const initItemRow: ItemRow = {
    itemID: "", globalItemID: null, itemName: "",categoryID: null, categoryName: "",
    categorySeq: 0, categoryColor: DefaultColor, quantity: 0,
    uomDesc: "", quantityUOMDesc: "", hasNote: false, completed: false
  }

export interface CategoryRow {
  id: string | null,
  name: string,
  seq: number | undefined,
  color : string,
  completed: boolean,
  collapsed: boolean
}

export type CategoryRows = CategoryRow[];

export const initCategoryRow: CategoryRow = {
  id: null, name: "", seq: 0, color: DefaultColor, completed: false, collapsed: false
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
    filteredSearchRows: Array<ItemSearch>,
    dismissEvent: CustomEvent | undefined
  }

  export const SearchStateInit: SearchState  = {
    searchCriteria: "",
    isOpen: false,
    isFocused: false,
    filteredSearchRows: [],
    dismissEvent: undefined
  }

  export interface PageState {
    selectedListOrGroupID: string | null,
    selectedListType: RowType,
    groupIDforSelectedList: null | string,
    itemRows: Array<ItemRow>,
    categoryRows: Array<CategoryRow>,
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
    listGroupRecipe: boolean,
    listGroupAlexaDefault: boolean,
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
    listGroupRecipe: boolean,
    listGroupOwner: string | null,
    hidden: boolean
    listDoc: ListDoc
  }

  export type ListCombinedRows = ListCombinedRow[];

  export interface ListSelectRow extends ListCombinedRow {
    hasUncheckedItems: boolean
  }

  export type ListSelectRows = ListSelectRow[];

  export type PouchResponse = {
    pouchData: {ok?: boolean, id?: string, rev?: string},
    successful: boolean,
    errorCode: number,
    errorText: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export type RecipeFileType = {
  type: string,
  name: string,
  fileType: string
}

export const RecipeFileTypes : RecipeFileType[]= [
  {type: "tandoor", name: "Tandoor", fileType: "application/zip"},
//  {type: "json_ld", name: "JSON-LD", fileType: "application/json"}
];

export type TandoorIngredient = {
  always_use_plural_food: boolean,
  always_use_plural_unit: boolean,
  amount: number,
  is_header: boolean,
  no_amount: boolean,
  note: string,
  order: number,
  unit: null | {
    description: null | string,
    name: string | null,
    plural_name: string | null
  },
  food: {
    ignore_shopping: boolean,
    name: string | null,
    plural_name: string | null,
    supermarket_category: string | null
  }
}

export type TandoorRecipeStep = {
  name: string,
  instruction: string,
  order: number,
  show_as_header: boolean,
  time: number,
  ingredients: TandoorIngredient[]
}

export type TandoorRecipe = {
  name: string,
  description: string,
  internal: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nutrition: any,
  servings: number,
  servings_text: string,
  waiting_time: number,
  working_time: number,
  keywords: string[],
  steps: TandoorRecipeStep[]

}
