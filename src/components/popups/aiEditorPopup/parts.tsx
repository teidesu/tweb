import { ButtonIconTsx } from '@/components/buttonIconTsx';
import { ButtonMenuItemOptions } from '@/components/buttonMenu';
import EmojiDocumentIcon from '@/components/emojiDocumentIcon';
import { IconTsx } from '@/components/iconTsx';
import ripple from '@/components/ripple';
import Scrollable, { ScrollableContextValue } from '@/components/scrollable2';
import { Skeleton } from '@/components/skeleton';
import deferredPromise from '@/helpers/cancellablePromise';
import { copyTextToClipboard } from '@/helpers/clipboard';
import anchorCallback from '@/helpers/dom/anchorCallback';
import createContextMenu from '@/helpers/dom/createContextMenu';
import { keepMe } from '@/helpers/keepMe';
import prepareTextWithEntitiesForCopying from '@/helpers/prepareTextWithEntitiesForCopying';
import createMiddleware from '@/helpers/solid/createMiddleware';
import { I18nTsx } from '@/helpers/solid/i18n';
import { requestRAF } from '@/helpers/solid/requestRAF';
import clsx from 'clsx';
import { AiComposeTone } from '@/layer';
import { ComposeMessageWithAiArgs, ComposeMessageWithAiOkResultData } from '@/lib/appManagers/aiTonesManager';
import { LangPackKey } from '@/lib/langPack';
import { useHotReloadGuard } from '@/lib/solidjs/hotReloadGuard';
import { children, createComputed, createEffect, createMemo, createReaction, createResource, createSignal, For, JSX, Match, onCleanup, ParentProps, Show, Switch } from 'solid-js';
import { Transition, TransitionGroup } from 'solid-transition-group';
import { EmojifyCheckbox, previewStyles, processEntities } from '@/components/popups/previewCard';
import { usePopupContext } from '../indexTsx';
import styles from './bodyContent.module.scss';
import { useAiEditorPopupContext } from './context';
import showCreateTonePopup from './createTonePopup';

export { Divider, Original } from '@/components/popups/previewCard';


keepMe(ripple);

type TabsProps<T> = {
  items: {
    label: LangPackKey;
    icon: Icon;
    key: T;
  }[];
  activeKey: T;
  onTabChange: (key: T) => void;
};

export const Tabs = <T, >(props: TabsProps<T>) => {
  return (
    <div class={/* @once */ styles.padded}>
      <div class={/* @once */ styles.tabs}>
        <For each={props.items}>{(item) => (
          <div
            use:ripple
            onClick={() => props.onTabChange(item.key)}
            class={styles.tab}
            classList={{
              [styles.active]: props.activeKey === item.key,
            }}
          >
            <IconTsx class={/* @once */ styles.tabIcon} icon={item.icon} />
            <I18nTsx class={/* @once */ styles.tabLabel} key={item.label} />
          </div>
        )}</For>
      </div>
    </div>
  );
};

const MAX_CACHED_COMPOSED_MESSAGES = 50;
export const cachedComposedMessages: Map<string, ComposeMessageWithAiOkResultData> = new Map();

const getCachedComposedMessageKey = (args: ComposeMessageWithAiArgs): string | undefined => {
  try {
    return JSON.stringify(args);
  } catch {
    return undefined;
  }
};

const getCachedComposedMessage = (args: ComposeMessageWithAiArgs): ComposeMessageWithAiOkResultData | undefined => {
  const key = getCachedComposedMessageKey(args);
  return key ? cachedComposedMessages.get(key) : undefined;
};

const setCachedComposedMessage = (key: string | undefined, data: ComposeMessageWithAiOkResultData) => {
  if (!key) return;
  cachedComposedMessages.set(key, data);
  if (cachedComposedMessages.size > MAX_CACHED_COMPOSED_MESSAGES) {
    cachedComposedMessages.delete(cachedComposedMessages.keys().next().value!);
  }
};

class ComposeError extends Error {
  constructor(public isPremiumFlood: boolean) {
    super();
    this.name = 'ComposeError';
  }
}

