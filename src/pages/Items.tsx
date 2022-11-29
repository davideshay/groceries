import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonFab, IonFabButton, IonIcon, IonReorderGroup } from '@ionic/react';
import { add, list } from 'ionicons/icons';
import { stringify } from 'querystring';
import { useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import './Items.css';

interface ItemsPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Items: React.FC<ItemsPageProps> = ({ match }) => {

  interface ItemRow {
    itemID: string,
    itemName: string,
    categoryID: string,
    categoryName: string,
    categorySeq: number,
    quantity: number,
    completed: boolean
  }

  const [stateItemRows,setStateItemRows] = useState<ItemRow[]>([]);

  const { docs: itemDocs, loading: itemLoading, error: itemError } = useFind({
    index: {
      fields: ["type","name","lists"]
    },
    selector: {
      type: "item",
      name: { $exists: true },
      lists: { $elemMatch: { "listID": match.params.id , "active" : true} }
    },
    sort: [ "type", "name", "lists" ]
    })

    const { doc: listDoc, loading: listLoading, state: listState, error: listError } = useDoc(match.params.id);

    const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
    })


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
    itemRow.completed = itemDoc.lists.find((element: any) => (element.listID === match.params.id)).completed;
    itemRows.push(itemRow);
  })

  // itemRows.sort((a,b) => {
  //   if (Number(a.completed) - Number(b.completed))
  //   if (a.categorySeq < b.categorySeq) {return -1}
  //   else if (a.categorySeq > b.categorySeq) { return 1}
  //   else { return a.itemName.localeCompare(b.itemName)}
  //   }
  // )
  
  itemRows.sort((a,b) => (
    (Number(a.completed) - Number(b.completed)) || (a.categorySeq - b.categorySeq) ||
    (a.itemName.localeCompare(b.itemName))
  ))

  setStateItemRows(itemRows);

  let listContent=[];

  function addCurrentRows(listCont: any, curRows: any, catID: string, catName: string) {
    listCont.push(
      <IonReorderGroup key={catID + "-group"} disabled={false}>
        <IonItemGroup key={catID}>
        <IonItemDivider key={catName}>{catName}</IonItemDivider>
          {curRows}
        </IonItemGroup>
      </IonReorderGroup>
    )
  }

  let lastCategoryID="<INITIAL>";
  let lastCategoryName="<INITIAL>";
  let currentRows=[];
  let createdFinished=false;
  const completedDivider=(<IonItemDivider key="Completed">Completed</IonItemDivider>);
  for (let i = 0; i < itemRows.length; i++) {
    const item = itemRows[i];
    if (item.completed && !createdFinished) {
      listContent.push(completedDivider);
      createdFinished=true;
    }
    if (lastCategoryID != item.categoryID) { 
      if (currentRows.length > 0) {
        addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName);
        currentRows=[];
      }
      if (item.categoryID === null) {
        lastCategoryID = "Uncategorized"
      }
      else {
        lastCategoryID = item.categoryID;
      }
      lastCategoryName=item.categoryName;   
    }
    currentRows.push(
      <IonItem key={stateItemRows[i].itemID} routerLink={("/item/"+stateItemRows[i].itemID)}>
        <IonLabel>{stateItemRows[i].itemName + " "+ stateItemRows[i].quantity.toString() }</IonLabel>
      </IonItem>);
  }

  addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName);
  if (!createdFinished) {listContent.push(completedDivider)};
  let contentElem=(<IonList lines="full">{listContent}</IonList>)

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
