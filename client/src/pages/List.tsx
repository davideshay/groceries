import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput,
   IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption,
   IonReorder, IonReorderGroup,ItemReorderEventDetail, IonButtons, IonMenuButton, 
   useIonToast, IonFooter, IonIcon, useIonAlert, IonText, useIonLoading } from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { useUpdateGenericDocument, useCreateGenericDocument, useGetOneDoc,
   useDeleteGenericDocument, useDeleteListFromItems, useAddListToAllItems } from '../components/Usehooks';
import { cloneDeep, isEmpty } from 'lodash';
import './List.css';
import { RemoteDBStateContext } from '../components/RemoteDBState';
import { PouchResponse, HistoryProps, ListRow, RowType, ListCombinedRows } from '../components/DataTypes';
import { ListDocInit, ListDoc, CategoryDoc, ListDocs } from '../components/DBSchema'
import SyncIndicator from '../components/SyncIndicator';
import { closeCircleOutline, saveOutline, trashOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';
import { translatedCategoryName } from '../components/translationUtilities';
import { log } from "../components/Utilities";

interface PageState {
  needInitListDoc: boolean,
  listDoc: ListDoc,
  selectedListID: string,
  listGroupID: string | null,
  listGroupOwner: string | null,
  changesMade: boolean,
  deletingDoc: boolean
}

enum ErrorLocation  {
   Name, General
}
const FormErrorInit = { [ErrorLocation.Name]:       {errorMessage:"", hasError: false},
                        [ErrorLocation.General]:    {errorMessage:"", hasError: false}
                    }

const List: React.FC<HistoryProps> = (props: HistoryProps) => {
  let { mode, id: routeID } = useParams<{mode: string, id: string}>();
  if ( mode === "new" ) { routeID = "<new>"};
  const [pageState,setPageState] = useState<PageState>({
    needInitListDoc: (mode === "new") ? true : false,
    listDoc: cloneDeep(ListDocInit),
    selectedListID: routeID,
    listGroupID: null,
    listGroupOwner: null,
    changesMade: false,
    deletingDoc: false
  })
  const [formErrors,setFormErrors] = useState(FormErrorInit);
  const updateListWhole  = useUpdateGenericDocument();
  const createList = useCreateGenericDocument();
  const deleteList = useDeleteGenericDocument();
  const deleteListFromItems = useDeleteListFromItems();
  const addListToAllItems = useAddListToAllItems();
  const { remoteDBState, remoteDBCreds } = useContext(RemoteDBStateContext);
  const [ presentToast ] = useIonToast();
  const { listError, listDocs, listsLoading, listRowsLoaded, listRows, listCombinedRows,
          categoryDocs, categoryLoading, categoryError } = useContext(GlobalDataContext);
  const { loading: listGroupLoading, doc: listGroupDoc, dbError: listGroupError} = useGetOneDoc(pageState.listGroupID);
  const [presentAlert] = useIonAlert();
  const screenLoading = useRef(true);
  const history = useHistory();
  const [presentDeleting,dismissDeleting] = useIonLoading();
  const { t } = useTranslation();

  useEffect( () => {
    setPageState(prevState => ({...prevState,selectedListID: routeID}))
  },[routeID])

  useEffect( () => {
    if (!listsLoading && listRowsLoaded && !categoryLoading) {
      if (mode === "new" && pageState.needInitListDoc) {
        let initListDoc : ListDoc = cloneDeep(ListDocInit);
        let newListGroupOwner: string|null = null;
        if (listCombinedRows.length > 0) {
          for (let i = 0; i <  listCombinedRows.length; i++) {
            const lcr = listCombinedRows[i];
            if (!lcr.hidden && !lcr.listGroupRecipe && lcr.rowType==="G") {
              initListDoc.listGroupID=String(lcr.listGroupID);
              newListGroupOwner=lcr.listGroupOwner;
              break;
            }
          }
        } else {
          initListDoc.listGroupID=null
        }
        let initCategories= categoryDocs.length > 0 ? categoryDocs.filter(cat => (["system",initListDoc.listGroupID].includes(cat.listGroupID))).map(cat => String(cat._id)) : [];
        initListDoc.categories = initCategories;
        setPageState(prevState => ({...prevState,listDoc: initListDoc,listGroupID: initListDoc.listGroupID, listGroupOwner: newListGroupOwner, needInitListDoc: false, changesMade: false}))
      }
      else if (mode !== "new") {
        let newListRow: ListRow = cloneDeep(listRows.find((lr: ListRow) => lr.listDoc._id === pageState.selectedListID));
        if (newListRow === undefined) {return}
        setPageState(prevState => ({...prevState,listDoc: newListRow.listDoc, listGroupID: newListRow.listGroupID, listGroupOwner: newListRow.listGroupOwner, changesMade: false}))
      }
    }
  },[listsLoading, listRowsLoaded, listGroupLoading, listDocs, listRows, pageState.needInitListDoc, listCombinedRows, mode, listGroupDoc, categoryLoading,categoryDocs,pageState.selectedListID, remoteDBState.accessJWT]);

  if (listError || listGroupError || categoryError) {
    screenLoading.current=false;
    return (
    <ErrorPage errorText={t("error.loading_list_info") as string}></ErrorPage>
  )}

  if (listsLoading || !listRowsLoaded || categoryLoading || isEmpty(pageState.listDoc) || (listGroupLoading && pageState.listGroupID !== null) || pageState.deletingDoc)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_list")} /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current = false;

  function changeListUpdateState(listID: string) {
    setPageState(prevState => ({...prevState,
        listDoc: (cloneDeep((listDocs as ListDocs).find((el: ListDoc) => el._id === listID))) as ListDoc,
        selectedListID: listID}))
    history.push('/list/edit/'+listID);    
  }

  async function updateThisItem() {
    setFormErrors(prevState=>(FormErrorInit));
    if (pageState.listDoc.name === "" || pageState.listDoc.name === undefined || pageState.listDoc.name === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.must_enter_a_name"), hasError: true }}));
      return false;
    }
//    log.debug("listRows:",listRows,"page name",pageState.listDoc.name,"filtered",listRows.filter(lr => (lr.listDoc.name.toUpperCase() === pageState.listDoc.name && lr.listDoc._id !== pageState.listDoc._id)));
    if (listRows.filter(lr => (lr.listDoc.name.toUpperCase() === pageState.listDoc.name.toUpperCase() && lr.listGroupID === pageState.listDoc.listGroupID && lr.listDoc._id !== pageState.listDoc._id)).length > 0) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.Name]: {errorMessage: t("error.list_already_exists"), hasError: true }}));
      return false;
    }
    if (pageState.listGroupID === null) {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.must_select_valid_listgroup_id"), hasError: true }}));
      return false;
    }
    let response: PouchResponse;
    if (mode === "new") {
      response = await createList(pageState.listDoc);
      if (response.successful) {
        let addedToItems = addListToAllItems({listGroupID: String(pageState.listGroupID) ,listID: response.pouchData.id as string, listDocs: listDocs})
        if (!addedToItems) {response.successful = false;}
      }
    }
    else {
      response = await updateListWhole(pageState.listDoc);
    }
    if (response.successful) {
      history.goBack();  // back("lists")
    } else {
      presentToast({message: t("error.creating_updating_list"), duration: 1500, position: "middle"});
    }
  }

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    // The `from` and `to` properties contain the index of the item
    // when the drag started and ended, respectively
    log.debug("called with event:",event.detail);
    let newPageState=cloneDeep(pageState);
    log.debug("curr categories:",cloneDeep(pageState.listDoc.categories));
    newPageState.listDoc.categories.splice(event.detail.to,0,newPageState.listDoc.categories.splice(event.detail.from,1)[0]);
    log.debug("updated state categories",cloneDeep(newPageState.listDoc.categories));
    newPageState.changesMade=true;
    setPageState(newPageState);

    // Finish the reorder and position the item in the DOM based on
    // where the gesture ended. This method can also be called directly
    // by the reorder group
    event.detail.complete();
  }

  function updateCat(categoryID: string, updateVal: boolean) {
    const currCategories: string[] =[];
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
    setPageState(prevState => (
      {...prevState, changesMade: true, listDoc: {...prevState.listDoc, categories: currCategories}}))

  }

  function updateName(updName: string) {
    if (pageState.listDoc.name !== updName) {
      setPageState(prevState => (
        {...prevState, changesMade: true, listDoc: {...prevState.listDoc, name: updName}}));
    }  
  }

  function getNewCategories(existingCategories: string[],newListGroupID: string) {
    let newCategories: string[] = [];
    for (let i = 0; i < existingCategories.length; i++) {
      const existingCat = existingCategories[i];
      if (categoryDocs.filter(cat => (["system",newListGroupID].includes(String(cat.listGroupID)))).map(cat => (String(cat._id))).includes(existingCat)) {
        newCategories.push(existingCat);
      }
    }
    return newCategories;
  }

  function updateListGroup(updGroup: string) {
    if (pageState.listGroupID !== updGroup) {
      let newCategories = getNewCategories(pageState.listDoc.categories,updGroup);
      setPageState(prevState => ({...prevState, changesMade: true, listDoc: {...prevState.listDoc, categories: newCategories, listGroupID: updGroup}, listGroupID: updGroup}))
    }
  }

