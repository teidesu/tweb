import { createEffect, createResource, JSX, on } from 'solid-js';
import clsx from 'clsx';
import { Message } from '@/layer';

import styles from '@/components/chat/bubbles/service.module.scss';
import wrapMessageActionTextNew from '@/components/wrappers/messageActionTextNew';

export function ServiceBubble(props: {
  class?: string
  message: Message.messageService
  children?: JSX.Element
}) {
  const [text, { refetch }] = createResource(() => wrapMessageActionTextNew({
    message: props.message,
  }))
  createEffect(on(() => props.message, refetch))

  return (
    <div class={clsx(styles.wrap, props.class)}>
      <div class={/* @once */ styles.text}>
        {text()}
      </div>
      {props.children}
    </div>
  )
}
