import { t } from "i18next"
import { UomDoc } from "./DBSchema";
import log from 'loglevel';

export function translatedItemName(id: string | null, name: string,pluralName: string| undefined, count: number=1) {
    const sysItemKey="system:item";
    if (id === null || id === undefined) { return (count > 1  && pluralName !== undefined && pluralName !== "" ? pluralName : name) };
    if (id.startsWith(sysItemKey)) {
      return t("globalitem."+id.substring(sysItemKey.length+1),{count: count});
    } else {
      return name
    }
  }

export function translatedCategoryName(id: string | undefined | null, name: string) {
    const sysCatKey = "system:cat";
    if (id === undefined || id === null) { return name}
    if (id.startsWith(sysCatKey)) {
        return t("category."+id.substring(sysCatKey.length+1));
    } else {
        return name;
    }
}

export function translatedUOMName(id: string, name: string, pluralName: string, count: number = 1) {
    const sysUOMKey = "system:uom";
    if (id.startsWith(sysUOMKey)) {
        return t("uom."+id.substring(sysUOMKey.length+1),{count: count});
    } else {
        return (count > 1 ? pluralName : name);
    }
}

export function translatedUOMShortName(shortName: string | null,uomDocs: UomDoc[], count: number = 1) : string {
    if (shortName === null) {return ""};
    const foundUOM = uomDocs.find(uom => (uom.name === shortName));
    if (foundUOM === undefined) {log.error("no found UOM...",shortName); return "";}
    return(translatedUOMName(foundUOM._id!,foundUOM.description, foundUOM.pluralDescription, count))
}
