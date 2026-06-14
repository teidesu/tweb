import nthChild from '@helpers/dom/nthChild';
import whichChild from '@helpers/dom/whichChild';

export default function positionElementByIndex(element: HTMLElement, container: HTMLElement, pos: number, prevPos?: number) {
  if (prevPos === undefined) {
    prevPos = element.parentElement === container ? whichChild(element) : -1;
  }

  if (prevPos === pos) {
    return false;
  } else if (prevPos !== -1 && prevPos < pos) { // was higher
    pos += 1;
  }

  // index in the same coordinates as whichChild — thumb siblings excluded
  const before = pos ? nthChild(container, pos) : undefined;
  if (!pos) {
    container.prepend(element);
  } else if (before) {
    container.insertBefore(element, before);
  } else {
    container.append(element);
  }

  return true;
}
