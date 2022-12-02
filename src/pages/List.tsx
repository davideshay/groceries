import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption, NavContext } from '@ionic/react';
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
  const updateListWhole  = useUpdateListWhole();

  const { doc: listDoc, loading: listLoading, state: listState, error: listError } = useDoc(match.params.id);

  const { docs: userDocs, loading: userLoading, error: userError} = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "user", name: { $exists: true} },
    sort: [ "type","name"]
  });

  const {goBack} = useContext(NavContext);

  useEffect( () => {
    if (!listLoading && !userLoading) {
      setStateListDoc(listDoc as any);
      setDoingUpdate(false);
    }
  },[listLoading,listDoc,userLoading,userDocs]);

  if (listLoading || userLoading || doingUpdate || isEmpty(stateListDoc))  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  console.log("after loading",{listLoading,userLoading,doingUpdate,stateListDoc,userDocs});

  function updateThisItem() {
    setDoingUpdate(true);
    updateListWhole(stateListDoc);
    goBack("/lists");
  }

  function selectUser(userID: string, updateVal: boolean) {
    const currUsers=[];
    let foundIt=false;
    console.log(stateListDoc);
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
    console.log({userID,userName,userEmail,userFound})
    usersElem.push(
      <IonItem key={userID}>
        <IonCheckbox slot="start" onIonChange={(e: any) => selectUser(userID,Boolean(e.detail.checked))} checked={userFound}></IonCheckbox>
        <IonLabel>{userName}</IonLabel>
        <IonLabel>{userEmail}</IonLabel>
      </IonItem>
    )
  }
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Editing List: {(stateListDoc as any).name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Editing List: {(stateListDoc as any).name}</IonTitle>
          </IonToolbar>
        </IonHeader>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setStateListDoc({...stateListDoc, name: e.detail.value})} value={(stateListDoc as any).name}></IonInput>
            </IonItem>
            <IonItemGroup key="userlist">
            {usersElem}
            </IonItemGroup>
          </IonList>
          <IonButton onClick={() => updateThisItem()}>Update</IonButton>
          <IonButton onClick={() => goBack("/lists")}>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default List;
