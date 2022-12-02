import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonSelectOption, NavContext } from '@ionic/react';
import { add } from 'ionicons/icons';
import { RouteComponentProps } from 'react-router-dom';
import { useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useUpdateCategory } from '../components/itemhooks';
import { cloneDeep } from 'lodash';
import './Category.css';

interface CategoryPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Category: React.FC<CategoryPageProps> = ({ match }) => {

  const [stateCategoryDoc,setStateCategoryDoc] = useState<any>({});
  const updateCategory  = useUpdateCategory();

  const { doc: categoryDoc, loading: categoryLoading, state: categoryState, error: categoryError } = useDoc(match.params.id);

  const {goBack} = useContext(NavContext);

  useEffect( () => {
    if (!categoryLoading) {
      setStateCategoryDoc(categoryDoc as any);
    }
  },[categoryLoading,categoryDoc]);

  if ( categoryLoading )  {return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  function updateThisCategory() {
    updateCategory(stateCategoryDoc);
    goBack("/lists");
  }
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Editing Category: {(stateCategoryDoc as any).name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Editing Category: {(stateCategoryDoc as any).name}</IonTitle>
          </IonToolbar>
        </IonHeader>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setStateCategoryDoc({...stateCategoryDoc, name: e.detail.value})} value={(stateCategoryDoc as any).name}></IonInput>
            </IonItem>
          </IonList>
          <IonButton onClick={() => updateThisCategory()}>Update</IonButton>
          <IonButton onClick={() => goBack("/categories")}>Cancel</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Category;
