import { IonMenuToggle, IonItem, IonBadge } from "@ionic/react";
import { t } from "i18next";
import { useContext } from "react";
import { ResolvedFriendStatus } from "./DataTypes";
import { RemoteDBStateContext } from "./RemoteDBState";
import { useFriends, UseFriendState } from "./Usehooks";


function AppMenuFriendItem () {
    const {remoteDBCreds} = useContext(RemoteDBStateContext);
    const {useFriendState,friendRows} = useFriends(String(remoteDBCreds.dbUsername));

    let pendingCount=0;
    if (useFriendState === UseFriendState.rowsLoaded) {
        friendRows.forEach(friend => {
        if (friend.resolvedStatus === ResolvedFriendStatus.PendingConfirmation) {pendingCount++}
        })
    }  
    return (
        <IonMenuToggle key="Friends" autoHide={false}>
            <IonItem className="app-menu-item" key={"item-Friends"} routerLink="/friends">
                {(pendingCount > 0) ? <IonBadge slot="end">{pendingCount}</IonBadge> : <></>}
                {t('general.friends')}
            </IonItem>
        </IonMenuToggle>
    ) 
}

export default AppMenuFriendItem;