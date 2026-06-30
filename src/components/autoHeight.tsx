import { batch, createSignal, JSX, onCleanup, onMount, Ref } from 'solid-js';

export const AutoHeight = (props: {
  children: JSX.Element;
  duration?: number;
  overflowHidden?: boolean;
  easing?: JSX.CSSProperties['transition-property'];
  ref?: Ref<HTMLDivElement>;
  outerClass?: string;
  hasTransition?: boolean;
}) => {
  let containerRef!: HTMLDivElement;
  let contentRef!: HTMLDivElement;

  const [canHaveHeight, setCanHaveHeight] = createSignal(false);
  const [height, setHeight] = createSignal(0);

  onMount(() => {
    const observer = new ResizeObserver(() => {
      batch(() => {
        setCanHaveHeight(true);
        setHeight(contentRef.offsetHeight);
      });
    });

    observer.observe(contentRef);

    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      ref={(el) => {
        containerRef = el;
        if (typeof props.ref === 'function') (props.ref as (el: HTMLDivElement) => void)(el);
      }}
      class={props.outerClass}
      style={{
        height: canHaveHeight() ? `${height()}px` : 'auto',
        overflow: props.overflowHidden ? 'hidden' : undefined,
        transition: canHaveHeight() ? `height ${props.duration ?? 200}ms ${props.easing ?? 'ease'}` : 'none',
      }}
    >
      <div ref={contentRef}>{props.children}</div>
    </div>
  );
};
