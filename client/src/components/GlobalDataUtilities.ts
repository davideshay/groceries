import { ListCombinedRow, ListCombinedRows, ListRow, RowType } from "./DataTypes";
import { ListDocInit, ListDocs, ListGroupDoc, ListGroupDocs } from "./DBSchema";
import { DBCreds } from "./RemoteDBState";
import { cloneDeep } from "lodash";

export function getListRows(listDocs: ListDocs, listGroupDocs: ListGroupDocs, remoteDBCreds: DBCreds) : {listRows: ListRow[], listCombinedRows: ListCombinedRows} {

    let curListDocs: ListDocs = cloneDeep(listDocs);
    let newListRows: ListRow[] = [];
    curListDocs.forEach((listDoc) => {
    let listGroupID=null;
    let listGroupName="";
    let listGroupDefault=false;
    let listGroupOwner = "";
    for (let i = 0; i < listGroupDocs.length; i++) {
        const lgd = (listGroupDocs[i] as ListGroupDoc);
        if (lgd.listGroupOwner !== remoteDBCreds.dbUsername || lgd.sharedWith.includes(remoteDBCreds.dbUsername)) {
        continue;
        }
        if ( listDoc.listGroupID == lgd._id ) {
        listGroupID=lgd._id
        listGroupName=lgd.name
        listGroupDefault=lgd.default;
        listGroupOwner=lgd.listGroupOwner;
        }
    }
    if (listGroupID == null) { return };
    let listRow: ListRow ={
        listGroupID: listGroupID,
        listGroupName: listGroupName,
        listGroupDefault: listGroupDefault,
        listGroupOwner: listGroupOwner,
        listDoc: listDoc,
    }
    newListRows.push(listRow);
    });

    newListRows.sort(function (a: ListRow, b: ListRow) {
    return a.listDoc.name.toUpperCase().localeCompare(b.listDoc.name.toUpperCase());
    })

    const sortedListGroups: ListGroupDocs = cloneDeep(listGroupDocs).filter( 
    (lgd: ListGroupDoc) => lgd.listGroupOwner == remoteDBCreds.dbUsername ||
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
        listGroupDefault: listGroup.default,
        listDoc: ListDocInit
        }
    newCombinedRows.push(groupRow);
    for (let i = 0; i < newListRows.length; i++) {
        const listRow = newListRows[i];
        if (listGroup._id == listRow.listGroupID) {
        let listListRow: ListCombinedRow = {
            rowType: RowType.list,
            rowName: listRow.listDoc.name,
            rowKey: "L-"+listRow.listDoc._id,
            listOrGroupID: String(listRow.listDoc._id),
            listGroupID: listRow.listGroupID,
            listGroupName: listRow.listGroupName,
            listGroupOwner: listRow.listGroupOwner,
            listGroupDefault: listRow.listGroupDefault,
            listDoc: listRow.listDoc
        }
        newCombinedRows.push(listListRow);    
        } 
    }  
    });
    // now add any ungrouped (error) lists:
    let testRow = newListRows.find(el => (el.listGroupID == null))
    if (testRow != undefined) {
    let groupRow: ListCombinedRow = {
        rowType : RowType.listGroup, rowName : testRow.listGroupName,
        rowKey: "G-null", listOrGroupID: null, listGroupID : null,
        listGroupName : testRow.listGroupName, listGroupDefault: false, listGroupOwner: null,
        listDoc: ListDocInit
    }
    newCombinedRows.push(groupRow);
    newListRows.forEach(newListRow => {
        if (newListRow.listGroupID == null) {
        let listlistRow: ListCombinedRow = {
            rowType: RowType.list, rowName: newListRow.listDoc.name,
            rowKey: "L-"+newListRow.listDoc._id, listOrGroupID: String(newListRow.listDoc._id),listGroupID: null,
            listGroupName: newListRow.listGroupName, listGroupOwner: null, listGroupDefault: false,
            listDoc: newListRow.listDoc
        }
        newCombinedRows.push(listlistRow);  
        }
    })
    }
    
    return ({listRows: newListRows, listCombinedRows: newCombinedRows});
  }
  