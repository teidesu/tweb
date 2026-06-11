// not yet in TS dom lib
declare global {
  interface Element {
    moveBefore?<T extends Node>(node: T, child: Node | null): T;
  }
}

/**
 * Moves an element into another parent, atomically when the browser supports
 * it (`Element.moveBefore`) — preserving state like playing media, CSS
 * animations and iframes. Falls back to a regular `insertBefore`.
 */
export default function reparentElement(element: Element, parent: Element, before: Node | null = null) {
  // moveBefore throws when the element is not connected or lives in another
  // document/shadow root — fall back to a plain insert in those cases
  if(parent.moveBefore && element.isConnected) {
    try {
      parent.moveBefore(element, before);
      return;
    } catch(err) {}
  }

  parent.insertBefore(element, before);
}
