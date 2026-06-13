import isScrollableThumbContainer from '@helpers/dom/isScrollableThumbContainer';

// children[index] counterpart to whichChild — both skip custom scrollbar
// thumb siblings, so an index produced by one resolves correctly via the other
export default function nthChild(container: Element, index: number) {
  for(const child of container.children) {
    if(isScrollableThumbContainer(child)) {
      continue;
    }

    if(!index--) {
      return child;
    }
  }
}
