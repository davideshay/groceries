export const maxAppSupportedSchemaVersion = 3;
export const appVersion = "0.3.0";

export interface UUIDDoc {
  _id?: string,
  _rev?: string,
  type: string,
  name: string,
  uuid: string,
  updatedAt: string,
  uomContentVersion: number,
  schemaVersion: number,
  categoriesVersion: number,
  globalItemVersion: number
}

export interface CategoryDoc {
    _id?: string,
    _rev?: string,
    type: string,
    name: string,
    color: string,
    updatedAt: string
  }
  
export const InitCategoryDoc: CategoryDoc = {
   type: "category", name: "", color: "", updatedAt: ""
  }
  
export type CategoryDocs = CategoryDoc[];

export interface ConflictDoc {
  _id?: string,
  _rev?: string,
  type: string,
  docType: string,
  winner: any,
  losers: any,
  updatedAt: string
}

export type ConflictDocs = ConflictDoc[];
  
export interface UomDoc {
    _id?: string,
    _rev?: string,
    type: string,
    name: string,
    description: string,
    pluralDescription: string,
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
  
export interface ItemDoc {
    _id?: string,
    _rev?: string,
    type: string,
    listGroupID: string,
    name: string,
    globalItemID: string | null,
    lists: ItemList[],
    updatedAt?: string
  }
  
export type ItemDocs = ItemDoc[];
  
  export const ItemDocInit:ItemDoc = {
    type: "item",
    listGroupID: "",
    name: "",
    globalItemID: null,
    lists: [],
    updatedAt: ""
  }


export interface GlobalItemDoc {
  _id?: string,
  _rev?: string,
  type: string,
  name: string,
  defaultUOM: string | null,
  defaultCategoryID: string | null
}

export type GlobalItemDocs = GlobalItemDoc[];

export const InitGlobalItem:GlobalItemDoc = {
  type: "globalitem",
  name: "",
  defaultCategoryID: null,
  defaultUOM: null
}

export interface ListDoc {
  _id?: string,
  _rev?: string,
  type: string,
  name: string,
  listGroupID: string | null,
  categories: string[],
  updatedAt: string
}

export type ListDocs = ListDoc[];

export const ListDocInit:ListDoc = {
  type: "list",
  name: "",
  listGroupID: "",
  categories: [],
  updatedAt: ""  
}

export interface ListGroupDoc {
  _id?: string,
  _rev?: string,
  type: string,
  name: string,
  default: boolean,
  listGroupOwner: string,
  sharedWith: string[];
  updatedAt: string
}

export type ListGroupDocs = ListGroupDoc[];

export const ListGroupDocInit:ListGroupDoc = {
  type: "listgroup",
  name: "",
  default: false,
  listGroupOwner: "",
  sharedWith: [],
  updatedAt: ""
}

export enum FriendStatus {
    PendingFrom1 = "PENDFROM1",
    PendingFrom2 = "PENDFROM2",
    WaitingToRegister = "WAITREGISTER",
    RegisteredNotConfirmed = "REFNOTCONF", // do we need this, or reverts to pendfrom1 I think!
    Confirmed = "CONFIRMED",
    Deleted = "DELETED"
  }

export type UserDoc = {
  _id?: string,
  _rev?: string,
  name: string,
  email: string,
  fullname: string,
  roles: string[],
  type: string,
  password_scheme: string,
  password? : string,
  iterations: Number,
  derived_key: string,
  salt: string,
  refreshJWTs: {}
}

export type FriendDoc = {
    _id?: string,
    _rev?: string,
    type: string,
    friendID1: string,
    friendID2: string,
    inviteEmail: string,
    inviteUUID: string,
    friendStatus: string,
    updatedAt: string
  }

export type FriendDocs = FriendDoc[];

export const InitFriendDoc : FriendDoc = {
    type: "friend", friendID1: "", friendID2: "",
    inviteEmail: "", inviteUUID: "", friendStatus: FriendStatus.Deleted, updatedAt: ""
  }
