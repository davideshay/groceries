import { IonList, IonItem, IonButton, IonMenuToggle, IonIcon } from '@ionic/react';
import { useContext } from 'react';
import { useFind } from 'use-pouchdb';
import { pencilOutline } from 'ionicons/icons';
import { RemoteDBStateContext } from './RemoteDBState';
import { useLists } from './Usehooks';
import './ListsAll.css';

interface ListsAllProps {
  separatePage: boolean
}

const ListsAll: React.FC<ListsAllProps> = ({separatePage}) => {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const { listDocs, listsLoading } = useLists(String(remoteDBState.dbCreds.dbUsername));

  if (listsLoading) { return (<></>) }
  
  if (separatePage) { return (
    <IonList lines="full">
    {listDocs.map((doc: any) => (
       <IonItem key={(doc as any)._id} >
         <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
         <IonButton routerLink={"/list/edit/" + (doc as any)._id} slot="end">
           Edit
         </IonButton>
       </IonItem>  ))}
    </IonList> )
   } else { return (
    <IonList lines="full">
    {listDocs.map((doc: any) => (
     <IonMenuToggle key={(doc as any)._id} autoHide={false}>
       <IonItem key={(doc as any)._id} >
         <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
         <IonButton fill="clear" routerLink={"/list/edit/" + (doc as any)._id} slot="end">
          <IonIcon slot="end" icon={pencilOutline}></IonIcon>
         </IonButton>
       </IonItem>  
     </IonMenuToggle> ))}
    </IonList>
   )}

};

export default ListsAll;
