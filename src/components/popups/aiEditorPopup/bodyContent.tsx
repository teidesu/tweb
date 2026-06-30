import { SEND_WHEN_ONLINE_TIMESTAMP } from '@/lib/appManagers/constants';
import { AutoHeight } from '@/components/autoHeight';
import Button from '@/components/buttonTsx';
import SelectedEffect from '@/components/chat/selectedEffect';
import SendContextMenu from '@/components/chat/sendContextMenu';
import { IconTsx } from '@/components/iconTsx';
import showScheduleSendingPopup from '@/components/popups/scheduleSendingPopup';
import Scrollable, { ScrollableContextValue } from '@/components/scrollable2';
import Space from '@/components/space';
import debounce from '@/helpers/schedulers/debounce';
import createMiddleware from '@/helpers/solid/createMiddleware';
import { I18nTsx } from '@/helpers/solid/i18n';
import { useObserveResize } from '@/hooks/useObserveResize';
import rootScope from '@/lib/rootScope';
import { LocalTextWithEntities } from '@/components/chat/bubbleParts/pollMessageContent/utils';
import { createSignal, Match, onMount, Show, Switch } from 'solid-js';
import { Transition } from 'solid-transition-group';
import { AiEditorSendOptions } from './aiEditorPopup';
import styles from './bodyContent.module.scss';
import { useAiEditorPopupContext } from './context';
import { FixTab } from './fixTab';
import { Tabs, useIsAppearing } from './parts';
import { StyleTab } from './styleTab';
import { TranslateTab } from './translateTab';


enum TabKey {
  Translate,
  Style,
  Fix
}

export const AiEditorPopupBodyContent = () => {
  const { peerId, isScheduled, onApply, onSend, canSendWhenOnline, resultTextSignal: [resultText] } = useAiEditorPopupContext();

  const [effect, setEffect] = createSignal<DocId>();
  const effectAccessor = (() => effect()) as () => DocId;

  const sendResult = (options?: AiEditorSendOptions) => {
    const text = resultText() as LocalTextWithEntities | undefined;
    if (!text) return;
    onSend!(text, { ...options, effect: effect() });
  };

  const openScheduleAndSend = async() => {
    showScheduleSendingPopup({
      canSendWhenOnline: await canSendWhenOnline?.(),
      onPick: (timestamp, repeatPeriod) => sendResult({
        scheduleDate: timestamp,
        scheduleRepeatPeriod: repeatPeriod,
      }),
    });
  };

  const handleSendClick = () => {
    if (!resultText()) return;
    if (isScheduled) {
      openScheduleAndSend();
      return;
    }
    sendResult();
  };

  const [activeTab, setActiveTab] = createSignal<TabKey>(TabKey.Style);
  const [hasTransition, setHasTransition] = createSignal(false);

  const [scrollableEl, setScrollableEl] = createSignal<HTMLDivElement>();
  const [scrollableContentEl, setScrollableContentEl] = createSignal<HTMLDivElement>();
  let scrollableContextRef!: ScrollableContextValue;

  const updateScrollable = debounce(() => {
    scrollableContextRef?.onSizeChange();
  }, 100, false, true);

  useObserveResize(scrollableEl, updateScrollable);
  useObserveResize(scrollableContentEl, updateScrollable);

  return (
    <div class={/* @once */ styles.bodyContent}>
      <Tabs
        items={[
          { label: 'Translate', icon: 'premium_translate', key: TabKey.Translate },
          { label: 'AiEditor.Style', icon: 'edit_stars', key: TabKey.Style },
          { label: 'AiEditor.Fix', icon: 'search_check', key: TabKey.Fix },
        ]}
        activeKey={activeTab()}
        onTabChange={setActiveTab}
      />
      <Space amount='0.5rem' />
      <Scrollable
        ref={setScrollableEl}
        class={/* @once */ styles.scrollable}
        relative
        withBorders='both'
        contextRef={(value) => void (scrollableContextRef = value)}
      >
        <div class={/* @once */ styles.scrollableContent}>
          <AutoHeight
            ref={setScrollableContentEl}
            outerClass={styles.autoHeight}
            hasTransition={hasTransition()}
            overflowHidden
          >
            <Transition
              name='fade-2'
              onBeforeExit={(el) => {
                el.classList.add(styles.exit);
                setHasTransition(true);
              }}
              onAfterExit={() => setHasTransition(false)}
              onBeforeEnter={() => setHasTransition(true)}
              onAfterEnter={() => setHasTransition(false)}
            >
              <Switch>
                <Match when={activeTab() === TabKey.Translate}>
                  {(_) => {
                    const isAppearing = useIsAppearing(hasTransition);
                    return <div><TranslateTab isAppearing={isAppearing()} /></div>;
                  }}
                </Match>
                <Match when={activeTab() === TabKey.Style}>
                  <div><StyleTab /></div>
                </Match>
                <Match when={activeTab() === TabKey.Fix}>
                  {(_) => {
                    const isAppearing = useIsAppearing(hasTransition);
                    return <div><FixTab isAppearing={isAppearing()} /></div>;
                  }}
                </Match>
              </Switch>
            </Transition>
          </AutoHeight>
        </div>
      </Scrollable>
      <Space amount='0.5rem' />
      <div class={/* @once */ styles.footerButtons}>
        <Button
          class={/* @once */ styles.applyButton}
          primaryFilled
          disabled={!resultText()}
          onClick={() => {
            if (!resultText()) return;
            onApply(resultText() as LocalTextWithEntities);
          }}
        >
          <I18nTsx key='Apply' />
        </Button>
        <Show when={onSend} keyed>
          {(_send) => {
            let sendButton!: HTMLElement;

            const withEffects = () => peerId.isUser() && peerId !== rootScope.myId;

            if (!isScheduled) {
              onMount(() => {
                const sendMenu = new SendContextMenu({
                  onSilentClick: () => sendResult({ silent: true }),
                  onScheduleClick: openScheduleAndSend,
                  onSendWhenOnlineClick: () => sendResult({ scheduleDate: SEND_WHEN_ONLINE_TIMESTAMP }),
                  onOpen: () => !!resultText(),
                  openSide: 'top-left',
                  onContextElement: sendButton,
                  middleware: createMiddleware().get(),
                  canSendWhenOnline,
                  onRef: (element) => sendButton.parentElement!.append(element),
                  withEffects,
                  effect: effectAccessor,
                  onEffect: setEffect,
                });

                sendMenu.setPeerParams({ peerId, isPaid: false });
              });
            }

            return (
              <div class={/* @once */ styles.sendButtonWrapper}>
                <Button
                  ref={sendButton}
                  class={/* @once */ styles.sendButton}
                  primaryFilled
                  disabled={!resultText()}
                  onClick={handleSendClick}
                >
                  <IconTsx class={/* @once */ styles.sendButtonIcon} icon='logo' />
                </Button>
                <Show when={!isScheduled}>
                  <SelectedEffect effect={effectAccessor} />
                </Show>
              </div>
            );
          }}
        </Show>
      </div>
    </div>
  );
};
