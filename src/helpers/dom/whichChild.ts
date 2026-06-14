import isScrollableThumbContainer from '@helpers/dom/isScrollableThumbContainer';

export default function whichChild(elem: Node, countNonElements?: boolean) {
  if (!elem?.parentNode) {
    return -1;
  }

  if (countNonElements) {
    return Array.from(elem.parentNode.childNodes).indexOf(elem as ChildNode);
  }

  let i = 0, element = elem as Element;
  while ((element = element.previousElementSibling!) !== null) {
    if (!isScrollableThumbContainer(element)) ++i;
  }
  return i;
}
