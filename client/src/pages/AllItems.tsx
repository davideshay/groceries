import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { useLists } from '../components/Usehooks';
import { useContext } from 'react';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import SyncIndicator from '../components/SyncIndicator';
import './AllItems.css';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const AllItems: React.FC = () => {
  const { remoteDBState } = useContext(RemoteDBStateContext);
  const { listDocs, listsLoading } = useLists(String(remoteDBState.dbCreds.dbUsername))
  const { docs, loading, error } = useFind({
  index: { fields: ["type","name"]},
  selector: { type: "item", name: { $exists: true }},
  sort: [ "type", "name" ]
  })

  if (loading || listsLoading ) { return (
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )}

  let itemsElem : any[] = [];
  docs.forEach((doc: any) => {
    let hasValidList=false;
    doc.lists.forEach((list: any) => {
      let listIdx = listDocs.findIndex((el: any) => el._id == list.listID);
      if (listIdx !== -1) { hasValidList = true}
    })
    if (hasValidList) {
      itemsElem.push(
        <IonItem key={(doc as any)._id} >
          <IonButton slot="start" class="textButton" fill="clear" routerLink={("/item/edit/" + (doc as any)._id)}>{(doc as any).name}</IonButton>
        </IonItem>  
      )
    }
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>All Items</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList lines="full">
          {itemsElem}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default AllItems;
