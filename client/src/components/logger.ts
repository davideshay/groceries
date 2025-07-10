// logger.js
import log, { LogLevelNumbers } from 'loglevel';
import { Capacitor } from '@capacitor/core';
// import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding, PermissionStatus } from '@capacitor/filesystem';

const LOG_LEVEL: string = (window as any)._env_.LOG_LEVEL === undefined ? "INFO" : (window as any)._env_.LOG_LEVEL;
const AndroidLogFileName = "groceries-log.txt";
export let androidLogPermissionsError = false;


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

async function openAndroidLogFile() {
    let checkPerms = await Filesystem.checkPermissions();
    let reqPerms: PermissionStatus;
    let proceed =false;
    if (checkPerms.publicStorage === "prompt" || checkPerms.publicStorage === "prompt-with-rationale") {
        reqPerms = await Filesystem.requestPermissions();
        if (reqPerms.publicStorage === "granted") {
            proceed = true;
        }
    } else {
        proceed = true;
    }
    if (!proceed) {
        console.log("No permissions given to create log file");
        return;
    }

    await Filesystem.writeFile({
        path: AndroidLogFileName,
        data: "Android Log File starting: " + ((new Date().toLocaleDateString()) + " " + (new Date().toLocaleTimeString())),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
    })
}

async function startLogging() {
if (Capacitor.getPlatform() === "android") {    
    await openAndroidLogFile();
    var originalFactory = log.methodFactory;
    log.methodFactory = function (methodName, logLevel, loggerName) {
        let rawMethod = originalFactory(methodName, logLevel, loggerName);

        return function () {
            let messages = [];
            for (var i = 0; i < arguments.length; i++) {
                messages.push(arguments[i]);
            }
            Filesystem.appendFile({
                path: AndroidLogFileName,
                data: messages.join(","),
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            })
            rawMethod.apply(undefined, messages);
        };
    };
}
log.setLevel(getLoggingLevel(LOG_LEVEL));
}

startLogging();

console.log("logging level set to: ",LOG_LEVEL);

export default log;
