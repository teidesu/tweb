// The custom scrollbar thumb (see scrollable.ts) is an absolutely-positioned
// SIBLING of its scrollable container — when scrollable containers are used
// directly as tab elements (chatlist folders, reacted list), thumbs end up
// interleaved with the tabs and must stay transparent to children indexing.
export default function isScrollableThumbContainer(element: Element) {
  return element.classList.contains('scrollable-thumb-container');
}
