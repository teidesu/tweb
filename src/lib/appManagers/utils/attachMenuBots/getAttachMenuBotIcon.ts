import { AttachMenuBot } from '@/layer';
import { ATTACH_MENU_BOT_ICON_NAME } from '@/lib/appManagers/constants';

export default function getAttachMenuBotIcon(attachMenuBot: AttachMenuBot) {
  if (!attachMenuBot) {
    return;
  }

  return attachMenuBot.icons.find((icon) => icon.name === ATTACH_MENU_BOT_ICON_NAME);
}
