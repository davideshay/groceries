export const couchdbUrl = (process.env.COUCHDB_URL == undefined) ? "" : process.env.COUCHDB_URL.endsWith("/") ? process.env.COUCHDB_URL.slice(0,-1): process.env.COUCHDB_URL;
export const couchdbInternalUrl = (process.env.COUCHDB_INTERNAL_URL == undefined) ? couchdbUrl : process.env.COUCHDB_INTERAL_URL?.endsWith("/") ? process.env.COUCHDB_INTERNAL_URL.slice(0,-1): process.env.COUCHDB_INTERNAL_URL;
export const couchDatabase = (process.env.COUCHDB_DATABASE == undefined) ? "" : process.env.COUCHDB_DATABASE;
export const couchKey = process.env.COUCHDB_HMAC_KEY;
export const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
export const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
export const refreshTokenExpires = (process.env.REFRESH_TOKEN_EXPIRES == undefined) ? "30d" : process.env.REFRESH_TOKEN_EXPIRES;
export const accessTokenExpires = (process.env.ACCESS_TOKEN_EXPIRES == undefined) ? "1d" : process.env.ACCESS_TOKEN_EXPIRES;
export const enableScheduling = (process.env.ENABLE_SCHEDULING == undefined) ? true : getBooleanFromText(process.env.ENABLE_SCHEDULING);
export const resolveConflictsFrequencyMinutes = (process.env.RESOLVE_CONFLICTS_FREQUENCY_MINUTES == undefined) ? 15 : process.env.RESOLVE_CONFLICTS_FREQUENCY_MINUTES;
export const expireJWTFrequencyMinutes = (process.env.EXPIRE_JWT_FREQUENCY_MINUTES == undefined) ? 10 : process.env.EXPIRE_JWT_FREQUENCY_MINUTES;
export const groceryUrl = (process.env.GROCERY_URL == undefined) ? "" : process.env.GROCERY_URL.endsWith("/") ? process.env.GROCERY_URL.slice(0,-1): process.env.GROCERY_URL;
export const groceryAPIUrl = (process.env.GROCERY_API_URL == undefined) ? "" : process.env.GROCERY_API_URL.endsWith("/") ? process.env.GROCERY_API_URL.slice(0,-1): process.env.GROCERY_API_URL;
export const groceryAPIPort = (process.env.GROCERY_API_PORT == undefined) ? "3333" : process.env.GROCERY_API_PORT;
export const disableAccountCreation = (process.env.DISABLE_ACCOUNT_CREATION == undefined) ? false : getBooleanFromText(process.env.DISABLE_ACCOUNT_CREATION);
export const logLevel = (process.env.LOG_LEVEL == undefined) ? "INFO" : process.env.LOG_LEVEL.toUpperCase();
export const smtpHost = process.env.SMTP_HOST;
export const smtpPort = Number(process.env.SMTP_PORT);
export const smtpSecure = Boolean(process.env.SMTP_SECURE);
export const smtpUser = process.env.SMTP_USER;
export const smtpPassword = process.env.SMTP_PASSWORD;
export const smtpFrom = process.env.SMTP_FROM;

export const couchStandardRole = "crud";
export const couchAdminRole = "dbadmin";
export const couchUserPrefix = "org.couchdb.user";
export const conflictsViewID = "_conflicts_only_view_id";
export const conflictsViewName = "conflicts_view";
export const utilitiesViewID = "_utilities";

export function getBooleanFromText(val: string | boolean) {
    if (val === true) {return true}; if (val === false) {return false};
    let trueStrings=["TRUE","YES","1"];                                 
    return trueStrings.includes(String(val).toUpperCase());
}