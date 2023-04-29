import { IonContent, IonPage, IonButton, IonList, 
 IonItem, NavContext, IonIcon, IonToolbar, IonButtons, IonSelect, IonSelectOption, useIonAlert} from '@ionic/react';
import { useState,  useContext, useRef } from 'react';
import { useItems } from '../components/Usehooks';
import { HistoryProps, RowType, RecipeFileTypes } from '../components/DataTypes';
import { returnDownBackOutline } from 'ionicons/icons';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';
import { FilePicker, PickFilesResult } from '@capawesome/capacitor-file-picker';
import { Filesystem } from '@capacitor/filesystem';
import {useProcessInputFile } from '../components/importUtiliites';

type PageState = {
  recipeFormat: string,
  formError: string,
}

const RecipeImport: React.FC<HistoryProps> = (props: HistoryProps) => {
  const [pageState, setPageState] = useState<PageState>({
      recipeFormat:"tandoor", formError: ""
  })
  const { dbError: itemError, itemRowsLoaded } = useItems({selectedListGroupID: null, isReady: true, 
        needListGroupID: false, activeOnly: false, selectedListID: null, selectedListType: RowType.list});
  const {goBack} = useContext(NavContext);
  const screenLoading = useRef(true);
  const globalData = useContext(GlobalDataContext);
  const { t } = useTranslation();
  const processInputFile = useProcessInputFile();

  if ( globalData.listError || itemError ){ return (
    <ErrorPage errorText={t("error.loading_recipe_import") as string}></ErrorPage>
    )};

  if (  globalData.categoryLoading || !globalData.listRowsLoaded || !itemRowsLoaded)  {
    return ( <Loading isOpen={screenLoading.current} message={t("general.loading_recipe_import")} />)
//    setIsOpen={() => {screenLoading.current = false}} /> )
  };
  
  screenLoading.current=false;

  async function pickImportFile() {
    setPageState(prevState => ({...prevState,formError:""}));
    const fileType = RecipeFileTypes.find((ft) =>(ft.type === pageState.recipeFormat));
    if (fileType === undefined) return;
    let permissions = await Filesystem.requestPermissions();
    let pickResults: PickFilesResult|undefined = undefined;
    let pickSuccessful = true;
    try {pickResults = await FilePicker.pickFiles({
//      types: [ fileType.type ],
      multiple: false,
      readData: true
      }) }
    catch(err) {pickSuccessful = false;}
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

  let jsonFormatOptions: JSX.Element[] = [];
  RecipeFileTypes.forEach((it) => {
    jsonFormatOptions.push(
      <IonSelectOption key={it.type} value={it.type}>{t("general.recipe_import_type_"+it.type)}</IonSelectOption>
    )
  })
  
  return (
    <IonPage>
      <PageHeader title={t("general.importing_recipe")} />
      <IonContent>
          <IonList>
            <IonItem key="filetype">
              <IonSelect label={t("general.recipe_import_type") as string} interface="popover" onIonChange={(ev) => {setPageState(prevState=>({...prevState,recipeFormat:ev.detail.value}))}} value={pageState.recipeFormat}>
                  {jsonFormatOptions}
              </IonSelect>
            </IonItem>
            <IonItem key="fileimport">
              <IonButton onClick={() => pickImportFile()}>{t('general.import_file')}</IonButton>
            </IonItem>
          </IonList>
          <IonItem>{pageState.formError}</IonItem>
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
