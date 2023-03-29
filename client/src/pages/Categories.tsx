import { IonContent, IonPage, IonList, IonItem, IonFab,
     IonFabButton, IonIcon } from '@ionic/react';
import { useContext, useRef } from 'react';
import { add } from 'ionicons/icons';
import { HistoryProps } from '../components/DataTypes';
import { CategoryDoc } from '../components/DBSchema';
import './Categories.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import PageHeader from '../components/PageHeader';

const Categories: React.FC<HistoryProps> = (props: HistoryProps) => {
  const globalData = useContext(GlobalDataContext);
  const screenLoading=useRef(true);

  if (globalData.categoryError !== null) { return (
    <ErrorPage errorText="Error Loading Category Information... Restart."></ErrorPage>

  )}

  if (globalData.categoryLoading) { 
    return ( <Loading isOpen={screenLoading.current} message="Loading Categories..." /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }

  screenLoading.current=false;

  (globalData.categoryDocs as CategoryDoc[]).sort(function(a,b) {
    return a.name.toUpperCase().localeCompare(b.name.toUpperCase())
  })

  return (
    <IonPage>
      <PageHeader title="Categories" />
      <IonContent>
        <IonList lines="full">
               {(globalData.categoryDocs as CategoryDoc[]).map((doc) => (
                  <IonItem class="list-button" key={doc._id} routerLink={("/category/edit/" + doc._id)}>{doc.name}</IonItem>
            ))}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/category/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default Categories;
