import { t } from "i18next"
import { CategoryDocs, UomDoc } from "./DBSchema";

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
    console.log("TCN: ",id,name);
    const sysCatKey = "system:cat";
    if (id === undefined || id === null) { return name}
    if (id.startsWith(sysCatKey)) {
        return t("category."+id.substring(sysCatKey.length+1));
    } else {
        return name;
    }
}

export function translatedCategoryNameNoDescription(id: string | undefined | null, categoryDocs: CategoryDocs) {
    const sysCatKey = "system:cat";
    const foundCategory = categoryDocs.find((cat) => (cat._id === id));
    if (foundCategory === undefined) {return ""};
    if (id?.startsWith(sysCatKey)) {
        return t("category."+id.substring(sysCatKey.length+1));
    } else {
        return foundCategory.name;
    }
}


export function translatedUOMName(id: string, name: string) {
    const sysUOMKey = "system:uom";
    if (id.startsWith(sysUOMKey)) {
        return t("uom."+id.substring(sysUOMKey.length+1));
    } else {
        return name;
    }
    
}

export function translatedUOMShortName(shortName: string, uomDocs: UomDoc[] ) {
    const sysUOMKey = "system:uom";
    if (shortName == null || shortName == undefined) {return ""};
    const foundUOM = uomDocs.find((uom) => (uom.name.toUpperCase() === shortName.toUpperCase()));
    if (foundUOM == undefined) { return ""};
    if (foundUOM._id?.startsWith(sysUOMKey)) {
        return t("uom."+foundUOM._id.substring(sysUOMKey.length+1))
    } else {
        return foundUOM.description
    }
}