import { Request } from "express"

export type UserObj = {
    username: string,
    password: string,
    email: string,
    fullname: string
}

export type NewUserReqBody = {
    username: string,
    password: string,
    email: string,
    fullname: string,
    deviceUUID: string
}

export interface IssueTokenBody {
    username: string,
    password: string,
    deviceUUID: string
}

export interface IssueTokenResponse {
    dbServerAvailable: boolean,
    loginSuccessful: boolean,
    email: string,
    fullname: string,
    loginRoles: string[],
    refreshJWT: string,
    accessJWT: string,
    couchdbUrl: string,
    couchdbDatabase: string
}

export interface RefreshTokenBody {
    refreshJWT: string,
    deviceUUID: string
}

export interface RefreshTokenResponse {
        valid : boolean,
        dbError: boolean,
        refreshJWT: string,
        accessJWT: string
}

export interface LogoutBody {
    refreshJWT: string,
    deviceUUID: string,
    username: string
}

export type CheckUserExistsReqBody = {
    username: string
}

export type CheckUserExistsResponse = {
    username: string,
    userExists: boolean
}

export type CheckUseEmailReqBody = {
    email: string
}

export interface CustomRequest<T> extends Request {
    body: T
}

export type CheckUserByEmailExistsResponse = {
    username: string,
    fullname: string,
    email: string,
    userExists: boolean
}

export enum RowType {
    listGroup = "G",
    list = "L"
  }