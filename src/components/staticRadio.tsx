import styles from '@/components/staticRadio.module.scss';
import clsx from 'clsx';
import { JSX, splitProps } from 'solid-js';


const StaticRadio = (inProps: {
  checked?: boolean;
  floating?: boolean;
  class?: string;
} & JSX.HTMLAttributes<HTMLSpanElement>) => {
  const [props, spanProps] = splitProps(inProps, ['checked', 'floating', 'class', 'classList']);

  return <span
    class={clsx(styles.Radio, props.class)}
    classList={{
      [styles.checked]: props.checked,
      [styles.floating]: props.floating,
      'offset-left': props.floating,
      ...props.classList,
    }}
    {...spanProps}
  />;
};

export default StaticRadio;
