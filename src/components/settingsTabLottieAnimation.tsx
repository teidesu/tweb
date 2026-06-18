import { Component } from 'solid-js';
import clsx from 'clsx';
import type { LottieAssetName } from '@/lib/rlottie/lottieLoader';
import { useHotReloadGuard } from '@/lib/solidjs/hotReloadGuard';
import LottieAnimationBase from '@/components/lottieAnimation';
import styles from '@/components/settingsTabLottieAnimation.module.scss';
import { usePromiseCollector } from '@/components/solidJsTabs/promiseCollector';


const SettingsTabLottieAnimation: Component<{
  class?: string;
  name: LottieAssetName;
  size?: number;
}> = (props) => {
  const { lottieLoader } = useHotReloadGuard();
  const promiseCollector = usePromiseCollector();

  return (
    <LottieAnimationBase
      lottieLoader={lottieLoader}
      onPromise={(promise) => promiseCollector.collect(promise)}
      restartOnClick
      class={clsx(props.class, styles.Container)}
      {...props}
    />
  );
}

export default SettingsTabLottieAnimation;
