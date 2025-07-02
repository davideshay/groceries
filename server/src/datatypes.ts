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

export type NewUserReponse = {
    invalidData: boolean,
    userAlreadyExists: boolean,
    createdSuccessfully: boolean,
    creationDisabled: boolean,
    idCreated: string,
    refreshJWT: string,
    accessJWT: string,
    couchdbUrl: string,
    couchdbDatabase: string,
    email: string,
    fullname: string    
}

export type GetUsersInfoRequestBody = {
    userIDs: string[]
}

export type GetUsersInfoResponse = {
    error: boolean,
    users: { name: string, email: string, fullname: string} []
}

export type UpdateUserInfoResponse = {
    success: boolean
}

export type UserInfo = {
    name: string, email: string, fullname: string
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

export interface CreateAccountParams {
    uuid?: string
}

export type CreateAccountResponse = {
    uuid: string,
    email: string,
    fullname: string,
    username: string,
    password: string,
    passwordverify: string,
    refreshjwt: string,
    formError: string,
    disableSubmit: boolean,
    createdSuccessfully: boolean
}

export type TriggerRegEmailBody = {
    uuid: string
}

export type ResetPasswordBody = {
    username: string
}

export type ResetPasswordResponse = {
    emailSent: boolean,
    error: string
}

export type ResetPasswordFormResponse = {
    email: string,
    username: string,
    uuid: string,
    password: string,
    passwordverify: string,
    formError: string,
    disableSubmit: boolean,
    resetSuccessfully: boolean
}

export type ResetPasswordParams = {
    uuid: string
}

export type TriggerResponse = {
    triggered: boolean
}

export type IsAvailableResponse = {
    apiServerAvailable: boolean,
    dbServerAvailable : boolean,
    apiServerAppVersion: string
}