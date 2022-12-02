import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonModal, useIonAlert, NavContext } from '@ionic/react';
import { RouteComponentProps, useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateListWhole, useCreateList } from '../components/itemhooks';
import { cloneDeep, isEmpty } from 'lodash';
import './List.css';

interface ListPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const List: React.FC<ListPageProps> = () => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  const initListDoc = false;
  if ( mode === "new" ) { routeID = "<new>"};
  const [stateListDoc,setStateListDoc] = useState<any>({});
  const [doingUpdate,setDoingUpdate] = useState(false);
  const [selectedListID,setSelectedListID] = useState(routeID);
  const [changesMade,setChangesMade] = useState(false);
  const [presentChangesWarning] = useIonAlert();
  const [isModalOpen,setIsModalOpen] = useState(false);
  const [nextListID,setNextListID] = useState("");
  const updateListWhole  = useUpdateListWhole();
  const createList = useCreateList();

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
      if (mode === "new" && !initListDoc) {
        let initCategories=categoryDocs.map(cat => cat._id);
        let initListDoc = {
          type: "list",
          name: "",
          sharedWith: [],
          categories: initCategories
        }
        setStateListDoc(initListDoc);
      }
      else {
        let listDoc=listDocs.find(el => el._id === selectedListID);
        setStateListDoc(listDoc as any);
      }
      setDoingUpdate(false);
    }
  },[listLoading,listDocs,userLoading,userDocs,categoryLoading,categoryDocs,selectedListID]);

  if (listLoading || userLoading || categoryLoading || doingUpdate || isEmpty(stateListDoc))  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  function updateThisItem() {
    setDoingUpdate(true);
    if (mode === "new") {
      const result = createList(stateListDoc);
      console.log(result);
    }
    else {
      updateListWhole(stateListDoc);
    }
    goBack("/lists");
  }

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    let newListDoc=cloneDeep(stateListDoc);
    newListDoc.categories.splice(event.detail.to,0,newListDoc.categories.splice(event.detail.from,1)[0]);
    setStateListDoc(newListDoc);
    setChangesMade(true);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
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
    setStateListDoc(newListDoc);
    setChangesMade(true);
  }

  function selectList(ev: Event,listID: string) {
    if (changesMade) {
      ev.stopImmediatePropagation();
      presentChangesWarning({
        header:"Warning!",
        message:"Changes made and not yet saved",
        buttons: [ {
          text: "Switch Lists Without Saving",
          role: "switch",
          handler: () => {setSelectedListID(listID)}
        }, {
          text: "Cancel Switch",
          role: "cancel",
          handler: () => {}
        }

        ]
      })
      return (false);
    } else {
      setSelectedListID(listID);
      return (true);
    }
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
    setChangesMade(true);
  }

  function updateName(updName: string) {
    setStateListDoc({...stateListDoc, name: updName});
    setChangesMade(true);
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
      <IonItem key={"active-"+categoryID}>
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
        <IonItem key={"inactive-"+categoryID}>
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
  
  let selectDropDown: any=[];
    if (mode === "new") {
      selectDropDown.push(<IonTitle key="createnew">Creating new list</IonTitle>)
    } else {  
      selectDropDown.push(
        <IonTitle key="editexisting">
        <IonItem key="editexistingitem">
        <IonLabel key="editexisting">Editing List:</IonLabel>
        <IonSelect key="list" interface="popover" onIonChange={(ev) => selectList(ev, ev.detail.value)} value={selectedListID}>
        {listDocs.map((list) => (
          <IonSelectOption key={"list-"+list._id} value={(list as any)._id}>
            {(list as any).name}
          </IonSelectOption>
        ))}
        </IonSelect>
        </IonItem>
        </IonTitle>
    )
  }

  let updateButton=[];
  if (mode === "new") {
    updateButton.push(<IonButton key="add" onClick={() => updateThisItem()}>Add</IonButton>)
  } else {
    updateButton.push(<IonButton key="update" onClick={() => updateThisItem()}>Update</IonButton>)
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
            {selectDropDown}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" placeholder="<New>" onIonChange={(e: any) => updateName(e.detail.value)} value={(stateListDoc as any).name}></IonInput>
            </IonItem>
            <IonItemGroup key="userlist">
            {usersElem}
            </IonItemGroup>
            <IonItemGroup key="categorylist">
            {categoryElem}
            </IonItemGroup>
          </IonList>
          {updateButton}
          <IonButton key="back" onClick={() => goBack("/lists")}>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default List;
