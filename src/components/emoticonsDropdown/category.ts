import { makeMediaSize, MediaSize } from '@/helpers/mediaSize';
import mediaSizes from '@/helpers/mediaSizes';
import { MiddlewareHelper, Middleware, getMiddleware } from '@/helpers/middleware';
import { StickerSet } from '@/layer';
import ButtonIcon from '@/components/buttonIcon';
import { ScrollableX } from '@/components/scrollable';
import { EMOJI_ELEMENT_SIZE } from '@/components/emoticonsDropdown/tabs/emoji';

export type StickersTabCategoryItem = {element: HTMLElement};
export type StickersTabStyles = {
  padding: number,
  gapX: number,
  gapY: number,
  getElementMediaSize: () => MediaSize,
  itemsClassName: string,
  squareCells?: boolean
};

export const EmoticonsTabStyles: {[key in 'Stickers' | 'Emoji' | 'GIF']?: StickersTabStyles} = {
  Stickers: {
    getElementMediaSize: () => mediaSizes.active.esgSticker,
    padding: 3 * 2,
    gapX: 0,
    gapY: 0,
    itemsClassName: 'super-stickers',
    squareCells: true,
  },
  Emoji: {
    getElementMediaSize: () => EMOJI_ELEMENT_SIZE,
    padding: 16,
    gapX: 0,
    gapY: 0,
    itemsClassName: 'super-emojis',
    squareCells: true,
  },
  GIF: {
    getElementMediaSize: () => makeMediaSize(124, 124),
    padding: 4,
    gapX: 2,
    gapY: 2,
    itemsClassName: 'emoticons-gifs',
  },
}

export default class StickersTabCategory<Item extends StickersTabCategoryItem, AdditionalElements extends Record<string, HTMLElement> = {}> {
  public elements: {
    container: HTMLElement,
    title: HTMLElement,
    items: HTMLElement,
    menuTab: HTMLElement,
    menuTabPadding: HTMLElement
  } & AdditionalElements;
  public items: Item[];
  public mounted: boolean;
  public id: string;
  public limit: number;

  public getContainerSize: () => {width: number, height: number};
  private getElementMediaSize: () => MediaSize;

  private gapX: number;
  private gapY: number;
  private squareCells: boolean;

  public set?: StickerSet;
  public local?: boolean;
  public menuScroll?: ScrollableX;

  public middlewareHelper: MiddlewareHelper;

  constructor(options: {
    id: string,
    title: HTMLElement | DocumentFragment,
    overflowElement: HTMLElement,
    styles: StickersTabStyles,
    getContainerSize: StickersTabCategory<Item>['getContainerSize'],
    noMenuTab?: boolean,
    middleware?: Middleware
  }) {
    const container = document.createElement('div');
    container.classList.add('emoji-category');

    const items = document.createElement('div');
    items.classList.add('category-items');

    let title: HTMLElement;
    if (options.title) {
      title = document.createElement('div');
      title.classList.add('category-title');
      title.append(options.title);
    }

    let menuTab: HTMLElement, menuTabPadding: HTMLElement;
    if (!options.noMenuTab) {
      menuTab = ButtonIcon(undefined, { noRipple: true });
      menuTab.classList.add('emoticons-menu-item');

      menuTabPadding = document.createElement('div');
      menuTabPadding.classList.add('emoticons-menu-item-padding');

      menuTab.append(menuTabPadding);
    }

    if (title!) container.append(title);
    container.append(items);

    this.elements = {
      container,
      title: title!,
      items,
      menuTab: menuTab!,
      menuTabPadding: menuTabPadding!,
    } as any;
    this.id = options.id;
    this.items = [];

    this.getContainerSize = options.getContainerSize;
    this.getElementMediaSize = options.styles.getElementMediaSize;
    this.gapX = options.styles.gapX ?? 0;
    this.gapY = options.styles.gapY ?? 0;
    this.squareCells = options.styles.squareCells ?? false;
    this.middlewareHelper = options.middleware ? options.middleware.create() : getMiddleware();
  }

  public setCategoryItemsHeight(itemsLength = this.items.length) {
    const { width: containerWidth } = this.getContainerSize();
    const elementSize = this.getElementMediaSize().width;

    const itemsPerRow = Math.max(1, Math.floor((containerWidth + this.gapX) / (elementSize + this.gapX)));
    const rowHeight = this.squareCells ?
      (containerWidth - (itemsPerRow - 1) * this.gapX) / itemsPerRow :
      elementSize;

    const rows = Math.ceil(itemsLength / itemsPerRow);
    let height = rows * rowHeight;
    if (this.gapY) height += (rows - 1) * this.gapY;

    this.elements.items.style.minHeight = height + 'px';
  }
}
