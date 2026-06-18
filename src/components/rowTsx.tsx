import { children, createMemo, JSX, onCleanup, Ref, Show, splitProps, useContext } from 'solid-js';
import clsx from 'clsx';
import { IconTsx } from '@/components/iconTsx';
import RippleElement from '@/components/rippleElement';
import createComponentContext, { ComponentContextValue } from '@/helpers/solid/createComponentContext';
import createContextMenu from '@/helpers/dom/createContextMenu';
import ListenerSetter from '@/helpers/listenerSetter';
import styles from '@/components/sectionRow.module.scss';

export type RowMediaSizeType = 'small' | 'medium' | 'big' | 'abitbigger' | 'bigger' | '40';

// todo: cva
export const rowMediaSizeClass: Partial<Record<RowMediaSizeType, string>> = {
  'small': styles.rowMediaSmall,
  'big': styles.rowMediaBig,
  'abitbigger': styles.rowMediaAbitbigger,
  'bigger': styles.rowMediaBigger,
  '40': styles.rowMedia40,
};

type Kind = 'title' | 'subtitle' | 'media' | 'midtitle' | 'icon' |
  'rightContent' | 'checkboxField' | 'checkboxFieldToggle' | 'radioField' |
  'media';

type RowContextValue = ComponentContextValue<Kind> & {
  noWrap?: boolean
};

const {
  context: RowContext,
  createValue: createRowValue,
} = createComponentContext<RowContextValue, Kind>();

const Row = (props: {children: JSX.Element} & Partial<{
  ref: Ref<HTMLElement>,
  clickable: boolean | JSX.HTMLAttributes<HTMLElement>['onClick'],
  havePadding: boolean,
  noRipple: boolean,
  noWrap: boolean,
  disabled: boolean,
  fakeDisabled: boolean,
  color: 'primary' | 'danger',
  // buttonRight?: HTMLElement | boolean,
  // buttonRightLangKey: LangPackKey,
  // rightTextContent?: string,
  as: 'a' | 'label' | 'div',
  contextMenu: Omit<Parameters<typeof createContextMenu>[0], 'findElement' | 'listenTo' | 'listenerSetter'>,
  // checkboxKeys: [LangPackKey, LangPackKey],
  classList: {[key: string]: boolean},
  class: string
}>) => {
  const value: RowContextValue = {
    ...createRowValue(),
    get noWrap() {
      return props.noWrap;
    },
  };

  const { store } = value;

  const isCheckbox = () => !!(store.checkboxField || store.checkboxFieldToggle || store.radioField);
  const isClickable = () => !!(props.clickable || isCheckbox() || props.contextMenu);
  const haveRipple = () => !!(!props.noRipple && isClickable());
  const havePadding = () => !!(
    props.havePadding ||
    store.icon ||
    store.checkboxField ||
    store.radioField ||
    store.media
  );

  const resolvedChildren = children(() => (
    <RowContext.Provider value={value}>
      {props.children}
    </RowContext.Provider>
  ));

  let openContextMenu: ReturnType<typeof createContextMenu>['open'] | undefined;
  const ref = createMemo(() => {
    return props.contextMenu ? (container: HTMLElement) => {
      const listenerSetter = new ListenerSetter();
      const { open } = createContextMenu({
        ...props.contextMenu!,
        listenTo: container,
        listenerSetter,
      } as any);

      openContextMenu = open;

      onCleanup(() => {
        openContextMenu = undefined;
        listenerSetter.removeAll();
      });

      // @ts-ignore
      props.ref?.(container);
    } : props.ref as any;
  });

  return (
    <RippleElement
      ref={ref()}
      component={props.as === 'a' ? 'a' : (props.as === 'label' || isCheckbox() ? 'label' : 'div')}
      classList={{
        [styles.row]: true,
        [styles.noSubtitle]: !store.subtitle,
        [styles.noWrap]: value.noWrap,
        [styles.rowWithIcon]: !!store.icon,
        [styles.rowWithPadding]: havePadding(),
        [clsx(styles.rowClickable, `hover-${props.color ? props.color + '-' : ''}effect`)]: isClickable(),
        'is-disabled': props.disabled,
        'is-fake-disabled': props.fakeDisabled,
        [styles.rowGrid]: !!store.rightContent,
        'with-midtitle': !!store.midtitle,
        ...(props.classList || {}),
        [props.class as string]: !!props.class,
      }}
      onClick={
        (typeof(props.clickable) !== 'boolean' && props.clickable) ||
        (props.contextMenu ? openContextMenu! : undefined)
      }
      noRipple={!haveRipple()}
    >
      {resolvedChildren()}
      {store.title}
      {store.midtitle}
      {store.subtitle}
      {store.icon}
      {store.checkboxField || store.radioField}
      {store.rightContent}
      {store.media}
    </RippleElement>
  );
};

