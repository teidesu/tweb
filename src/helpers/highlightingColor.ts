import { rgbaToHsla } from '@helpers/color';
import clamp from '@helpers/number/clamp';

// Match Android's `bubbleSelectedOverlay` (Theme.java): force a vivid highlight regardless
// of how muted the wallpaper is, so the jump-to-message flash stays contrasty. The previous
// Telegram-iOS formula only nudged saturation, which washed out on low-saturation wallpapers.
const SATURATION_BOOST = 60;

export default function highlightingColor(rgba: [number, number, number, number?], fallbackHue?: number) {
  let { h, s, l } = rgbaToHsla(rgba[0], rgba[1], rgba[2]);
  // achromatic wallpaper has no hue to keep — borrow the theme accent so the forced
  // saturation doesn't turn a grey background into a red flash
  if (s <= 0 && fallbackHue !== undefined) {
    h = fallbackHue;
  }
  s = clamp(s + SATURATION_BOOST, 0, 100);
  l = Math.max(0, l * .65);

  const hsla = `hsla(${h}, ${s}%, ${l}%, .4)`;
  return hsla;
}
