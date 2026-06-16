import safeWindowOpen from '@/helpers/dom/safeWindowOpen';
import I18n, { i18n } from '@/lib/langPack';
import confirmationPopup from '@/components/confirmationPopup';
import styles from '@/components/popups/sponsored.module.scss';

export default function showSponsoredPopup() {
  const readMore = { langKey: 'Chat.Message.Ad.ReadMore' } as const;
  confirmationPopup({
    titleLangKey: 'Chat.Message.Sponsored.What',
    descriptionLangKey: 'Chat.Message.Ad.Text',
    descriptionLangArgs: [i18n('Chat.Message.Sponsored.Link')],
    button: readMore,
    buttons: [{ langKey: 'OK', isCancel: true }, readMore],
    className: styles.popup,
    scrollable: true,
  }).then(() => {
    safeWindowOpen(I18n.format('Chat.Message.Sponsored.Link', true));
  }, () => {});
}
