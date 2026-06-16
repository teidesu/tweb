import { onCleanup, untrack, useContext } from 'solid-js';
import PopupElement, { createPopup, PopupContext } from '@/components/popups/indexTsx';
import PopupPayment from '@/components/popups/payment';
import { AvatarNewTsx } from '@/components/avatarNew';
import Button from '@/components/button';
import CheckboxField from '@/components/checkboxField';
import Row from '@/components/row';
import wrapPeerTitle from '@/components/wrappers/peerTitle';
import classNames from '@/helpers/string/classNames';
import { attachClickEvent } from '@/helpers/dom/clickEvent';
import paymentsWrapCurrencyAmount from '@/helpers/paymentsWrapCurrencyAmount';
import ListenerSetter from '@/helpers/listenerSetter';
import I18n, { i18n, _i18n } from '@/lib/langPack';
import { PremiumGiftCodeOption } from '@/layer';

import styles from '@/components/popups/giftPremium.module.scss';

export default async function showGiftPremiumPopup(peerId: PeerId, giftOptions: PremiumGiftCodeOption[]): Promise<void> {
  const peerTitleEl = await wrapPeerTitle({ peerId });

  function Inner() {
    const context = useContext(PopupContext);
    const managers = untrack(() => context!.managers);
    const listenerSetter = new ListenerSetter();

    const shortestOption = giftOptions.slice().sort((a, b) => a.months - b.months)[0];
    const wrapCurrency = (amount: number | string) =>
      paymentsWrapCurrencyAmount(amount, shortestOption.currency, false, true, true);

    const rows = giftOptions.map((giftOption, idx) => {
      let subtitle: HTMLElement = i18n('PricePerMonth', [wrapCurrency(+giftOption.amount / giftOption.months)]);
      if (giftOption !== shortestOption) {
        const span = document.createElement('span');
        const badge = document.createElement('span');
        badge.classList.add('popup-gift-premium-discount');
        const shortestAmount = +shortestOption.amount * giftOption.months / shortestOption.months;
        const discount = Math.round((1 - +giftOption.amount / shortestAmount) * 100);
        badge.textContent = '-' + discount + '%';
        span.append(badge, subtitle);
        subtitle = span;
      }

      const isYears = !(giftOption.months % 12);
      const checkboxField = new CheckboxField({
        checked: idx === 0,
        round: true,
        name: 'gift-months',
        asRadio: true,
      });

      const row = new Row({
        title: i18n(isYears ? 'Years' : 'Months', [isYears ? giftOption.months / 12 : giftOption.months]),
        checkboxField,
        clickable: true,
        subtitle,
        rightTextContent: wrapCurrency(giftOption.amount),
      });

      row.container.classList.add('popup-gift-premium-option');
      return row;
    });

    const form = document.createElement('form');
    form.classList.add('popup-gift-premium-options');
    form.append(...rows.map((row) => row.container));

    const buttonText = new I18n.IntlElement({
      key: 'GiftSubscriptionFor',
      args: [wrapCurrency(giftOptions[0].amount)],
    });

    const getSelectedOption = () => giftOptions[rows.findIndex((row) => row.checkboxField.checked)];

    listenerSetter.add(form)('change', () => {
      buttonText.compareAndUpdate({
        args: [wrapCurrency(getSelectedOption().amount)],
      });
    });

    const giftButton = Button('btn-primary popup-gift-premium-confirm shimmer');
    giftButton.append(buttonText.element);

    attachClickEvent(giftButton, async() => {
      const giftOption = getSelectedOption();
      PopupPayment.create({
        inputInvoice: {
          _: 'inputInvoicePremiumGiftCode',
          option: giftOption,
          purpose: {
            _: 'inputStorePaymentPremiumGiftCode',
            amount: giftOption.amount,
            currency: giftOption.currency,
            users: [await managers.appUsersManager.getUserInput(peerId.toUserId())],
          },
        },
      });
      context!.hide();
    }, { listenerSetter });

    onCleanup(() => listenerSetter.removeAll());

    const titleEl = document.createElement('span');
    _i18n(titleEl, 'GiftTelegramPremiumTitle');
    titleEl.classList.add(styles.title);

    const subtitleEl = i18n('GiftTelegramPremiumDescription', [peerTitleEl]);
    subtitleEl.classList.add(styles.subtitle);

    return (
      <>
        <PopupElement.Header>
          <PopupElement.CloseButton />
        </PopupElement.Header>
        <PopupElement.Body class={styles.body}>
          <AvatarNewTsx peerId={peerId} size={100} class={styles.avatar} />
          {titleEl}
          {subtitleEl}
          {form}
          {giftButton}
        </PopupElement.Body>
      </>
    );
  }

  createPopup(() => (
    <PopupElement class={classNames(styles.popup, 'popup-gift-premium')} closable>
      <Inner />
    </PopupElement>
  ));
}
