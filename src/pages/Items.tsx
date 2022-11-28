import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import './Items.css';

interface ItemsPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Items: React.FC<ItemsPageProps> = ({ match }) => {

  const { docs: itemDocs, loading: itemLoading, error: itemError } = useFind({
    index: {
      fields: ["lists","type","name"]
    },
    selector: {
      lists: { $elemMatch: { "listID": match.params.id , "active" : true} },
      type: "item",
      name: { $exists: true }
    },
    sort: [ "lists", "type", "name" ]
    })

    const { doc: listDoc, loading: listLoading, state: listState, error: listError } = useDoc(match.params.id);

    const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
    })

   interface ItemRow {
      itemID: string,
      itemName: string,
      categoryID: string,
      categoryName: string,
      categorySeq: number,
      quantity: number,
      completed: boolean
    }

  if (itemLoading || listLoading || categoryLoading )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};  

  let itemRows: Array<ItemRow> =[];
  itemDocs.forEach((itemDoc: any) => {
    let itemRow: ItemRow = {
      itemID:"",
      itemName:"",
      categoryID: "",
      categoryName: "",
      categorySeq: 0,
      quantity: 0,
      completed: false
    };
  
    itemRow.itemID = itemDoc._id;
    itemRow.itemName = itemDoc.name;
    itemRow.categoryID = itemDoc.categoryID;
    if (itemRow.categoryID == null) {
      itemRow.categoryName = "Uncategorized";
      itemRow.categorySeq = -1
    } else {
      itemRow.categoryName = (categoryDocs.find(element => (element._id === itemDoc.categoryID)) as any).name;
      itemRow.categorySeq = ((listDoc as any).categories.findIndex((element: any) => (element === itemDoc.categoryID)));  
    }
    itemRow.quantity = itemDoc.quantity;
    itemRow.completed = itemDoc.completed;
    itemRows.push(itemRow);
  })

  itemRows.sort((a,b) => {
    if (a.categorySeq < b.categorySeq) {return -1}
    else if (a.categorySeq > b.categorySeq) { return 1}
    else { return a.itemName.localeCompare(b.itemName)}
    }
  )
  
  let listContent=[];
  let lastCategoryID="";
  for (let i = 0; i < itemRows.length; i++) {
    const item = itemRows[i];
    if (lastCategoryID != item.categoryID) {      
      listContent.push(
        <IonItem key={item.categoryID}>
          <IonLabel>{item.categoryName}</IonLabel>
        </IonItem>);
      lastCategoryID=item.categoryID;  
    }
    listContent.push(
      <IonItem key={item.itemID} routerLink={("/item/"+item.itemID)}>
        <IonLabel>{item.itemName + " " + item.quantity}</IonLabel>
      </IonItem>);
  }
  let contentElem=(<IonList lines="full">{listContent}</IonList>)

  console.log("ItemRows:",itemRows);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Items on List : {(listDoc as any).name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Items On List: {(listDoc as any).name}</IonTitle>
          </IonToolbar>
        </IonHeader>
          {contentElem}
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Items;
