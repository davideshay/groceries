export function isJsonString(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export const DEFAULT_DB_URL_PREFIX="https://couchdb.shaytech.net"
export const DEFAULT_DB_NAME="todos"