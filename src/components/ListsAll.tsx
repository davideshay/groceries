import { IonList, IonItem, IonButton, IonMenuToggle, IonIcon } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { pencilOutline } from 'ionicons/icons';
import './ListsAll.css';

interface ListsAllProps {
  separatePage: boolean
}

const ListsAll: React.FC<ListsAllProps> = ({separatePage}) => {
  const { docs, loading, error } = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "list", name: { $exists: true } },
    sort: [ "type", "name" ]
  })

  if (loading) { return (<></>) }
  
  if (separatePage) { return (
    <IonList lines="full">
    {docs.map((doc) => (
       <IonItem key={(doc as any)._id} >
         <IonButton slot="start" class="textButton" fill="clear" routerLink={("/items/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
         <IonButton routerLink={"/list/edit/" + (doc as any)._id} slot="end">
           Edit
         </IonButton>
       </IonItem>  ))}
    </IonList> )
   } else { return (
    <IonList lines="full">
    {docs.map((doc) => (
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
