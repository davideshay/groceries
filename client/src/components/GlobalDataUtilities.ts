import { ListCombinedRow, ListCombinedRows, ListRow, RowType } from "./DataTypes";
import { ListDocInit, ListDocs, ListGroupDoc, ListGroupDocs } from "./DBSchema";
import { DBCreds } from "./RemoteDBState";
import { cloneDeep } from "lodash";

const systemListCombinedRow : ListCombinedRow = {
    rowType: RowType.listGroup,
    rowName: "Global",
    rowKey: "G-SYSTEM",
    listOrGroupID: "system",
    listGroupID: "system",
    listGroupName: "Global",
    listGroupRecipe: false,
    listGroupOwner: "system",
    hidden: true,
    listDoc: {
        type: "list",
        name: "Global",
        listGroupID: "system",
        categories: [],
        updatedAt: ""
    }
}

export function getListRows(listDocs: ListDocs, listGroupDocs: ListGroupDocs, remoteDBCreds: DBCreds) : {listRows: ListRow[], listCombinedRows: ListCombinedRows, recipeListGroup: string | null} {
    let curListDocs: ListDocs = cloneDeep(listDocs);
    let newListRows: ListRow[] = [];
    curListDocs.forEach((listDoc) => {
        let listGroupID=null;
        let listGroupName="";
        let listGroupRecipe=false;
        let listGroupOwner = "";
        for (let i = 0; i < listGroupDocs.length; i++) {
            const lgd = (listGroupDocs[i] as ListGroupDoc);
            if ( listDoc.listGroupID === lgd._id ) {
                listGroupID=lgd._id
                listGroupName=lgd.name
                listGroupRecipe=lgd.recipe;
                listGroupOwner=lgd.listGroupOwner;
            }
        }
        if (listGroupID === null) { return };
        let listRow: ListRow ={
            listGroupID: listGroupID,
            listGroupName: listGroupName,
            listGroupRecipe: listGroupRecipe,
            listGroupOwner: listGroupOwner,
            listDoc: listDoc,
        }
        newListRows.push(listRow);
    });

    newListRows.sort(function (a: ListRow, b: ListRow) {
    return (a.listGroupName.toLocaleUpperCase().localeCompare(b.listGroupName.toLocaleUpperCase()) ||
            a.listDoc.name.toLocaleUpperCase().localeCompare(b.listDoc.name.toLocaleUpperCase()));
    })

    const sortedListGroups: ListGroupDocs = cloneDeep(listGroupDocs).filter( 
        (lgd: ListGroupDoc) => lgd.listGroupOwner === remoteDBCreds.dbUsername ||
            lgd.sharedWith.includes(String(remoteDBCreds.dbUsername))
    );
    sortedListGroups.sort(function (a: ListGroupDoc, b: ListGroupDoc) {
        return a.name.toUpperCase().localeCompare(b.name.toUpperCase());
    });

    let newCombinedRows: ListCombinedRows = [];
    sortedListGroups.forEach((listGroup: ListGroupDoc) => {
    let groupRow: ListCombinedRow = {
        rowType : RowType.listGroup,
        rowName : listGroup.name,
        rowKey: "G-"+listGroup._id,
        listOrGroupID: String(listGroup._id),
        listGroupID : String(listGroup._id),
        listGroupName : listGroup.name,
        listGroupOwner: listGroup.listGroupOwner,
        listGroupRecipe: listGroup.recipe,
        hidden: false,
        listDoc: ListDocInit
        }
    newCombinedRows.push(groupRow);
    for (let i = 0; i < newListRows.length; i++) {
        const listRow = newListRows[i];
        if (listGroup._id === listRow.listGroupID) {
        let listListRow: ListCombinedRow = {
            rowType: RowType.list,
            rowName: listRow.listDoc.name,
            rowKey: "L-"+listRow.listDoc._id,
            listOrGroupID: String(listRow.listDoc._id),
            listGroupID: listRow.listGroupID,
            listGroupName: listRow.listGroupName,
            listGroupOwner: listRow.listGroupOwner,
            listGroupRecipe: listRow.listGroupRecipe,
            hidden: false,
            listDoc: listRow.listDoc
        }
        newCombinedRows.push(listListRow);    
        } 
    }  
    });
    // now add any ungrouped (error) lists:
    let testRow = newListRows.find(el => (el.listGroupID == null))
    if (testRow !== undefined) {
    let groupRow: ListCombinedRow = {
        rowType : RowType.listGroup, rowName : testRow.listGroupName,
        rowKey: "G-null", listOrGroupID: null, listGroupID : null,
        listGroupName : testRow.listGroupName, listGroupRecipe: false, listGroupOwner: null,
        hidden: false,
        listDoc: ListDocInit
    }
    newCombinedRows.push(groupRow);
    newListRows.forEach(newListRow => {
        if (newListRow.listGroupID === null) {
        let listlistRow: ListCombinedRow = {
            rowType: RowType.list, rowName: newListRow.listDoc.name,
            rowKey: "L-"+newListRow.listDoc._id, listOrGroupID: String(newListRow.listDoc._id),listGroupID: null,
            listGroupName: newListRow.listGroupName, listGroupOwner: null, listGroupRecipe: false,
            hidden: false,
            listDoc: newListRow.listDoc
        }
        newCombinedRows.push(listlistRow);  
        }
    })
    }
    newCombinedRows.push(systemListCombinedRow);
    let recipeLG = newCombinedRows.find(lcr => (lcr.listGroupRecipe && lcr.listGroupOwner === remoteDBCreds.dbUsername));
    return ({listRows: newListRows, listCombinedRows: newCombinedRows, recipeListGroup: (recipeLG === undefined ? null : recipeLG.listGroupID)});
  }
  