import { IonIcon } from '@ionic/react';
import { cloudDoneOutline, cloudDownloadOutline, cloudOfflineOutline } from 'ionicons/icons';
import { useContext } from 'react';
import { RemoteDBState, RemoteDBStateContext, RemoteDBStateContextType, SyncStatus } from '../components/RemoteDBState';


const SyncIndicator: React.FC = () => {
    const { remoteDBState } = useContext(RemoteDBStateContext);

    let iconElem;
    switch (remoteDBState.syncStatus) {
        case SyncStatus.active:
            iconElem=(<IonIcon slot="end" size="large" icon={cloudDownloadOutline} />)
            break;
        case SyncStatus.paused:
            iconElem=(<IonIcon slot="end" size="large" icon={cloudDoneOutline} />)
            break;
        default:
            iconElem=(<IonIcon slot="end" size="large" icon={cloudOfflineOutline} />)
            break;
    }

    return (iconElem)
} 

export default SyncIndicator;