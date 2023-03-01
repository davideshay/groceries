import { IonList, IonItem, IonButton, IonMenuToggle, IonIcon, IonText } from '@ionic/react';
import { useContext } from 'react';
import { pencilOutline } from 'ionicons/icons';
import { RemoteDBStateContext } from './RemoteDBState';
import { useLists } from './Usehooks';
import './ListsAll.css';
import { cloneDeep } from 'lodash';
import { RowType } from './DataTypes';

interface ListsAllProps {
  separatePage: boolean
}

const ListsAll: React.FC<ListsAllProps> = ({separatePage}) => {
  const { remoteDBCreds } = useContext(RemoteDBStateContext);
  const { listRowsLoading, listCombinedRows} = useLists(String(remoteDBCreds.dbUsername));

  if (listRowsLoading) { return (<></>) }
  
  function addRow({separatePage, showLinkID, editLinkID, rowKey, rowName, extraClass }: 
      { separatePage: boolean, showLinkID: string, editLinkID: string, rowKey: string, rowName: string, extraClass: string}) {
    const isUngroupedHeader = (rowKey.startsWith("G-null"));
    let baseRow;
    if (isUngroupedHeader) {
      baseRow = (<IonItem key={rowKey}>{rowName}</IonItem>)
    } else {
      baseRow = (
      <IonItem key={rowKey} >
        <IonButton slot="start" className={"textButton "+extraClass} fill="clear" routerLink={(showLinkID)}>{rowName}</IonButton>
        <IonButton fill="clear" routerLink={editLinkID} slot="end">
        <IonIcon slot="end" icon={pencilOutline}></IonIcon>
        </IonButton>
      </IonItem>)
    }
    if (separatePage) {return {baseRow}}
    else {
      return (<IonMenuToggle key={rowKey} auto-hide={false}>
        {baseRow}
      </IonMenuToggle>)
    }
  }

  let listsElem : any = [];
  
  listCombinedRows.forEach(combinedRow => {
    if (combinedRow.rowType == RowType.listGroup ) {
      listsElem.push(
        addRow({separatePage: separatePage, showLinkID:"/items/group/"+combinedRow.listGroupID,
              editLinkID: "/listgroup/edit/"+combinedRow.listGroupID,
              rowKey: combinedRow.rowKey,
              rowName: combinedRow.rowName,
              extraClass: ""
            })
      )      
    } else {
      listsElem.push(
        addRow({separatePage: separatePage, showLinkID:"/items/list/"+combinedRow.listDoc._id,
              editLinkID: "/list/edit/"+combinedRow.listDoc._id,
              rowKey: combinedRow.rowKey,
              rowName: combinedRow.rowName,
              extraClass: "indented"
            })
      )      
    }   
  })
  
  return (
      <>
        {listsElem}
      </>
  )

};

export default ListsAll;
