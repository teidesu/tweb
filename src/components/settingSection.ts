import { LangPackKey, FormatterArguments, i18n_ } from '@/lib/langPack';
import Scrollable from '@/components/scrollable';
import styles from '@/components/sectionRow.module.scss';

export type SettingSectionOptions = {
  name?: LangPackKey | HTMLElement,
  nameArgs?: FormatterArguments,
  caption?: LangPackKey | true,
  captionArgs?: FormatterArguments,
  captionOld?: SettingSectionOptions['caption'],
  noDelimiter?: boolean,
  fakeGradientDelimiter?: boolean,
  noShadow?: boolean,
  // fullWidth?: boolean,
  // noPaddingTop?: boolean
};

export default class SettingSection {
  public container: HTMLElement;
  public innerContainer: HTMLElement;
  public content: HTMLElement;
  public title: HTMLElement;
  public caption: HTMLElement;

  constructor(options: SettingSectionOptions = {}) {
    const container = this.container = document.createElement('div');
    container.classList.add(styles.container);

    const innerContainer = this.innerContainer = document.createElement('div');
    innerContainer.classList.add(styles.section);

    const content = this.content = this.generateContentElement();

    if (options.name) {
      const title = this.title = document.createElement('div');
      title.classList.add(styles.name);
      if (typeof(options.name) === 'string') {
        i18n_({ element: title, key: options.name, args: options.nameArgs });
      } else {
        title.append(options.name);
      }
      content.append(title);
    }

    container.append(innerContainer);

    const caption = options.caption ?? options.captionOld;
    if (caption) {
      const el = this.caption = this.generateContentElement();
      el.classList.add(styles.caption);

      if (!options.captionOld) {
        container.append(el);
      }

      if (caption !== true) {
        i18n_({ element: el, key: caption, args: options.captionArgs });
      }
    }
  }

  public generateContentElement() {
    const content = document.createElement('div');
    content.classList.add(styles.content);

    this.innerContainer.append(content);
    return content;
  }
}

export const generateSection = (appendTo: Scrollable, name?: LangPackKey, caption?: LangPackKey) => {
  const section = new SettingSection({ name, caption });
  appendTo.append(section.container);
  return section.content;
};
