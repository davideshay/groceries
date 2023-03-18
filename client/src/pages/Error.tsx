import { IonHeader, IonPage, IonTitle, IonToolbar, IonLoading, IonContent,IonItem } from '@ionic/react';

interface ErrorRequiredProps {

};

interface ErrorOptionalProps  {
    errorTitle: string;
    errorText: string
};

interface ErrorProps extends ErrorRequiredProps, ErrorOptionalProps {};

const defaultProps: ErrorOptionalProps = {
    errorTitle: "Error...",
    errorText: "Error in Application. Restart."
}

const Error = (props: ErrorProps) => {
    const { errorTitle, errorText } = props;

    return(
    <IonPage>
        <IonHeader><IonToolbar><IonTitle>{errorTitle}</IonTitle></IonToolbar></IonHeader>
    <IonContent><IonItem>{errorText}</IonItem></IonContent>
    </IonPage>
    )
}

Error.defaultProps=defaultProps;

export default Error;