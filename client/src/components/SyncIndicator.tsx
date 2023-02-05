import { IonIcon, IonButton , NavContext} from '@ionic/react';
import { cloudDoneOutline, cloudDownloadOutline, cloudOfflineOutline, warningOutline } from 'ionicons/icons';
import { useContext } from 'react';
import { RemoteDBState, RemoteDBStateContext, RemoteDBStateContextType, SyncStatus } from '../components/RemoteDBState';
import { useConflicts } from './Usehooks';
import { HistoryProps } from './DataTypes';

const SyncIndicator: React.FC<HistoryProps> = (props: HistoryProps) => {
    const { remoteDBState } = useContext(RemoteDBStateContext);
    const { conflictDocs, conflictsLoading } = useConflicts();

    const iconSize="medium"
    let iconElem;
    switch (remoteDBState.syncStatus) {
        case SyncStatus.active:
            iconElem=(<IonIcon slot="end" size={iconSize} icon={cloudDownloadOutline} />)
            break;
        case SyncStatus.paused:
            iconElem=(<IonIcon slot="end" size={iconSize} icon={cloudDoneOutline} />)
            break;
        default:
            iconElem=(<IonIcon slot="end" size={iconSize} icon={cloudOfflineOutline} />)
            break;
    }
    let conflictElem;
    if (!conflictsLoading) {
        if (conflictDocs.length > 0)
        conflictElem=(<IonButton slot="end" fill="default" onClick={() => props.history.push("/conflictlog")}><IonIcon slot="end" size={iconSize} icon={warningOutline} /></IonButton>)
    }

    return (<>{conflictElem}{iconElem}</>)
} 

export default SyncIndicator;