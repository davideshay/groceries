import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption, IonReorder, IonReorderGroup,ItemReorderEventDetail, NavContext } from '@ionic/react';
import { add } from 'ionicons/icons';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateListWhole } from '../components/itemhooks';
import { cloneDeep, isEmpty } from 'lodash';
import './List.css';

interface ListPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const List: React.FC<ListPageProps> = ({ match }) => {

  const [stateListDoc,setStateListDoc] = useState<any>({});
  const [doingUpdate,setDoingUpdate] = useState(false);
  const [selectedListID,setSelectedListID] = useState(match.params.id);
  const updateListWhole  = useUpdateListWhole();

  const { docs: listDocs, loading: listLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "list", name: { $exists: true} },
    sort: [ "type","name"]
  });
  const { docs: userDocs, loading: userLoading, error: userError} = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "user", name: { $exists: true} },
    sort: [ "type","name"]
  });
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  const {goBack} = useContext(NavContext);

  useEffect( () => {
    if (!listLoading && !userLoading && !categoryLoading) {
      let listDoc=listDocs.find(el => el._id === selectedListID);
      setStateListDoc(listDoc as any);
      setDoingUpdate(false);
    }
  },[listLoading,listDocs,userLoading,userDocs,categoryLoading,categoryDocs,selectedListID]);

  if (listLoading || userLoading || categoryLoading || doingUpdate || isEmpty(stateListDoc))  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  console.log("proceeding to load with:",{stateListDoc});

  function updateThisItem() {
    setDoingUpdate(true);
    updateListWhole(stateListDoc);
    goBack("/lists");
  }

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    let newListDoc=cloneDeep(stateListDoc);
    newListDoc.categories.splice(event.detail.to,0,newListDoc.categories.splice(event.detail.from,1)[0]);
    setStateListDoc(newListDoc);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
    console.log("updateCat:", {categoryID, updateVal});
    const currCategories=[];
    let foundIt=false;
    for (let i = 0; i < stateListDoc.categories.length; i++) {
      if (stateListDoc.categories[i] === categoryID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
          console.log("ERROR: Item already in list, cannot set to active");
        } else {
          // skipping item, should not be in list copy
        }
      } else {
        currCategories.push(stateListDoc.categories[i])
      }
    }
    console.log({currCategories,foundIt});
    if (updateVal && !foundIt) {
      currCategories.push(categoryID);
    }
    let newListDoc=cloneDeep(stateListDoc);
    newListDoc.categories = currCategories;
    console.log("old",{stateListDoc},"new",{newListDoc});
    setStateListDoc(newListDoc);
//    setDoingUpdate(true);
//    updateList(newListDoc);
  }

  function selectList(listID: string) {
    setSelectedListID(listID);
  }

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers=[];
    let foundIt=false;
    for (let i = 0; i < stateListDoc.sharedWith.length; i++) {
      if (stateListDoc.sharedWith[i] === userID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
          console.log("ERROR: User already in list, cannot set to active");
        } else {
          // skipping item, should not be in list copy
        }
      } else {
        currUsers.push(stateListDoc.sharedWith[i])
      }
    }
    if (updateVal && !foundIt) {
      currUsers.push(userID);
    }
    let newListDoc=cloneDeep(stateListDoc);
    newListDoc.sharedWith = currUsers;
    setStateListDoc(newListDoc);
//    setDoingUpdate(true);
//    updateListWhole(newListDoc);
  }

  let usersElem=[];
  usersElem.push(<IonItemDivider key="listdivider">List is shared with these users:</IonItemDivider>)
  for (let i = 0; i < userDocs.length; i++) {
    const userID=userDocs[i]._id;
    const userName=(userDocs[i] as any).name;
    const userEmail=(userDocs[i] as any).email;
    const userFound=stateListDoc.sharedWith.find((element: string) => (element === userID));
    usersElem.push(
      <IonItem key={userID}>
        <IonCheckbox slot="start" onIonChange={(e: any) => selectUser(userID,Boolean(e.detail.checked))} checked={userFound}></IonCheckbox>
        <IonLabel>{userName}</IonLabel>
        <IonLabel>{userEmail}</IonLabel>
      </IonItem>
    )
  }

  let categoryElem=[];
  let categoryLines=[];
  
  for (let i = 0; i < (stateListDoc as any).categories.length; i++) {
    const categoryID = (stateListDoc as any).categories[i];
    const categoryName = (categoryDocs.find(element => (element._id === categoryID)) as any).name;
    categoryLines.push(
      <IonItem key={categoryID}>
        <IonCheckbox slot="start" onIonChange={(e: any) => updateCat(categoryID,Boolean(e.detail.checked))} checked={true}></IonCheckbox>
        <IonButton fill="clear" class="textButton">{categoryName}</IonButton>
        <IonReorder slot="end"></IonReorder>
      </IonItem>
    )
  }
  categoryElem.push(
    <div key="active-div">
    <IonItemDivider key="active">
    <IonLabel>Active</IonLabel>
    </IonItemDivider>
    <IonReorderGroup key="active-reorder-group" disabled={false} onIonItemReorder={handleReorder}>
        {categoryLines}
    </IonReorderGroup>
    </div>
  )
  categoryLines=[];
  for (let i = 0; i < categoryDocs.length; i++) {
    const category: any = categoryDocs[i];
    const categoryID = category._id;
    const categoryName = (categoryDocs.find(element => (element._id === categoryID)) as any).name;
    const inList = (stateListDoc as any).categories.includes(categoryID);
    if (!inList) {
      categoryLines.push(
        <IonItem key={categoryID}>
          <IonCheckbox slot="start" onIonChange={(e: any) => updateCat(categoryID,Boolean(e.detail.checked))} checked={false}></IonCheckbox>
          <IonButton fill="clear" class="textButton">{categoryName}</IonButton>
          <IonReorder slot="end>"></IonReorder>
        </IonItem>
      )
    }
  }
  categoryElem.push(
    <div key="inactive-div">
    <IonItemDivider key="inactive">
    <IonLabel>Inactive</IonLabel>
    </IonItemDivider>
    <IonReorderGroup key="inactive-reorder-group" disabled={false} onIonItemReorder={handleReorder}>
        {categoryLines}
    </IonReorderGroup>
    </div>
  )
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
          <IonSelect onIonChange={(ev) => selectList(ev.detail.value)} value={selectedListID}>
                {listDocs.map((list) => (
                    <IonSelectOption key={list._id} value={(list as any)._id}>
                      {(list as any).name}
                    </IonSelectOption>
                ))}
              </IonSelect>
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setStateListDoc({...stateListDoc, name: e.detail.value})} value={(stateListDoc as any).name}></IonInput>
            </IonItem>
            <IonItemGroup key="userlist">
            {usersElem}
            </IonItemGroup>
            <IonItemGroup key="categorylist">
            {categoryElem}
            </IonItemGroup>
          </IonList>
          <IonButton onClick={() => updateThisItem()}>Update</IonButton>
          <IonButton onClick={() => goBack("/lists")}>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default List;
