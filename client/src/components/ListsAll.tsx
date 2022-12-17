import { IonList, IonItem, IonButton, IonMenuToggle, IonIcon } from '@ionic/react';
import { useContext } from 'react';
import { useFind } from 'use-pouchdb';
import { pencilOutline } from 'ionicons/icons';
import { GlobalStateContext } from '../components/GlobalState';
import './ListsAll.css';

interface ListsAllProps {
  separatePage: boolean
}

const ListsAll: React.FC<ListsAllProps> = ({separatePage}) => {
  //TODO -- filter by list owner and/or sharedwith id
  const { globalState } = useContext(GlobalStateContext);
  const { docs: listDocs, loading: listLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { "$and": [ 
      {  "type": "list",
         "name": { "$exists": true } },
      { "$or" : [{"listOwner": globalState.dbCreds?.dbUsername},
                 {"sharedWith": { $elemMatch: {$eq: globalState.dbCreds?.dbUsername}}}]
      }             
    ] },
    sort: [ "type","name"]
  });

//  const { docs, loading, error } = useFind({
//    index: { fields: ["type","name"] },
//    selector: { type: "list", name: { $exists: true } },
//    sort: [ "type", "name" ]
//  })

  if (listLoading) { return (<></>) }
  
  if (separatePage) { return (
    <IonList lines="full">
    {listDocs.map((doc) => (
       <IonItem key={(doc as any)._id} >
         <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
         <IonButton routerLink={"/list/edit/" + (doc as any)._id} slot="end">
           Edit
         </IonButton>
       </IonItem>  ))}
    </IonList> )
   } else { return (
    <IonList lines="full">
    {listDocs.map((doc) => (
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
