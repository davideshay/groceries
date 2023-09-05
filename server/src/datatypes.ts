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

export type CheckUserExistsReqBody = {
    username: string
}

export type CheckUseEmailReqBody = {
    email: string
}

export interface CustomRequest<T> extends Request {
    body: T
}

export type checkUserByEmailExistsResponse = {
    username: string,
    fullname: string,
    email: string,
    userExists: boolean
}

export type RefreshTokenResponse = {
    valid: boolean,
    refreshJWT: string,
    accessJWT: string
}

export enum RowType {
    listGroup = "G",
    list = "L"
  }