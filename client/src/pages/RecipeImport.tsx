import { IonContent, IonPage, IonButton, IonList, 
 IonItem, NavContext, IonIcon, IonToolbar, IonButtons, IonSelect, IonSelectOption, IonText} from '@ionic/react';
import { useState,  useContext, useRef, JSX } from 'react';
import { useItems } from '../components/Usehooks';
import { HistoryProps, RowType, RecipeFileTypes } from '../components/DataTypes';
import { returnDownBackOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { FilePicker, PickFilesResult } from '@capawesome/capacitor-file-picker';
import { Filesystem } from '@capacitor/filesystem';
import {useProcessInputFile } from '../components/importUtilities';
import { useGlobalDataStore } from '../components/GlobalData';

type PageState = {
  recipeFormat: string,
  formError: string,
}

const RecipeImport: React.FC<HistoryProps> = () => {
  const [pageState, setPageState] = useState<PageState>({
      recipeFormat:"tandoor", formError: ""
  })
  const { dbError: itemError, itemRowsLoaded } = useItems({selectedListGroupID: null, isReady: true, 
        needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const error = useGlobalDataStore((state) => state.error);
  const isLoading = useGlobalDataStore((state) => state.isLoading);
  const listRowsLoaded = useGlobalDataStore((state) => state.listRowsLoaded);
  const { t } = useTranslation();
  const processInputFile = useProcessInputFile();

  if ( error || itemError ){ return (
    <ErrorPage errorText={t("error.loading_recipe_import") as string}></ErrorPage>
    )};

  if (  isLoading || !listRowsLoaded || !itemRowsLoaded)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_recipe_import")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function pickImportFile() {
    setPageState(prevState => ({...prevState,formError:""}));
    const fileType = RecipeFileTypes.find((ft) =>(ft.type === pageState.recipeFormat));
    if (fileType === undefined) return;
    await Filesystem.requestPermissions();
    let pickResults: PickFilesResult|undefined = undefined;
    let pickSuccessful = true;
    try {pickResults = await FilePicker.pickFiles({
//      types: [ fileType.type ],
      limit: 1,
      readData: true
      }) }
    catch {pickSuccessful = false;}
    if (!pickSuccessful || pickResults === undefined) {
      setPageState(prevState => ({...prevState,formError:t("error.picking_import_file")}))
      return;
    }  
    if (pickResults!.files.length < 1 || pickResults!.files.length > 1) {
      setPageState(prevState => ({...prevState,formError:t("error.no_import_file_selected")}))
      return;
    }
    const [success,statusMessage] = await processInputFile(fileType,pickResults);
    if (!success) {
      setPageState(prevState=>({...prevState,formError: statusMessage}));
    }
  }

  const jsonFormatOptions: JSX.Element[] = [];
  RecipeFileTypes.forEach((it) => {
    jsonFormatOptions.push(
      <IonSelectOption key={it.type} value={it.type}>{t("general.recipe_import_type_"+it.type)}</IonSelectOption>
    )
  })
  
  return (
    <IonPage>
      <PageHeader title={t("general.importing_recipe")} />
      <IonContent>
          <IonList className="ion-no-padding">
            <IonItem key="filetype">
              <IonSelect label={t("general.recipe_import_type") as string} interface="popover" onIonChange={(ev) => {setPageState(prevState=>({...prevState,recipeFormat:ev.detail.value}))}} value={pageState.recipeFormat}>
                  {jsonFormatOptions}
              </IonSelect>
            </IonItem>
            <IonItem key="fileimport">
              <IonButton onClick={() => pickImportFile()}>{t('general.import_file')}</IonButton>
            </IonItem>
          </IonList>
          <IonItem><IonText color="danger">{pageState.formError}</IonText></IonItem>
          <IonToolbar>
           <IonButtons slot="secondary">
           <IonButton fill="outline" color="secondary" onClick={() => goBack("/recipes")}><IonIcon slot="start" icon={returnDownBackOutline}></IonIcon>{t("general.go_back")}</IonButton>
          </IonButtons>
          </IonToolbar>
      </IonContent>
    </IonPage>
  );
};

export default RecipeImport;