export const Result = (props: {
  overrideTitle?: JSX.Element;
  emojify?: boolean;
  onEmojify?: () => void;
  isAppearing?: boolean;
  useDiffText?: boolean;
  composeMessageWithAiArgs?: ComposeMessageWithAiArgs;
}) => {
  const { rootScope, toastNew, wrapRichText, PopupPremium } = useHotReloadGuard();
  const { resultTextSignal: [, setResultText] } = useAiEditorPopupContext();
  const popupContext = usePopupContext();

  let appearDeferred = props.isAppearing ? deferredPromise<void>() : undefined;

  if (appearDeferred) {
    const track = createReaction(() => {
      appearDeferred?.resolve?.();
      appearDeferred = undefined;
    });
    track(() => props.isAppearing);
  }

  const [composedMessage] = createResource(() => props.composeMessageWithAiArgs, (args) => {
    const cached = getCachedComposedMessage(args);
    if (cached) return cached;

    return (async() => {
      const [result] = await Promise.all([rootScope.managers.aiTonesManager.composeMessageWithAi(args), appearDeferred]);
      if (result.ok === false) throw new ComposeError(result.isPremiumFlood);

      const key = getCachedComposedMessageKey(args);
      if (key) setCachedComposedMessage(key, result.data);
      return result.data;
    })();
  }, {
    initialValue: props.composeMessageWithAiArgs ? getCachedComposedMessage(props.composeMessageWithAiArgs) : undefined,
  } as {});

  let scrollableRef!: HTMLDivElement, scrollableContextRef!: ScrollableContextValue;
  const [skeletonHeight, setSkeletonHeight] = createSignal<number>();

  const isPremiumFloodError = createMemo(() => composedMessage.error instanceof ComposeError && composedMessage.error.isPremiumFlood);

  const textToRender = createMemo(() => {
    if (composedMessage.state !== 'ready') return;
    const localComposedMessage = composedMessage();
    if (props.useDiffText) return localComposedMessage.diffText || localComposedMessage.resultText;
    return localComposedMessage.resultText;
  });

  createComputed(() => {
    if (composedMessage.state !== 'ready') return;

    setResultText(composedMessage().resultText);

    onCleanup(() => {
      setResultText();
    });
  });

  createEffect(() => {
    if (composedMessage.state !== 'ready' && scrollableRef?.isConnected) {
      setSkeletonHeight(scrollableRef.clientHeight);
    }
  });

  const onCopyClick = async() => {
    if (composedMessage.state !== 'ready') return;
    const { text, html } = prepareTextWithEntitiesForCopying(composedMessage().resultText);
    try {
      await copyTextToClipboard(text, html, { rethrow: true });
      toastNew({
        langPackKey: 'TextCopied',
      });
    } catch {
      toastNew({
        langPackKey: 'TextCopyFailed',
      });
    }
  };

  return (
    <>
      <div class={/* @once */ previewStyles.resultHeader}>
        <div class={/* @once */ previewStyles.resultTitleWrapper}>
          <Show when={props.overrideTitle} fallback={<I18nTsx key='AiEditor.Result' class={previewStyles.resultTitle} />}>
            {props.overrideTitle}
          </Show>
          <ButtonIconTsx
            class={previewStyles.copyButton}
            classList={{
              [previewStyles.hidden]: composedMessage.state !== 'ready',
            }}
            icon='copy'
            onClick={onCopyClick}
          />
        </div>
        <Show when={props.onEmojify}>
          {(onEmojify) => <EmojifyCheckbox checked={props.emojify ?? false} onClick={onEmojify()} />}
        </Show>
      </div>
      <div class={/* @once */ previewStyles.resultContent}>
        <Transition
          name='fade-2'
          mode='outin'
          onAfterEnter={(el) => {
            if (el === scrollableRef) requestRAF(() => {
              scrollableContextRef?.onSizeChange?.();
            });
          }}>
          <Switch>
            <Match when={textToRender()} keyed>
              {(text) => (
                <Scrollable
                  ref={scrollableRef}
                  contextRef={(value) => void (scrollableContextRef = value)}
                  relative
                  class={previewStyles.richTextScrollable}
                  withBorders='manual'
                >
                  <div class={clsx(previewStyles.richTextScrollableContent, previewStyles.nonInteractive)}>
                    {wrapRichText(text.text, { entities: processEntities(text.entities), middleware: createMiddleware().get() })}
                  </div>
                </Scrollable>
              )}
            </Match>
            <Match when={composedMessage.state === 'pending' || composedMessage.state === 'refreshing'}>
              <ResultSkeleton height={skeletonHeight()} />
            </Match>
            <Match when>
              <div class={/* @once */ previewStyles.error}>
                <Show when={isPremiumFloodError()} fallback={<I18nTsx key='AiEditor.ComposeError' />}>
                  <I18nTsx
                    key='AiEditor.PremiumFlood'
                    args={[
                      anchorCallback(() => {
                        popupContext?.hide();
                        new PopupPremium().show();
                      }),
                    ]}
                  />
                </Show>
              </div>
            </Match>
          </Switch>
        </Transition>
      </div>
    </>
  );
};

