import { IconTsx } from '@/components/iconTsx';
import { observeResize } from '@/components/resizeObserver';
import ripple from '@/components/ripple';
import Scrollable from '@/components/scrollable2';
import { StaticCheckbox } from '@/components/staticCheckbox';
import { keepMe } from '@/helpers/keepMe';
import createMiddleware from '@/helpers/solid/createMiddleware';
import { I18nTsx } from '@/helpers/solid/i18n';
import { requestRAF } from '@/helpers/solid/requestRAF';
import clsx from 'clsx';
import { useIsCleaned } from '@/hooks/useIsCleaned';
import { MessageEntity, TextWithEntities } from '@/layer';
import type { WrapRichTextOptions } from '@/lib/richTextProcessor/wrapRichText';
import { useHotReloadGuard } from '@/lib/solidjs/hotReloadGuard';
import { batch, createComputed, createEffect, createMemo, createSignal, JSX, onCleanup, onMount, Show, Switch, Match } from 'solid-js';
import { Transition } from 'solid-transition-group';
import styles from './previewCard.module.scss';


keepMe(ripple);

export { styles as previewStyles };

export const processEntities = (entities: MessageEntity[] = []) => {
  return entities.map((entity) => entity._ === 'messageEntityBlockquote' ? ({
    ...entity,
    pFlags: { ...entity.pFlags, collapsed: undefined as undefined },
  }) : entity);
};

const shouldBeCollapsibleFrom = 60;

export const Original = (props: {
  text: TextWithEntities.textWithEntities;
  title?: JSX.Element;
  interactive?: boolean;
  isAppearing?: boolean;
  onEmojify?: () => void;
  onMeasured?: () => void;
  wireContent?: (div: HTMLElement) => void;
}) => {
  const { wrapRichText } = useHotReloadGuard();

  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [originalContentHeight, setOriginalContentHeight] = createSignal<number>();
  const [hasOnEmojifyRaffed, setHasOnEmojifyRaffed] = createSignal(!!props.onEmojify);

  const isCollapsible = createMemo(() => (originalContentHeight() ?? 0) > shouldBeCollapsibleFrom);
  const isActuallyCollapsible = createMemo(() => isCollapsible() && !hasOnEmojifyRaffed());

  const isActuallyCollapsed = createMemo(() => isCollapsed() && !props.onEmojify);

  let originalContentRef!: HTMLDivElement;
  let originalScrollableRef!: HTMLDivElement;

  onMount(() => {
    if (!originalContentRef) return;

    const unobserve = observeResize(originalContentRef, () => {
      batch(() => {
        setOriginalContentHeight(originalContentRef.scrollHeight);
        setIsCollapsed(isCollapsible());
        props.onMeasured?.();
      });

      unobserve();
    });

    onCleanup(() => unobserve());
  });

  createComputed(() => {
    if (!props.onEmojify) {
      setHasOnEmojifyRaffed(false);
      return;
    }

    const isCleaned = useIsCleaned();

    requestRAF(() => {
      if (isCleaned()) return;
      setHasOnEmojifyRaffed(true);
    });
  });

  createEffect(() => {
    if (!isActuallyCollapsed() || !originalScrollableRef) return;
    originalScrollableRef.scrollTo({ top: 0 });
  });

  return (
    <>
      <div
        class={styles.originalHeader}
        classList={{
          [styles.clickable]: isActuallyCollapsible(),
        }}
        use:ripple={isActuallyCollapsible()}
        onClick={() => isActuallyCollapsible() && setIsCollapsed((p) => !p)}
      >
        <Show when={props.title} fallback={<I18nTsx key='AiEditor.Original' />}>
          {props.title}
        </Show>
        <Transition name='fade-2'>
          <Switch>
            <Match when={props.onEmojify}>
              <EmojifyCheckbox
                class={styles.originalCheckbox}
                checked={false}
                onClick={() => {
                  requestRAF(() => {
                    props.onEmojify?.();
                  });
                }}
              />
            </Match>
            <Match when={isActuallyCollapsible()}>
              <div class={styles.originalArrow} classList={{ [styles.toggled]: isActuallyCollapsed() }}>
                <IconTsx icon='arrowhead' class={styles.originalArrowIcon} />
              </div>
            </Match>
          </Switch>
        </Transition>
      </div>
      <div
        class={styles.originalContent}
        classList={{
          [styles.collapsible]: isCollapsible(),
          [styles.collapsed]: isActuallyCollapsed(),
        }}
        style={{ '--original-content-height': originalContentHeight() + 'px' }}
      >
        <div ref={originalContentRef}>
          <Scrollable
            ref={originalScrollableRef}
            class={styles.richTextScrollable}
            relative
            withBorders='manual'
            hideThumb={isActuallyCollapsed()}
          >
            <div
              class={clsx(
                styles.richTextScrollableContent,
                !props.interactive && styles.nonInteractive,
                props.interactive && 'spoilers-container'
              )}
              dir='auto'
              ref={(el) => props.wireContent?.(el)}
            >
              {wrapRichText(props.text.text, {
                textColor: 'primary-text-color',
                entities: processEntities(props.text.entities),
                middleware: createMiddleware().get(),
              } as WrapRichTextOptions)}
            </div>
          </Scrollable>
        </div>
        <div
          class={styles.originalOverlay}
          classList={{
            [styles.hasTransition]: !props.isAppearing,
          }}
        />
      </div>
      <Show when={isCollapsible() && !isActuallyCollapsed()}>
        <div
          class={styles.originalFakeHeight}
          style={{ '--original-content-height': originalContentHeight() + 'px' }}
        />
      </Show>
    </>
  );
};

export const Divider = () => {
  return <div class={/* @once */ styles.divider} />;
};

export const EmojifyCheckbox = (props: {
  class?: string;
  checked: boolean;
  onClick: () => void;
}) => {
  return (
    <div class={clsx(styles.emojifyCheckbox, props.class)} onClick={props.onClick} use:ripple>
      <StaticCheckbox round checked={props.checked} />
      <I18nTsx key='AiEditor.Emojify' />
    </div>
  );
};
