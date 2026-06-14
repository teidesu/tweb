import tsNow from '@helpers/tsNow';
import classNames from '@helpers/string/classNames';
import {AvatarNewTsx} from '@components/avatarNew';
import PopupElement, {createPopup} from '@components/popups/indexTsx';
import {RadioFormFromValues} from '@components/row';
import {MUTE_UNTIL} from '@appManagers/constants';
import {LangPackKey} from '@lib/langPack';
import rootScope from '@lib/rootScope';

import styles from '@components/popups/mute.module.scss';

const ONE_HOUR = 3600;
const TIMES: {value: number, langPackKey: LangPackKey, checked?: boolean}[] = [
  {value: ONE_HOUR, langPackKey: 'ChatList.Mute.1Hour'},
  {value: ONE_HOUR * 4, langPackKey: 'ChatList.Mute.4Hours'},
  {value: ONE_HOUR * 8, langPackKey: 'ChatList.Mute.8Hours'},
  {value: ONE_HOUR * 24, langPackKey: 'ChatList.Mute.1Day'},
  {value: ONE_HOUR * 24 * 3, langPackKey: 'ChatList.Mute.3Days'},
  {value: -1, langPackKey: 'ChatList.Mute.Forever', checked: true}
];

export default function showMutePopup(peerId: PeerId, threadId?: number) {
  const isSavedDialog = peerId === rootScope.myId && !!threadId;

  createPopup(() => {
    let time = -1;
    const radioForm = RadioFormFromValues(TIMES, (value: string) => {
      time = +value;
    }, true);

    return (
      <PopupElement class={classNames('popup-peer', styles.popup)}>
        <PopupElement.Header>
          <AvatarNewTsx
            peerId={isSavedDialog ? threadId : peerId}
            threadId={isSavedDialog ? undefined : threadId}
            isDialog
            meAsNotes={isSavedDialog}
            size={32}
          />
          <PopupElement.Title title="Notifications" />
        </PopupElement.Header>
        <PopupElement.Body>
          {radioForm}
        </PopupElement.Body>
        <PopupElement.Buttons>
          <PopupElement.Button
            langKey="ChatList.Context.Mute"
            callback={() => {
              rootScope.managers.appMessagesManager.mutePeer({
                peerId,
                muteUntil: time === -1 ? MUTE_UNTIL : tsNow(true) + time,
                threadId
              });
            }}
          />
          <PopupElement.Button langKey="Cancel" cancel />
        </PopupElement.Buttons>
      </PopupElement>
    );
  });
}
