import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonModal, useIonAlert, NavContext } from '@ionic/react';
import { RouteComponentProps, useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateListWhole, useCreateList } from '../components/itemhooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import './List.css';

interface ListPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

interface PageState {
  listDoc: any,
  selectedListID: String,
  changesMade: Boolean
}  

const List: React.FC<ListPageProps> = () => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  let needInitListDoc = (mode === "new") ? true: false;
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    listDoc: {},
    selectedListID: routeID,
    changesMade: false
  })
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

  const {goBack, navigate} = useContext(NavContext);

  function changeListUpdateState(listID: string) {
    setPageState({...pageState,
        listDoc: listDocs.find(el => el._id === listID),
        selectedListID: listID})
    navigate('/list/edit/'+listID);    
  }

  useEffect( () => {
    let newPageState=cloneDeep(pageState);
    if (!listLoading && !userLoading && !categoryLoading) {
      if (mode === "new" && needInitListDoc) {
        let initCategories=categoryDocs.map(cat => cat._id);
        let initListDoc = {
          type: "list",
          name: "",
          sharedWith: [],
          categories: initCategories
        }
        newPageState.listDoc=initListDoc;
        needInitListDoc=false;
      }
      else {
        let newListDoc = listDocs.find(el => el._id === pageState.selectedListID);
        newPageState.listDoc = newListDoc;
      }
      newPageState.changesMade=false;
      setPageState(newPageState);
    }
  },[listLoading,listDocs,userLoading,userDocs,categoryLoading,categoryDocs,pageState.selectedListID]);

  if (listLoading || userLoading || categoryLoading || isEmpty(pageState.listDoc))  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
  
  function updateThisItem() {
    if (mode === "new") {
      const result = createList(pageState.listDoc);
    }
    else {
      updateListWhole(pageState.listDoc);
    }
    navigate("/lists");
  }

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    let newPageState=cloneDeep(pageState);
    newPageState.listDoc.categories.splice(event.detail.to,0,newPageState.listDoc.categories.splice(event.detail.from,1)[0]);
    newPageState.changesMade=true;
    setPageState(newPageState);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
    const currCategories=[];
    let foundIt=false;
    for (let i = 0; i < pageState.listDoc.categories.length; i++) {
      if (pageState.listDoc.categories[i] === categoryID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
        }
      } else {
        currCategories.push(pageState.listDoc.categories[i])
      }
    }
    if (updateVal && !foundIt) {
      currCategories.push(categoryID);
    }
    setPageState({...pageState, changesMade: true, listDoc: {...pageState.listDoc, categories: currCategories}})

  }

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers=[];
    let foundIt=false;
    for (let i = 0; i < pageState.listDoc.sharedWith.length; i++) {
      if (pageState.listDoc.sharedWith[i] === userID) {
        foundIt = true;
        if (updateVal) {
          // shouldn't occur -- asking to change it to active but already in the list
        } 
      } else {
        currUsers.push(pageState.listDoc.sharedWith[i])
      }
    }
    if (updateVal && !foundIt) {
      currUsers.push(userID);
    }
    if (!isEqual(pageState.listDoc.sharedWith,currUsers)) {
      setPageState({...pageState, changesMade: true, listDoc: {...pageState.listDoc, sharedWith: currUsers}})
    }
  }

  function updateName(updName: string) {
    if (pageState.listDoc.name !== updName) {
      setPageState({...pageState, changesMade: true, listDoc: {...pageState.listDoc, name: updName}});
    }  
  }

  let usersElem=[];
  usersElem.push(<IonItemDivider key="listdivider">List is shared with these users:</IonItemDivider>)
  for (let i = 0; i < userDocs.length; i++) {
    const userID=userDocs[i]._id;
    const userName=(userDocs[i] as any).name;
    const userEmail=(userDocs[i] as any).email;
    const userFound=pageState.listDoc.sharedWith.find((element: string) => (element === userID));
    usersElem.push(
      <IonItem key={pageState.selectedListID+"-"+userID}>
        <IonCheckbox key={pageState.selectedListID+"-"+userID} slot="start" onIonChange={(e: any) => selectUser(userID,Boolean(e.detail.checked))} checked={userFound}></IonCheckbox>
        <IonLabel>{userName}</IonLabel>
        <IonLabel>{userEmail}</IonLabel>
      </IonItem>
    )
  }

  let categoryElem=[];
  let categoryLines=[];

  function catItem(id: string, active: boolean) {
    const actname=active ? "active" : "inactive"
    const name = (categoryDocs.find(element => (element._id === id)) as any).name
    return (
    <IonItem key={pageState.selectedListID+"-"+actname+"-"+id}>
    <IonCheckbox key={pageState.selectedListID+"-"+actname+"-"+id} slot="start" onIonChange={(e: any) => updateCat(id,Boolean(e.detail.checked))} checked={active}></IonCheckbox>
    <IonButton fill="clear" class="textButton">{name}</IonButton>
    <IonReorder slot="end"></IonReorder>
    </IonItem>)
  }

  function catItemDivider(active: boolean, lines: any) {
    const actname=active ? "Active" : "Inactive"
    return (
      <div key={actname+"-"+"div"}>
      <IonItemDivider key={actname}><IonLabel>{actname}</IonLabel></IonItemDivider>
      <IonReorderGroup key={actname+"-reorder-group"} disabled={false} onIonItemReorder={handleReorder}>
          {lines}
      </IonReorderGroup>
      </div>  
    )   
  }
  
  for (let i = 0; i < (pageState.listDoc as any).categories.length; i++) {
    const categoryID = (pageState.listDoc as any).categories[i];
    categoryLines.push(catItem((pageState.listDoc as any).categories[i],true));
  }
  categoryElem.push(catItemDivider(true,categoryLines));
  categoryLines=[];
  for (let i = 0; i < categoryDocs.length; i++) {
    const inList = (pageState.listDoc as any).categories.includes(categoryDocs[i]._id);
    if (!inList) {
      categoryLines.push(catItem(categoryDocs[i]._id,false))
    }
  }
  categoryElem.push(catItemDivider(false,categoryLines));

  let selectOptionListElem=(
    listDocs.map((list) => (
      <IonSelectOption key={"list-"+list._id} value={(list as any)._id}>
        {(list as any).name}
      </IonSelectOption>
    )))

  let selectElem=[];
  if (pageState.changesMade) {
    let alertOptions={
      header: "Changing Selected List",
      message: "List has been updated and not saved. Do you still want to change lists?"
    }
    selectElem.push(
      <IonSelect key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    ) 
  }
  
  let selectDropDown: any=[];
    if (mode === "new") {
      selectDropDown.push(<IonTitle key="createnew">Creating new list</IonTitle>)
    } else {  
      selectDropDown.push(
        <IonTitle key="editexisting">
        <IonItem key="editexistingitem">
        <IonLabel key="editexisting">Editing List:</IonLabel>
        {selectElem}
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
              <IonInput type="text" placeholder="<New>" onIonChange={(e: any) => updateName(e.detail.value)} value={(pageState.listDoc as any).name}></IonInput>
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
