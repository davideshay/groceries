import { IonIcon, IonButton } from '@ionic/react';
import { cloudDoneOutline, cloudDownloadOutline, cloudOfflineOutline, cloudUploadOutline, warningOutline } from 'ionicons/icons';
import { useContext } from 'react';
import { RemoteDBStateContext, SyncStatus } from '../components/RemoteDBState';
import { useConflicts } from './Usehooks';
import { useHistory } from 'react-router';
import "./SyncIndicator.css"

type SyncProps = {
    addPadding: boolean;
}

const SyncIndicator: React.FC<SyncProps> = (props: SyncProps) => {
    const { remoteDBState } = useContext(RemoteDBStateContext);
    const { conflictDocs, conflictsLoading } = useConflicts();
    const history = useHistory()

    const iconSize="medium";
    const syncIconBaseClass = "ion-no-margin ion-margin-start sync-icon "+(props.addPadding ? "sync-icon-padding" : "")
    const iconProps = {
        slot: "end",
        className: syncIconBaseClass,
        size: iconSize
    }
    let iconElem;
    switch (remoteDBState.syncStatus) {
        case SyncStatus.up:
            iconElem=(<IonIcon {...iconProps} icon={cloudUploadOutline} />)
            break;
        case SyncStatus.down:
            iconElem=(<IonIcon {...iconProps} icon={cloudDownloadOutline} />)
            break;
        case SyncStatus.active:
            iconElem=(<IonIcon {...iconProps} icon={cloudDownloadOutline} />)
            break;
        case SyncStatus.paused:
            iconElem=(<IonIcon {...iconProps} icon={cloudDoneOutline} />)
            break;
        default:
            iconElem=(<IonIcon {...iconProps} icon={cloudOfflineOutline} />)
            break;
    }
    let conflictElem;
    if (!conflictsLoading) {
        if (conflictDocs.length > 0)
        conflictElem=(<IonButton slot="end" fill="default" onClick={() => history.push("/conflictlog")}><IonIcon slot="end" size={iconSize} icon={warningOutline} className="warning-icon" /></IonButton>)
    }

    return (<>{conflictElem}{iconElem}</>)
} 

export default SyncIndicator;