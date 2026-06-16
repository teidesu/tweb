import { Dynamic } from 'solid-js/web';
import { JSX, Ref } from 'solid-js';
import classNames from '@/helpers/string/classNames';

export default function Badge(props: {
  tag: 'span' | 'div',
  size: number,
  color: 'primary' | 'gray',
  children: JSX.Element,
  class?: string,
  ref?: Ref<HTMLElement>
}) {
  return (
    <Dynamic
      ref={props.ref}
      component={props.tag}
      class={classNames(
        'badge',
        `badge-${props.size}`,
        `badge-${props.color}`,
        !props.children && 'is-badge-empty',
        props.class
      )}
    >
      {props.children}
    </Dynamic>
  );
}