Row.RowPart = (props: {
  class: string,
  part?: JSX.Element
}) => {
  const resolved = children(() => props.part);
  return (
    <Show when={resolved()}>
      <div
        class={clsx(
          props.class,
          useContext(RowContext)!.noWrap && styles.noWrap
        )}
        dir="auto"
      >
        {resolved()}
      </div>
    </Show>
  );
};

Row.Row = (props: {
  baseClass: string,
  rowClass?: string,
  rightClass?: string,
  additionalClass?: string,
  left?: JSX.Element,
  right?: JSX.Element
}) => {
  const part = <Row.RowPart class={clsx(props.baseClass, props.additionalClass)} part={props.left} />;
  const resolved = children(() => props.right);
  return (
    <Show when={resolved()} fallback={part}>
      <div class={clsx(styles.rowRow, props.rowClass)}>
        {part}
        <Row.RowPart
          class={clsx(props.baseClass, props.additionalClass, props.rightClass)}
          part={resolved()}
        />
      </div>
    </Show>
  );
};

Row.Title = (props: {
  children: JSX.Element,
  class?: string,
  titleRight?: JSX.Element,
  titleRightSecondary?: boolean
}) => {
  const context = useContext(RowContext);
  return context!.register('title', (
    <Row.Row
      baseClass={styles.rowTitle}
      rowClass={styles.rowTitleRow}
      rightClass={clsx(styles.rowTitleRight, props.titleRightSecondary && styles.rowTitleRightSecondary)}
      additionalClass={props.class}
      left={props.children}
      right={props.titleRight || context!.store.checkboxFieldToggle}
    />
  ));
};

Row.Midtitle = (props: {
  children: JSX.Element
}) => {
  return useContext(RowContext)!.register('midtitle', (
    <Row.Row
      baseClass={styles.rowMidtitle}
      left={props.children}
    />
  ));
};

Row.Subtitle = (props: {
  children: JSX.Element,
  class?: string,
  subtitleRight?: JSX.Element
}) => {
  return useContext(RowContext)!.register('subtitle', (
    <Row.Row
      baseClass={styles.rowSubtitle}
      rowClass={styles.rowSubtitleRow}
      rightClass={styles.rowSubtitleRight}
      additionalClass={props.class}
      left={props.children}
      right={props.subtitleRight}
    />
  ));
};

Row.Icon = (props: {
  icon: Icon,
  class?: string
}) => {
  return useContext(RowContext)!.register('icon', (
    <IconTsx icon={props.icon} class={clsx(styles.rowIcon, props.class)} />
  ));
};

Row.RightContent = (inProps: JSX.HTMLAttributes<HTMLDivElement>) => {
  const [props, restProps] = splitProps(inProps, ['class']);
  return useContext(RowContext)!.register('rightContent', (
    <div class={clsx(styles.rowRight, props.class)} {...restProps} />
  ));
};

Row.CheckboxField = (props: {
  children: JSX.Element
}) => {
  return useContext(RowContext)!.register('checkboxField', props.children);
};

Row.RadioField = (props: {
  children: JSX.Element
}) => {
  return useContext(RowContext)!.register('radioField', props.children);
};

Row.CheckboxFieldToggle = (props: {
  children: JSX.Element
}) => {
  return useContext(RowContext)!.register('checkboxFieldToggle', props.children);
};

Row.Media = (inProps: JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element,
  size: RowMediaSizeType,
  class?: string
}) => {
  const [props, restProps] = splitProps(inProps, ['children', 'size', 'class']);

  return useContext(RowContext)!.register('media', (
    <div
      class={clsx(
        styles.rowMedia,
        props.size && rowMediaSizeClass[props.size],
        props.class
      )}
      {...restProps}
    >
      {props.children}
    </div>
  ));
};

export default Row;
