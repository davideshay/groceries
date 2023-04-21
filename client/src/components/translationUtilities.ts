import { t } from "i18next"
import { GlobalDataState } from "./GlobalDataProvider";

export function translatedItemName(id: string | null, name: string) {
    const sysItemKey="system:item";
    if (id === null) { return name };
    if (id.startsWith(sysItemKey)) {
      return t("globalitem."+id.substring(sysItemKey.length+1));
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

export function translatedUOMName(id: string, name: string, count: number = 1) {
    const sysUOMKey = "system:uom";
    if (id.startsWith(sysUOMKey)) {
        return t("uom."+id.substring(sysUOMKey.length+1),{count: count});
    } else {
        return name;
    }
}

export function translatedUOMShortName(shortName: string,globalData: GlobalDataState) : string {
    const foundUOM = globalData.uomDocs.find(uom => (uom.name === shortName));
    if (foundUOM === undefined) {console.log("no found UOM..."); return "";}
    return(translatedUOMName(foundUOM._id!,foundUOM.description))
}
