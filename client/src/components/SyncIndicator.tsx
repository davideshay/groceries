import { IonIcon, IonButton } from '@ionic/react';
import { cloudDoneOutline, cloudDownloadOutline, cloudOfflineOutline, warningOutline } from 'ionicons/icons';
import { useContext } from 'react';
import { RemoteDBStateContext, SyncStatus } from '../components/RemoteDBState';
import { useConflicts } from './Usehooks';
import { useHistory } from 'react-router';

const SyncIndicator: React.FC = () => {
    const { remoteDBState } = useContext(RemoteDBStateContext);
    const { conflictDocs, conflictsLoading } = useConflicts();
    const history = useHistory()

    const iconSize="medium"
    let iconElem;
    switch (remoteDBState.syncStatus) {
        case SyncStatus.active:
            iconElem=(<IonIcon slot="end" className="ion-no-margin ion-margin-start" size={iconSize} icon={cloudDownloadOutline} />)
            break;
        case SyncStatus.paused:
            iconElem=(<IonIcon slot="end" className="ion-no-margin ion-margin-start" size={iconSize} icon={cloudDoneOutline} />)
            break;
        default:
            iconElem=(<IonIcon slot="end" className="ion-no-margin ion-margin-start" size={iconSize} icon={cloudOfflineOutline} />)
            break;
    }
    let conflictElem;
    if (!conflictsLoading) {
        if (conflictDocs.length > 0)
        conflictElem=(<IonButton slot="end" fill="default" onClick={() => history.push("/conflictlog")}><IonIcon slot="end" size={iconSize} icon={warningOutline} /></IonButton>)
    }

    return (<>{conflictElem}{iconElem}</>)
} 

export default SyncIndicator;