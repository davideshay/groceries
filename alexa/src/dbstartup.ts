export const couchdbUrl = (process.env.COUCHDB_URL == undefined) ? "" : process.env.COUCHDB_URL.endsWith("/") ? process.env.COUCHDB_URL.slice(0,-1): process.env.COUCHDB_URL;
export const couchdbInternalUrl = (process.env.COUCHDB_INTERNAL_URL == undefined) ? couchdbUrl : process.env.COUCHDB_INTERAL_URL?.endsWith("/") ? process.env.COUCHDB_INTERNAL_URL.slice(0,-1): process.env.COUCHDB_INTERNAL_URL;
export const couchDatabase = (process.env.COUCHDB_DATABASE == undefined) ? "" : process.env.COUCHDB_DATABASE;
export const couchKey = process.env.COUCHDB_HMAC_KEY;
export const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
export const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
export const couchUserPrefix = "org.couchdb.user";
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
 

export function dbStartup() {
    console.log("STATUS: Starting up Alexa server");
    console.log("STATUS: App Version: ",appVersion);
    console.log("STATUS: Database Schema Version:",maxAppSupportedSchemaVersion);
    if (couchdbUrl == "") {console.log("ERROR: No environment variable for CouchDB URL"); return false;}
    if (couchdbInternalUrl == "") {console.log("ERROR: No environment variable for internal CouchDB URL"); return false;}
    console.log("STATUS: Database URL: ",couchdbUrl);
    console.log("STATUS: Internal Database URL: ",couchdbInternalUrl);
    if (couchDatabase == "") { console.log("ERROR: No CouchDatabase environment variable."); return false;}
    console.log("STATUS: Using database: ",couchDatabase);
    try {todosDBAsAdmin = todosNanoAsAdmin.use(couchDatabase);}
    catch(err) {console.log("ERROR: Could not open todo database:",err); return false;}
    try {usersDBAsAdmin = usersNanoAsAdmin.use("_users");}
    catch(err) {console.log("ERROR: Could not open users database:", err); return false;}
    console.log("STATUS: Serving Alexa Responses now...");
    }

