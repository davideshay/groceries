import { IonList, IonItem, IonButton, IonMenuToggle, IonIcon } from '@ionic/react';
import { useContext } from 'react';
import { pencilOutline } from 'ionicons/icons';
import { RemoteDBStateContext } from './RemoteDBState';
import { useLists } from './Usehooks';
import './ListsAll.css';
import { cloneDeep } from 'lodash';

interface ListsAllProps {
  separatePage: boolean
}

const ListsAll: React.FC<ListsAllProps> = ({separatePage}) => {
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const { listRows, listRowsLoading} = useLists(String(remoteDBCreds.dbUsername));

  if (listRowsLoading) { return (<></>) }
  
  console.log("listRows:",cloneDeep(listRows))

  let listsElem : any = [];
  let lastListGroupName: any = null;
  listRows.forEach(listRow => {
    if (listRow.listGroupName != lastListGroupName) {
      console.log(listRow);
      if (separatePage) {
        listsElem.push(
          <IonItem key={"G"+listRow.listGroupID+"-"+listRow.listDoc._id} >
          <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/group/" + (listRow.listGroupID))}>{listRow.listGroupName}</IonButton>
          <IonButton routerLink={"/listgroup/edit/" + listRow.listGroupID} slot="end">
            Edit
          </IonButton>
        </IonItem>
        )
      } else {
        listsElem.push(
          <IonMenuToggle key={"G"+listRow.listGroupID+"-"+listRow.listDoc._id} autoHide={false}>
          <IonItem key={"G"+listRow.listGroupID+"-"+listRow.listDoc._id} >
            <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/group/" + (listRow.listGroupID))}>{listRow.listGroupName}</IonButton>
            <IonButton fill="clear" routerLink={"/listgroup/edit/" + listRow.listGroupID} slot="end">
            <IonIcon slot="end" icon={pencilOutline}></IonIcon>
            </IonButton>
          </IonItem>  
          </IonMenuToggle>
        )  
      }
      lastListGroupName = listRow.listGroupName;
    } else {
      console.log("in list mode (not group)",listRow);
      if (separatePage) {
        listsElem.push(
          <IonItem key={"L"+listRow.listGroupID+"-"+listRow.listDoc._id} >
          <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/list/" + (listRow.listDoc._id))}>{listRow.listDoc.name}</IonButton>
          <IonButton routerLink={"/list/edit/" + listRow.listDoc._id} slot="end">
            Edit
          </IonButton>
        </IonItem>
        )
      } else {
        listsElem.push(
          <IonMenuToggle key={"L"+listRow.listGroupID+"-"+listRow.listDoc._id} autoHide={false}>
          <IonItem key={"L"+listRow.listGroupID+"-"+listRow.listDoc._id} >
            <IonButton slot="start" class="textButton indented" fill="clear" routerLink={("/items/list/" + (listRow.listDoc._id))}>{listRow.listDoc.name}</IonButton>
            <IonButton fill="clear" routerLink={"/list/edit/" + listRow.listDoc._id} slot="end">
            <IonIcon slot="end" icon={pencilOutline}></IonIcon>
            </IonButton>
          </IonItem>  
          </IonMenuToggle>
        )  
      }
    }
  });
  
  return (
      <>
        {listsElem}
      </>
  )

};

export default ListsAll;