const ResultSkeleton = (props: {height?: number}) => {
  return (
    <Skeleton.Div
      class={previewStyles.resultSkeleton}
      secondary
      style={props.height ? { height: props.height + 'px' } : undefined}
    />
  );
};

export const Tone = (props: {
  docId: DocId;
  name: string;
  selected: boolean;
  withContextMenu?: {
    isSaved: boolean;
    onDelete: () => void;
    onShare: () => void;
    onEdit?: () => void;
  };
  onClick: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
}) => {
  const { rootScope } = useHotReloadGuard();

  let div!: HTMLDivElement;

  createEffect(() => {
    if (!props.withContextMenu) return;

    const { destroy } = createContextMenu({
      buttons: [
        ...(props.withContextMenu.onEdit ? [
          {
            icon: 'edit',
            text: 'Edit' as LangPackKey,
            onClick: props.withContextMenu.onEdit,
          },
        ] as ButtonMenuItemOptions[] : []),
        {
          icon: 'forward',
          text: 'ShareFile' as LangPackKey,
          onClick: props.withContextMenu.onShare,
        },
        {
          icon: 'delete',
          text: (props.withContextMenu.isSaved ? 'Remove' : 'Delete') as LangPackKey,
          danger: true,
          onClick: props.withContextMenu.onDelete,
        },
      ],
      listenTo: div,
    });

    onCleanup(() => destroy());
  });

  return (
    <div
      ref={div}
      class={styles.tone}
      classList={{
        [styles.active]: props.selected,
      }}
      use:ripple
      onClick={props.onClick}
    >
      <EmojiDocumentIcon
        docId={props.docId}
        color={props.selected ? 'primary-color' : 'primary-text-color'}
        size={42}
        class={/* @once */ styles.toneIcon}
        managers={rootScope.managers}
      />
      <div class={/* @once */ styles.toneName}>{props.name}</div>
      <Show when={props.withContextMenu}>
        <IconTsx icon='more' class={/* @once */ styles.toneContextMenuIcon} />
      </Show>
    </div>
  );
};

type CreateToneProps = {
  onCreate: (tone: AiComposeTone) => void;
};

export const CreateTone = (props: CreateToneProps) => {
  const { HotReloadGuard, rootScope } = useHotReloadGuard();
  return (
    <div class={/* @once */ styles.tone} use:ripple onClick={() => {
      showCreateTonePopup({
        onSubmit: async(args) => {
          const createdTone = await rootScope.managers.aiTonesManager.createTone(args);
          props.onCreate(createdTone);
        },
        HotReloadGuard,
      });
    }}>
      <IconTsx class={/* @once */ styles.toneIcon} icon='edit_stars_add' />
      <div class={/* @once */ styles.toneName}>
        <I18nTsx key='Create' />
      </div>
    </div>
  );
};

export const useIsAppearing = (hasAnimation: () => boolean) => {
  const [isAppearing, setIsAppearing] = createSignal(true);

  const track = createReaction(() => setIsAppearing(false));
  const finishedAnimation = createMemo(() => !hasAnimation());

  requestRAF(() => {
    track(finishedAnimation);
  });

  return isAppearing;
};

export const useTransitionGroupWhenMeasured = () => {
  const [measured, setMeasured] = createSignal(false);

  const Wrapper = (props: ParentProps) => {
    const resolved = children(() => props.children);
    return (
      <Show when={measured()} fallback={resolved()}>
        <TransitionGroup
          name='fade-2'
          moveClass='t-move-std'
          onBeforeExit={el => {
            el.classList.add(styles.exit);
          }}
        >
          {resolved()}
        </TransitionGroup>
      </Show>
    );
  };

  return {
    Wrapper,
    onMeasured: () => setMeasured(true),
  };
};
