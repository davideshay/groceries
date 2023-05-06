export const couchdbUrl = (process.env.COUCHDB_URL == undefined) ? "" : process.env.COUCHDB_URL.endsWith("/") ? process.env.COUCHDB_URL.slice(0,-1): process.env.COUCHDB_URL;
export const couchdbInternalUrl = (process.env.COUCHDB_INTERNAL_URL == undefined) ? couchdbUrl : process.env.COUCHDB_INTERAL_URL?.endsWith("/") ? process.env.COUCHDB_INTERNAL_URL.slice(0,-1): process.env.COUCHDB_INTERNAL_URL;
export const couchDatabase = (process.env.COUCHDB_DATABASE == undefined) ? "" : process.env.COUCHDB_DATABASE;
export const couchKey = process.env.COUCHDB_HMAC_KEY;
export const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
export const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
export const couchUserPrefix = "org.couchdb.user";
export const logLevel = (process.env.LOG_LEVEL == undefined) ? "INFO" : process.env.LOG_LEVEL.toUpperCase();
import nanoAdmin, { DocumentListResponse,  MangoResponse, DocumentScope,
    MangoQuery, MaybeDocument } from 'nano';
const nanoAdminOpts = {
    url: couchdbInternalUrl,
    requestDefaults: {
        headers: { Authorization: "Basic "+ Buffer.from(couchAdminUser+":"+couchAdminPassword).toString('base64') }
    }
}
export let todosNanoAsAdmin = nanoAdmin(nanoAdminOpts);
export let usersNanoAsAdmin = nanoAdmin(nanoAdminOpts);
export let todosDBAsAdmin: DocumentScope<unknown>;
export let usersDBAsAdmin: DocumentScope<unknown>;

import { appVersion, maxAppSupportedSchemaVersion} from './DBSchema'
import log, { LogLevelDesc } from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
 
function convertLogLevel(level: string) : LogLevelDesc {
    let uLevel=level.toUpperCase();
    if (["0","TRACE","T"].includes(level)) {
        return "TRACE" 
    } else if (["1","DEBUG","D"].includes(level)) {
        return "DEBUG"
    } else if (["2","INFO","INFORMATION","I"].includes(level)) {
        return "INFO"
    } else if (["3","WARN","WARNING","W"].includes(level)) {
        return "WARN"
    } else if (["4","ERROR","E"].includes(level)) {
        return "ERROR"
    } else if (["5","SILENT","S","NONE","N"].includes(level)) {
        return "SILENT"
    }
    return "INFO"    
}

export function dbStartup() {
    prefix.reg(log);
    prefix.apply(log);
    log.setLevel(convertLogLevel(logLevel));
    log.info("Starting up Alexa server");
    log.info("App Version: ",appVersion);
    log.info("Database Schema Version:",maxAppSupportedSchemaVersion);
    if (couchdbUrl == "") {log.error("ENo environment variable for CouchDB URL"); return false;}
    if (couchdbInternalUrl == "") {log.error("No environment variable for internal CouchDB URL"); return false;}
    log.info("Database URL: ",couchdbUrl);
    log.info("Internal Database URL: ",couchdbInternalUrl);
    if (couchDatabase == "") { log.error("No CouchDatabase environment variable."); return false;}
    log.info("Using database: ",couchDatabase);
    try {todosDBAsAdmin = todosNanoAsAdmin.use(couchDatabase);}
    catch(err) {log.error("Could not open list database:",err); return false;}
    try {usersDBAsAdmin = usersNanoAsAdmin.use("_users");}
    catch(err) {log.error("Could not open users database:", err); return false;}
    log.info("Serving Alexa Responses now...");
    }

