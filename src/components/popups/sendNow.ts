import confirmationPopup from '@/components/confirmationPopup';
import rootScope from '@/lib/rootScope';

export default function showSendNowPopup(peerId: PeerId, mids: number[], onConfirm?: () => void) {
  const isMultiple = mids.length > 1;
  confirmationPopup({
    title: `Send Message${isMultiple ? 's' : ''} Now`,
    description: isMultiple ? `Send ${mids.length} messages now?` : 'Send message now?',
    button: {
      langKey: 'Send',
    },
  }).then(() => {
    onConfirm?.();
    rootScope.managers.appMessagesManager.sendScheduledMessages(peerId, mids);
  }, () => {});
}
