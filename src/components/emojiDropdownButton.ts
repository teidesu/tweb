import { MessageEntity } from '@/layer';
import getEmojiEntityFromEmoji from '@/lib/richTextProcessor/getEmojiEntityFromEmoji';
import rootScope from '@/lib/rootScope';
import { EmoticonsDropdown } from '@/components/emoticonsDropdown';
import { AnimationItemGroup } from '@/components/animationIntersector';
import EmojiTab from '@/components/emoticonsDropdown/tabs/emoji';
import InputField, { insertRichTextAsHTML } from '@/components/inputField';

import styles from '@/components/emojiDropdownButton.module.scss';
import Button from '@/components/buttonTsx';
import { createRoot, onCleanup } from 'solid-js';
import createListenerSetter from '@/helpers/solid/createListenerSetter';

type OnClick = ConstructorParameters<typeof EmojiTab>[0]['onClick'];

type UseEmojiDropdownArgs = {
  inputField?: InputField;
  onClick?: OnClick;
  element: HTMLElement;
  noPacks?: boolean;
  noSearchGroups?: boolean;
  noRegularEmoji?: boolean;
  canUsePremiumEmojiAlways?: boolean;
  customParentElement?: HTMLElement | (() => HTMLElement);
  getOpenPosition?: () => DOMRectEditable;
  animationGroup?: AnimationItemGroup;
};

const getDefaultOnClick = (inputField: InputField): OnClick => async(emoji) => {
  const entity: MessageEntity = emoji.docId ? {
    _: 'messageEntityCustomEmoji',
    document_id: emoji.docId,
    length: emoji.emoji.length,
    offset: 0,
  } : getEmojiEntityFromEmoji(emoji.emoji);

  insertRichTextAsHTML(
    inputField.input,
    emoji.emoji,
    (entity ? [entity] : undefined)!
  );
};

export const useEmojiDropdown = ({
  inputField,
  onClick = inputField ? getDefaultOnClick(inputField) : undefined,
  element,
  noPacks,
  noSearchGroups,
  noRegularEmoji,
  canUsePremiumEmojiAlways: _canUsePremiumEmojiAlways,
  ...rest
}: UseEmojiDropdownArgs) => {
  const emojiTab = new EmojiTab({
    managers: rootScope.managers,
    additionalStickerViewerClass: styles.StickerViewer,
    noPacks: noPacks ?? !rootScope.premium,
    noSearchGroups: noSearchGroups ?? !rootScope.premium,
    noRegularEmoji,
    onClick,
  });

  const emoticonsDropdown = new EmoticonsDropdown({
    tabsToRender: [emojiTab],
    ...rest,
  });

  emoticonsDropdown.attachButtonListener(element, createListenerSetter());
  emoticonsDropdown.getElement().classList.add(styles.EmoticonsDropdown);
  emoticonsDropdown.setTextColor('primary-text-color');

  onCleanup(() => {
    emoticonsDropdown?.hideAndDestroy();
  });

  return {
    emojiTab,
    emoticonsDropdown,
  };
};

const createEmojiDropdownButton = ({
  inputField,
  class: _class,
  onEmoticonsDropdown,
  ...rest
}: {
  inputField: InputField,
  class?: string,
  onEmoticonsDropdown?: (emoticonsDropdown: EmoticonsDropdown) => void,
  customParentElement?: HTMLElement | (() => HTMLElement),
  getOpenPosition?: () => DOMRectEditable,
  animationGroup?: AnimationItemGroup
}) => createRoot((dispose) => {
  let button: HTMLButtonElement;
  Button.Icon({
    icon: 'smile',
    class: _class,
    noRipple: true,
    ref: (ref) => button = ref as HTMLButtonElement,
  }) as HTMLElement;

  const { emoticonsDropdown } = useEmojiDropdown({
    element: button!,
    inputField,
    ...rest,
  });

  onEmoticonsDropdown?.(emoticonsDropdown);
  onCleanup(() => {
    emoticonsDropdown?.hideAndDestroy();
  });

  return { button: button!, dispose };
});

export default createEmojiDropdownButton;
