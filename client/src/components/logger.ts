// logger.js
import log, { LogLevelNumbers } from 'loglevel';
export const LOG_LEVEL: string = (window as any)._env_.LOG_LEVEL === undefined ? "INFO" : (window as any)._env_.LOG_LEVEL;

function getLoggingLevel(level: string) : LogLevelNumbers {
    let uLevel=level.toUpperCase();
    let retLevel: number = 3;
    if (["0","TRACE","T"].includes(uLevel)) {
        retLevel = 0 
    } else if (["1","DEBUG","D"].includes(uLevel)) {
        retLevel = 1
    } else if (["2","INFO","INFORMATION","I"].includes(uLevel)) {
        retLevel = 2
    } else if (["3","WARN","WARNING","W"].includes(uLevel)) {
        retLevel = 3
    } else if (["4","ERROR","E"].includes(uLevel)) {
        retLevel = 4
    } else if (["5","SILENT","S","NONE","N"].includes(uLevel)) {
        retLevel = 5
    } else {retLevel = 2}
    return retLevel as LogLevelNumbers;
}

log.setLevel(getLoggingLevel(LOG_LEVEL));

export default log;