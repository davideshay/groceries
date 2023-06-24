import {  IonItem, IonButton, IonMenuToggle, IonIcon } from '@ionic/react';
import { useContext } from 'react';
import { pencilOutline } from 'ionicons/icons';
import './ListsAll.css';
import './common.css';
import { RowType } from './DataTypes';
import { GlobalDataContext } from './GlobalDataProvider';

interface ListsAllProps {
  separatePage: boolean
}

const ListsAll: React.FC<ListsAllProps> = (props: ListsAllProps) => {
  const { listRowsLoaded, listCombinedRows} = useContext(GlobalDataContext)

  if (!listRowsLoaded) { return (<></>) }
  
  function addRow({separatePage, showLinkID, editLinkID, rowKey, rowName, extraClass }: 
      { separatePage: boolean, showLinkID: string, editLinkID: string, rowKey: string, rowName: string, extraClass: string}) {
    const isUngroupedHeader = (rowKey.startsWith("G-null"));
    let baseRow;
    if (isUngroupedHeader) {
      baseRow = (<IonItem key={rowKey}>{rowName}</IonItem>)
    } else {
      baseRow = (
      <IonItem className="menu-item ion-no-padding" key={rowKey} >
        <IonButton slot="start" size="default" className={"ion-no-margin standard-text-button "+extraClass} fill="clear" routerLink={(showLinkID)}>{rowName}</IonButton>
        <IonButton fill="clear" className="ion-no-margin standard-text-button" routerLink={editLinkID} slot="end">
        <IonIcon slot="end" icon={pencilOutline}></IonIcon>
        </IonButton>
      </IonItem>)
    }
    if (separatePage) {return baseRow}
    else {
      return (<IonMenuToggle key={rowKey} auto-hide={false}>
        {baseRow}
      </IonMenuToggle>)
    }
  }

  let listsElem: JSX.Element[] = [];
  
  listCombinedRows.forEach(combinedRow => {
    if (combinedRow.hidden) {return;}
    if (combinedRow.rowType === RowType.listGroup ) {
      listsElem.push(
          addRow({separatePage: props.separatePage, showLinkID:"/items/group/"+combinedRow.listGroupID,
              editLinkID: "/listgroup/edit/"+combinedRow.listGroupID,
              rowKey: combinedRow.rowKey,
              rowName: combinedRow.rowName,
              extraClass: ""
            }) )
    } else {
      listsElem.push(
        addRow({separatePage: props.separatePage, showLinkID:"/items/list/"+combinedRow.listDoc._id,
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
