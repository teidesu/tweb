import type { MyDocument } from '@/lib/appManagers/appDocsManager';
import type { MyMessage } from '@/lib/appManagers/appMessagesManager';
import { Message, MessageMedia } from '@/layer';

export default function isMentionUnread(message: MyMessage) {
  if (!message) {
    return false;
  }

  const doc = ((message as Message.message).media as MessageMedia.messageMediaDocument)?.document as MyDocument;
  return !!(
    message.pFlags.media_unread &&
    message.pFlags.mentioned &&
    (
      !doc ||
      !(['voice', 'round'] as MyDocument['type'][]).includes(doc.type)
    )
  );
}
