import { createEffect, For, JSX, on, onMount, splitProps } from 'solid-js';
import TransitionSlider, { TransitionSliderOptions } from '@/components/transition';
import clsx from 'clsx';

export function TransitionSliderTsx(props: Omit<TransitionSliderOptions, 'content'> & {
  children: JSX.Element[]
  currentPage: number
  class?: string
  tabClass?: string
}) {
  const [, rest] = splitProps(props, ['children', 'currentPage', 'class', 'tabClass']);

  let ref!: HTMLDivElement;
  onMount(() => {
    const transitionTo = TransitionSlider({
      ...rest,
      content: ref,
    });

    createEffect(on(() => props.currentPage, (currentPage) => transitionTo(currentPage)));
  })

  return (
    <div class={clsx('tabs-container', props.class)} ref={ref}>
      <For each={props.children}>
        {(child) => (
          <div class={clsx('tabs-tab', props.tabClass)}>
            {child}
          </div>
        )}
      </For>
    </div>
  )
}