async function deleteListFromDB() {
  presentDeleting(String(t("general.deleting_list")));
  let response = await deleteListFromItems(String(pageState.selectedListID));
  if (response.successful) {
    let delResponse = await deleteList((pageState.listDoc));
    if (delResponse.successful) {
      dismissDeleting();
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      history.goBack(); // back to "list"
    } else {
      setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.could_not_delete_list"), hasError: true }}));
      setPageState(prevState => ({...prevState,deletingDoc: false}));
      dismissDeleting();
    }

  } else {
    setFormErrors(prevState => ({...prevState,[ErrorLocation.General]: {errorMessage: t("error.unable_remove_list_all_items"), hasError: true }}));
    setPageState(prevState => ({...prevState,deletingDoc: false}));
    dismissDeleting();
  }
}

function deletePrompt() {
  setPageState(prevState => ({...prevState,deletingDoc: true}));
  presentAlert({
    header: t("general.delete_this_list",{list: pageState.listDoc.name}),
    subHeader: t("general.really_delete_list_extended"),
    buttons: [ { text: t("general.cancel"), role: "Cancel" ,
                handler: () => setPageState(prevState => ({...prevState,deletingDoc: false}))},
               { text: t("general.delete"), role: "confirm",
                handler: () => deleteListFromDB()}]
  })
}

  let categoryElem=[];
  let categoryLines=[];

  function catItem(id: string, active: boolean) {
    const actname=active ? "active" : "inactive"
    const catDoc : CategoryDoc | undefined = (categoryDocs as CategoryDoc[]).find(element => (element._id === id))
    if (catDoc !== undefined) {
      let name = translatedCategoryName((catDoc as CategoryDoc)._id,(catDoc as CategoryDoc).name);
      return (
        <IonItem key={pageState.selectedListID+"-"+actname+"-"+id} slot="start">
            <IonCheckbox justify="start" key={pageState.selectedListID+"-"+actname+"-"+id} onIonChange={(e) => updateCat(id,Boolean(e.detail.checked))} checked={active}></IonCheckbox>
            {name}
            <IonReorder slot="end"></IonReorder>
        </IonItem>)    
    } else {
      log.error("Cat doc not defined: id:",id);
      return(
      <IonItem key={pageState.selectedListID+"-"+actname+"-"+id}>
          <IonButton fill="clear">{t("general.undefined")}</IonButton>
          <IonReorder slot="end"></IonReorder>
      </IonItem>)
    }
  }

  function catItemDivider(active: boolean, lines: JSX.Element[]) {
    const actname=active ? t("general.active") : t("general.inactive")
    return (
      <div key={actname+"-div"}>
      <IonItemDivider key={actname} className="category-divider"><IonLabel>{actname}</IonLabel></IonItemDivider>
      <IonReorderGroup key={actname+"-reorder-group"} disabled={false} onIonItemReorder={handleReorder}>
          {lines}
      </IonReorderGroup>
      </div>  
    )   
  }
  
  for (let i = 0; i < pageState.listDoc.categories.length; i++) {
    let validList = (categoryDocs as CategoryDoc[]).find((cat) => pageState.listDoc.categories[i] === cat._id);
    if (validList !== undefined) {
      categoryLines.push(catItem(pageState.listDoc.categories[i],true));
    }  
  }
  categoryElem.push(catItemDivider(true,categoryLines));
  categoryLines=[];
  for (const category of categoryDocs.filter(cat => (["system",pageState.listGroupID].includes(cat.listGroupID)))) {
    const inList = pageState.listDoc.categories.includes(String(category._id));
    if (!inList) {
      categoryLines.push(catItem(String(category._id),false))
    }
  }
  if (categoryLines.length > 0) {
    categoryElem.push(catItemDivider(false,categoryLines));
  } 

  let selectOptionListElem=(
    listRows.map((list: ListRow) => (
      <IonSelectOption key={"list-"+list.listDoc._id} value={list.listDoc._id}>
        {list.listDoc.name}
      </IonSelectOption>
    )))

  let selectElem=[];
  if (pageState.changesMade) {
    let alertOptions={
      header: t("general.changing_selected_list"),
      message: t("general.list_updated_not_saved_still_change")
    }
    selectElem.push(
      <IonSelect label={t("general.editing_list")+":"} key="list-changed" interface="alert" interfaceOptions={alertOptions}
        onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    )  
  } else {
    let iopts={};
    selectElem.push(
      <IonSelect label={t("general.editing_list")+":"} key="list-notchanged" interface="popover" interfaceOptions={iopts} onIonChange={(ev) => changeListUpdateState(ev.detail.value)} value={pageState.selectedListID}>
        {selectOptionListElem}
      </IonSelect>
    ) 
  }
  
  let selectDropDown = [];
    if (mode === "new") {
      selectDropDown.push(<IonTitle className="ion-no-padding" key="createnew">{t("general.creating_new_list")}</IonTitle>)
    } else {  
      selectDropDown.push(
        <IonTitle className="ion-no-padding" key="editexisting">
        <IonItem key="editexistingitem">
        {selectElem}
        </IonItem>
        </IonTitle>
    )
  }

  let updateButton=[];
  if (mode === "new") {
    updateButton.push(<IonButton color="primary" slot="end" fill="solid" key="add" onClick={() => updateThisItem()}>{t("general.add")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  } else {
    updateButton.push(<IonButton color="primary" slot="end" fill="solid" key="save" onClick={() => updateThisItem()}>{t("general.save")}<IonIcon slot="start" icon={saveOutline}></IonIcon></IonButton>)
  }

  let deleteButton=[];
  if (pageState.listGroupOwner===remoteDBCreds.dbUsername) {
    deleteButton.push(<IonButton fill="outline" color="danger"  key="delete" onClick={() => deletePrompt()}>{t("general.delete")}<IonIcon slot="start" icon={trashOutline}></IonIcon></IonButton>)
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
            {selectDropDown}
            <SyncIndicator addPadding={true}/>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
          <IonList className="ion-no-padding">
            <IonItem key="name">
              <IonInput label={t("general.name") as string} labelPlacement="stacked" type="text" placeholder={t("general.new_placeholder") as string}
                        onIonInput={(e) => updateName(String(e.detail.value))} value={pageState.listDoc.name}
                        className={"ion-touched "+(formErrors[ErrorLocation.Name].hasError ? "ion-invalid": "")}
                        errorText={formErrors[ErrorLocation.Name].errorMessage}>
              </IonInput>
            </IonItem>
            <IonItem key="listgroup">
              <IonSelect disabled={mode!=="new"} key="listgroupsel" label={t("general.list_group") as string} labelPlacement='stacked' interface="popover" onIonChange={(e) => updateListGroup(e.detail.value)} value={pageState.listDoc.listGroupID}>
                { (cloneDeep(listCombinedRows) as ListCombinedRows).filter(lr => (lr.rowType === RowType.listGroup && !lr.hidden && !lr.listGroupRecipe)).map((lr) => 
                  ( <IonSelectOption key={lr.rowKey} value={lr.listGroupID}>{lr.listGroupName}</IonSelectOption> )
                )}
              </IonSelect>
            </IonItem>
            <IonItemGroup key="categorylist">
            {categoryElem}
            </IonItemGroup>
          </IonList>
      </IonContent>
      <IonFooter className="floating-error-footer">
        {
          formErrors[ErrorLocation.General].hasError ? <IonItem className="shorter-item-some-padding" lines="none"><IonText color="danger">{formErrors[ErrorLocation.General].errorMessage}</IonText></IonItem> : <></>
        }  
        <IonToolbar>
          <IonButtons slot="start">
            {deleteButton}
          </IonButtons>
          <IonButtons slot="secondary">
            <IonButton key="back" fill="outline"  color="secondary" onClick={() => history.goBack()}>{t("general.cancel")}<IonIcon slot="start" icon={closeCircleOutline}></IonIcon></IonButton>  
          </IonButtons>
          <IonButtons slot="end">  
            {updateButton}
          </IonButtons>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default List;
