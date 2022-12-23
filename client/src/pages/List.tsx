import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonButtons, IonMenuButton, NavContext } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useFriends } from '../components/Usehooks';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import './List.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { ResolvedFriendStatus } from '../components/DataTypes';
import SyncIndicator from '../components/SyncIndicator';

interface PageState {
  needInitListDoc: boolean,
  listDoc: any,
  selectedListID: String,
  changesMade: Boolean
}  

const List: React.FC = () => {

  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListDoc: (mode === "new") ? true : false,
    listDoc: {},
    selectedListID: routeID,
    changesMade: false
  })
  const updateListWhole  = useUpdateGenericDocument();
  const createList = useCreateGenericDocument();
  const { remoteDBState, setRemoteDBState, startSync} = useContext(RemoteDBStateContext);

  const {friendsLoading,friendRowsLoading,friendRows} = useFriends(String(remoteDBState.dbCreds.dbUsername));

  const { docs: listDocs, loading: listLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { "$and": [ 
      {  "type": "list",
         "name": { "$exists": true } },
      { "$or" : [{"listOwner": remoteDBState.dbCreds.dbUsername},
                 {"sharedWith": { $elemMatch: {$eq: remoteDBState.dbCreds.dbUsername}}}]
      }             
    ] },
    sort: [ "type","name"]
  });
  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
    index: { fields: [ "type","name"] },
    selector: { type: "category", name: { $exists: true}},
    sort: [ "type","name"]
  })

  const {goBack, navigate} = useContext(NavContext);

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListID: routeID}))
  },[routeID])

  function changeListUpdateState(listID: string) {
    console.log("in changeListUpdateState about to update listdoc");
    setPageState(prevState => ({...prevState,
        listDoc: listDocs.find(el => el._id === listID),
        selectedListID: listID}))
    navigate('/list/edit/'+listID);    
  }

  useEffect( () => {
    let newPageState=cloneDeep(pageState);
//    console.log({listLoading,friendRowsLoading,friendsLoading,categoryLoading,mode,pageState})
    if (!listLoading && !friendRowsLoading && !friendsLoading && !categoryLoading) {
      if (mode === "new" && pageState.needInitListDoc) {
        console.log("in new useeffect, creating initlistdoc");
        let initCategories=categoryDocs.map(cat => cat._id);
        let initListDoc = {
          type: "list",
          name: "",
          listOwner: remoteDBState.dbCreds.dbUsername,
          sharedWith: [],
          categories: initCategories
        }
        newPageState.listDoc=initListDoc;
        newPageState.needInitListDoc=false;
      }
      else if (mode != "new") {
        console.log("in initDoc, doing lookup against listDocs");
        let newListDoc = listDocs.find(el => el._id === pageState.selectedListID);
        newPageState.listDoc = newListDoc;
      }
      console.log("updating the entire pagestate including listdoc... could be bad (initlistdoc");
      newPageState.changesMade=false;
      console.log("setting to newPageState",{newPageState});
      setPageState(newPageState);
    }
  },[listLoading,listDocs,friendsLoading, friendRowsLoading, friendRows, categoryLoading,categoryDocs,pageState.selectedListID]);

//  console.log("almost going to render loading or real page");
  let ps=cloneDeep(pageState);
//  console.log({listLoading,friendRowsLoading,friendsLoading,categoryLoading,ps});
//  console.log("is empty listdoc:",isEmpty(pageState.listDoc));

  if (listLoading || friendRowsLoading || friendsLoading || categoryLoading || isEmpty(pageState.listDoc))  {return(
      <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader><IonContent></IonContent></IonPage>
  )};
  
  function updateThisItem() {
    if (mode === "new") {
      const result = createList(pageState.listDoc);
      console.log("result:", result, ": add error checking here")
    }
    else {
      updateListWhole(pageState.listDoc);
    }
    goBack("/lists");
  }

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    let newPageState=cloneDeep(pageState);
    newPageState.listDoc.categories.splice(event.detail.to,0,newPageState.listDoc.categories.splice(event.detail.from,1)[0]);
    newPageState.changesMade=true;
    console.log("updating the entire pagestate again including listdoc");
    setPageState(newPageState);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
    const currCategories: any=[];
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
    console.log("I am in updateCat updating listDoc... problem?")
    setPageState(prevState => (
      {...prevState, changesMade: true, listDoc: {...prevState.listDoc, categories: currCategories}}))

  }

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers: any=[];
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
    console.log("about to update listDoc with new data in selectUser");
    if (!isEqual(pageState.listDoc.sharedWith,currUsers)) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listDoc: {...prevState.listDoc, sharedWith: currUsers}}))
    }
  }

  function updateName(updName: string) {
    if (pageState.listDoc.name !== updName) {
      console.log("updating listDoc in updateName");
      setPageState(prevState => (
        {...prevState, changesMade: true, listDoc: {...prevState.listDoc, name: updName}}));
    }  
  }

  let usersElem=[];
  let ownerText="";
  let iAmListOwner=false;
  if (pageState.listDoc.listOwner == remoteDBState.dbCreds.dbUsername) {
    ownerText = "You are the list owner";
    iAmListOwner=true;
  } else {
    let ownerRow=friendRows.find(el => (el.targetUserName == pageState.listDoc.listOwner));
    ownerText = ownerRow?.targetFullName + " is the list owner";
  }

  usersElem.push(<IonItemDivider key="listuserdivider">{ownerText}</IonItemDivider>)
  usersElem.push(<IonItemDivider key="listdivider">List is shared with these other users:</IonItemDivider>)
  for (let i = 0; i < friendRows.length; i++) {
    if (friendRows[i].resolvedStatus == ResolvedFriendStatus.Confirmed) {
      const userID=friendRows[i].targetUserName;
      const userName=friendRows[i].targetFullName;
      const userEmail=friendRows[i].targetEmail;
      const userFound=pageState.listDoc.sharedWith.find((element: string) => (element === userID));
      if (iAmListOwner) {
        usersElem.push(
          <IonItem key={pageState.selectedListID+"-"+userID}>
            <IonCheckbox key={pageState.selectedListID+"-"+userID} slot="start" onIonChange={(e: any) => selectUser(userID,Boolean(e.detail.checked))} checked={userFound}></IonCheckbox>
            <IonLabel>{userName}</IonLabel>
            <IonLabel>{userEmail}</IonLabel>
          </IonItem>)
      } else {
        if (userFound) {
          usersElem.push(
            <IonItem key={pageState.selectedListID+"-"+userID}>
              <IonLabel>{userName}</IonLabel>
              <IonLabel>{userEmail}</IonLabel>
            </IonItem>)
        }    
      }
    }
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
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
            {selectDropDown}
            <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" placeholder="<New>" onIonChange={(e: any) => updateName(e.detail.value)} value={(pageState.listDoc as any).name}></IonInput>
            </IonItem>
            <IonItemGroup key="userlist">
            <IonItem key="listowner">
              <IonLabel>{}</IonLabel>
            </IonItem>
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
