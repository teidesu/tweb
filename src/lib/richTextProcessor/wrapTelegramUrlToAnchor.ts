import wrapUrl from '@/lib/richTextProcessor/wrapUrl';

export default function wrapTelegramUrlToAnchor(url1: string) {
  const { url, onclick } = wrapUrl(url1);
  const element = document.createElement('a');
  (element).href = url;
  if (onclick) {
    element.setAttribute('onclick', `${onclick}(this)`);
  }

  return element;
}
