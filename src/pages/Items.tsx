import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonItemGroup, IonItemDivider, IonButton, IonFab, IonFabButton, IonIcon, IonCheckbox, IonLabel, IonSelect, IonSelectOption, NavContext } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useState, useEffect, useContext } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { cloneDeep } from 'lodash';
import './Items.css';
import { useUpdateCompleted } from '../components/itemhooks';

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
    completed: boolean | null
  }

  interface PageState {
    selectedListID: string,
    doingUpdate: boolean,
    itemRows: Array<ItemRow>
  }

  const [pageState, setPageState] = useState<PageState>({selectedListID: match.params.id, doingUpdate: false, itemRows: []});
  const updateCompleted = useUpdateCompleted();
  const { docs: itemDocs, loading: itemLoading, error: itemError } = useFind({
    index: {
      fields: ["type","name","lists"]
    },
    selector: {
      type: "item",
      name: { $exists: true },
      lists: { $elemMatch: { "listID": pageState.selectedListID , "active" : true} }
    },
    sort: [ "type", "name", "lists" ]
    })
    const { docs: listDocs, loading: listLoading, error: listError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "list", name: { $exists: true}},
      sort: [ "type","name"]
    })
    const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
    })
    const { docs: allItemDocs, loading: allItemsLoading, error: allItemsError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "item", name: { $exists: true}},
      sort: [ "type","name"]
    })

    const {navigate} = useContext(NavContext);

    useEffect( () => {
      if (!itemLoading && !listLoading && !categoryLoading) {
        setPageState({ ...pageState,
          doingUpdate: false,
          itemRows: getItemRows(pageState.selectedListID)
        })
      }
    },[itemLoading, allItemsLoading, listLoading, categoryLoading, itemDocs, listDocs, allItemDocs, categoryDocs, pageState.selectedListID, match.params.id]);
    
    function getItemRows(listID: string) {
      console.log("in getItemRows, listid:", listID);
      let itemRows: Array<ItemRow> =[];
      let listDoc=listDocs.find(el => el._id === listID);
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
        const listIdx = itemDoc.lists.findIndex((element: any) => (element.listID === listID))
        if (listIdx === -1) {itemRow.completed=false} else {
          itemRow.completed = itemDoc.lists[listIdx].completed;
        }  
        itemRows.push(itemRow);
      })
    
      itemRows.sort((a,b) => (
        (Number(a.completed) - Number(b.completed)) || (a.categorySeq - b.categorySeq) ||
        (a.itemName.localeCompare(b.itemName))
      ))
      return (itemRows)
    }

  if (itemLoading || listLoading || categoryLoading || pageState.doingUpdate )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};  

  let headerElem=(
    <IonHeader><IonToolbar><IonTitle>
        <IonItem key="listselector">
        <IonLabel key="listselectlabel">Items on List:</IonLabel>
        <IonSelect interface="popover" onIonChange={(ev) => selectList(ev.detail.value)} value={pageState.selectedListID}>
            {listDocs.map((list) => (
                <IonSelectOption key={list._id} value={(list as any)._id}>
                  {(list as any).name}
                </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>  
    </IonTitle></IonToolbar></IonHeader>)

  if (pageState.itemRows.length <=0 )  {return(
    <IonPage>{headerElem}<IonContent><IonItem key="nonefound"><IonLabel key="nothinghere">No Items On List</IonLabel></IonItem></IonContent></IonPage>
  )};  

  function completeItemRow(id: String, newStatus: boolean | null) {
    let newItemRows: Array<ItemRow>=cloneDeep(pageState.itemRows);
    let itemSeq = newItemRows.findIndex(element => (element.itemID === id))
    newItemRows[itemSeq].completed = newStatus;
    // get itemdoc from itemDocs
    let itemDoc = itemDocs.find(element => (element._id === id))
    let updateInfo = {
      itemDoc: itemDoc,
      updateAll: true,
      newStatus: newStatus,
      listID: pageState.selectedListID
    }
    setPageState({...pageState, itemRows: newItemRows, doingUpdate: true});
    updateCompleted(updateInfo);
  }

  function selectList(listID: string) {
    setPageState({...pageState, selectedListID: listID, itemRows: getItemRows(listID)});
    navigate('/items/'+listID);
  }

  let listContent=[];

  function addCurrentRows(listCont: any, curRows: any, catID: string, catName: string, completed: boolean | null) {
    listCont.push(
        <IonItemGroup key={catID+Boolean(completed).toString()}>
        <IonItemDivider key={catID+Boolean(completed).toString()}>{catName}</IonItemDivider>
          {curRows}
      </IonItemGroup>
    )
  }

  let lastCategoryID="<INITIAL>";
  let lastCategoryName="<INITIAL>";
  let lastCategoryFinished: boolean | null = null;
  let currentRows=[];
  let createdFinished=false;
  const completedDivider=(<IonItemDivider key="Completed">Completed</IonItemDivider>);
  for (let i = 0; i < pageState.itemRows.length; i++) {
    const item = pageState.itemRows[i];
    if ((lastCategoryID !== item.categoryID )||(lastCategoryFinished !== item.completed)) { 
      if (currentRows.length > 0) {
        addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName,lastCategoryFinished);
        currentRows=[];
      }
      if (item.categoryID === null) {
        lastCategoryID = "Uncategorized"
      }
      else {
        lastCategoryID = item.categoryID;
      }
      lastCategoryName=item.categoryName;
      lastCategoryFinished=item.completed;   
    }
    currentRows.push(
      <IonItem key={pageState.itemRows[i].itemID} >
        <IonCheckbox slot="start"
            onIonChange={(e: any) => completeItemRow(pageState.itemRows[i].itemID,e.detail.checked)}
            checked={Boolean(pageState.itemRows[i].completed)}></IonCheckbox>
        <IonButton fill="clear" class="textButton" routerLink= {"/item/"+pageState.itemRows[i].itemID}>
          {pageState.itemRows[i].itemName + " "+ pageState.itemRows[i].quantity.toString() }</IonButton>
      </IonItem>);
    if (lastCategoryFinished && !createdFinished) {
      listContent.push(completedDivider);
      createdFinished=true;
    }    
  }
  addCurrentRows(listContent,currentRows,lastCategoryID,lastCategoryName,lastCategoryFinished);
  if (!createdFinished) {listContent.push(completedDivider)};
  let contentElem=(<IonList lines="full">{listContent}</IonList>)

  return (
    <IonPage>
      {headerElem}
      <IonContent fullscreen>
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
