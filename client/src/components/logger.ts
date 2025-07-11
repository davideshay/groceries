// logger.js
import log, { LogLevelNumbers } from 'loglevel';
import { Capacitor } from '@capacitor/core';
// import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding, PermissionStatus } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { LogLevelNumber } from './DBSchema';

const LOG_LEVEL: string = (window as any)._env_.LOG_LEVEL === undefined ? "INFO" : (window as any)._env_.LOG_LEVEL;
const AndroidLogFileName = "groceries-log.txt";
const PrefsLoggingKey = "logging";
export let androidLogPermissionsError = false;

type PrefsLoggingSettings = {
    logLevel: LogLevelNumber,
    logToFile: boolean
}

const initPrefsLoggingSettings = {
    logLevel: LogLevelNumber.TRACE,
    logToFile: false
}

export let prefsLoggingSettings: PrefsLoggingSettings = structuredClone(initPrefsLoggingSettings);

const originalFactory = log.methodFactory;

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
        androidLogPermissionsError = true;
        return;
    }
    await Filesystem.writeFile({
        path: AndroidLogFileName,
        data: ("Android Log File starting: " + ((new Date().toLocaleDateString()) + " " + (new Date().toLocaleTimeString())) + "\n" ),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
    })
}


export async function getLoggingSettings() {
    const {value} = await Preferences.get({key: PrefsLoggingKey});
    if (value !== null) {
        try {
            prefsLoggingSettings = JSON.parse(value);
        } catch(error) {
            console.error("Could not parse logging settings");
        }
    }
}

export async function setLoggingSettings() {
    await Preferences.set({key: PrefsLoggingKey, value: JSON.stringify(prefsLoggingSettings)})
}

export async function setPrefsLoggingLevel(logLevel: LogLevelNumber) {
    prefsLoggingSettings.logLevel = logLevel;
    await setLoggingSettings();
}

export async function enableFileLogging() {
    if (Capacitor.getPlatform() === "android") {
        prefsLoggingSettings.logToFile = true;
        setLoggingSettings();
        setToFileLoggingFactory();
    }
}

export async function disableFileLogging() {
    if (Capacitor.getPlatform() === "android") {
        prefsLoggingSettings.logToFile = false;
        setLoggingSettings();
        setToOriginalLoggingFactory();
    }
}

export async function clearLogFile() {
    await openAndroidLogFile();
}

function formatLogMessage(methodName: string, messages: any[]): string {
    const timestamp = new Date().toISOString();
    const level = methodName.toUpperCase();
    const formattedMessages = messages.map(msg => {
        if (typeof msg === 'string') {
            return msg;
        } else if (typeof msg === 'number' || typeof msg === 'boolean') {
            return String(msg);
        } else if (msg === null) {
            return 'null';
        } else if (msg === undefined) {
            return 'undefined';
        } else if (msg instanceof Error) {
            return `Error: ${msg.message}\n${msg.stack}`;
        } else if (Array.isArray(msg)) {
            try {
                return JSON.stringify(msg, null, 2);
            } catch (e) {
                return `[Array: ${msg.length} items]`;
            }
        } else if (typeof msg === 'object') {
            try {
                return JSON.stringify(msg, null, 2);
            } catch (e) {
                // Handle circular references or non-serializable objects
                return `[Object: ${Object.prototype.toString.call(msg)}]`;
            }
        } else {
            return String(msg);
        }
    });
    return `[${timestamp}] ${level}: ${formattedMessages.join(' ')}`;
}

function setToFileLoggingFactory() {
    log.methodFactory = function (methodName, logLevel, loggerName) {
        let rawMethod = originalFactory(methodName, logLevel, loggerName);

        return function () {
            let messages = [];
            for (var i = 0; i < arguments.length; i++) {
                messages.push(arguments[i]);
            }
            // Format messages for file output
            const formattedMessage = formatLogMessage(methodName, messages);
            Filesystem.appendFile({
                path: AndroidLogFileName,
                data: formattedMessage + '\n',
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            }).catch(err => {
                // Handle file write errors gracefully
                console.error('Failed to write to log file:', err);
            });                
            // Call original method with original arguments
            rawMethod.apply(undefined, messages);
        };
    };
}

function setToOriginalLoggingFactory() {
    log.methodFactory = originalFactory;
    log.rebuild();
    log.setLevel(prefsLoggingSettings.logLevel);
}

async function startLogging() {
    if (Capacitor.getPlatform() === "android") {
        await getLoggingSettings();
        if (prefsLoggingSettings.logToFile) {
            await openAndroidLogFile();
            setToFileLoggingFactory();
        }
    }
    log.setLevel(getLoggingLevel(LOG_LEVEL));
}

startLogging();

console.log("logging level set to: ",LOG_LEVEL);

export default log;
