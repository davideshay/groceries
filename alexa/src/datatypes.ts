import { ServerConfig } from "nano"
import { GlobalSettings, InitSettings } from "./DBSchema"

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

export type SettingsResponse = {
    success: boolean,
    settings: GlobalSettings
}

export const SettingsResponseInit = {
    success: false,
    settings: InitSettings
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

export type SimpleItem = {
    _id: string,
    name: string,
    pluralName?: string
}

export type SimpleItems = SimpleItem[];