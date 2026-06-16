import Emoji from '@/config/emoji';
import { encodeEmoji } from '@/vendor/emoji';

// the emoji regex matches text-default symbols (™ © ® ↔ ❤ …) even without the
// FE0F presentation selector, so gate on RGI_Emoji to only accept fully-qualified emoji
const RGI_EMOJI_REG_EXP = /^\p{RGI_Emoji}$/v;

export default function getEmojiUnified(emojiCode: string) {
  if (!RGI_EMOJI_REG_EXP.test(emojiCode)) {
    return;
  }

  const unified = encodeEmoji(emojiCode).replace(/-?fe0f/g, '');

  /* if(unified === '1f441-200d-1f5e8') {
    //unified = '1f441-fe0f-200d-1f5e8-fe0f';
    unified = '1f441-fe0f-200d-1f5e8';
  } */

  if (!Emoji.hasOwnProperty(unified)
  // && !emojiData.hasOwnProperty(unified.replace(/-?fe0f$/, ''))
  ) {
    // console.error('lol', unified);
    return;
  }

  return unified;
}
