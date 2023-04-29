import { ServerConfig } from "nano"

export type SlotInfo = {
    id: string | null,
    name: string
}

export type CouchUserInfo = {
    success: boolean
    userName: string
}

export const CouchUserInit = {
    success: false,
    userName: ""
}

export type SimpleListGroup = {
    _id: string,
    name: string,
    default: boolean
}

export type SimpleListGroups = SimpleListGroup[];

export type SimpleList = {
    _id: string,
    name: string,
    listGroupID: string | null
}

export type SimpleLists = SimpleList[];