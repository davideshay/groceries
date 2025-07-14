import { IonHeader, IonPage, IonTitle, IonToolbar, IonContent,IonItem } from '@ionic/react';
import { t } from 'i18next';

interface ErrorOptionalProps  {
    errorTitle: string;
    errorText: string
};

type ErrorProps  = ErrorOptionalProps;

const defaultProps: ErrorOptionalProps = {
    errorTitle: t("error.error"),
    errorText: t("error.error_in_application")
}

const ErrorPage = (props: ErrorProps) => {
    const { errorTitle, errorText } = props;

    return(
    <IonPage>
        <IonHeader><IonToolbar><IonTitle>{errorTitle}</IonTitle></IonToolbar></IonHeader>
    <IonContent><IonItem>{errorText}</IonItem></IonContent>
    </IonPage>
    )
}

ErrorPage.defaultProps=defaultProps;

export default ErrorPage;