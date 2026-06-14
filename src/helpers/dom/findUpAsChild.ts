export default function findUpAsChild<T extends {parentElement: HTMLElement}>(el: T, parent: HTMLElement): T | null {
  if(!el) return null;
  if(el.parentElement === parent) return el;

  while(el.parentElement) {
    el = el.parentElement as any;
    if(el.parentElement === parent) {
      return el;
    }
  }

  return null;
}
