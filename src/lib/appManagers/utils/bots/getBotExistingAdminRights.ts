import { ChannelParticipant, Chat, ChatParticipant } from '@/layer';
import { CHAT_LEGACY_ADMIN_RIGHTS } from '@/lib/appManagers/utils/chats/constants';
import { isParticipantAdmin } from '@/lib/appManagers/utils/chats/isParticipantAdmin';
import mergeBotAdminRights from '@/lib/appManagers/utils/bots/mergeBotAdminRights';

export default function getBotExistingAdminRights(
  chat: Chat.chat | Chat.channel,
  participant: ChatParticipant | ChannelParticipant
) {
  if (!isParticipantAdmin(participant)) {
    return;
  }

  return mergeBotAdminRights(chat._ === 'chat' ?
    CHAT_LEGACY_ADMIN_RIGHTS :
    (participant as ChannelParticipant.channelParticipantAdmin | ChannelParticipant.channelParticipantCreator).admin_rights
  );
}
