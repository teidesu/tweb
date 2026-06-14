import {createRoot} from 'solid-js';
import {createStore, unwrap} from 'solid-js/store';
import {StateSettings} from '@config/state';
import rootScope from '@lib/rootScope';
import {joinDeepPath} from '@helpers/object/setDeepProperty';
import getDeepProperty from '@helpers/object/getDeepProperty';
import {MOUNT_CLASS_TO} from '@config/debug';
import {SetStoreFunctionReturning} from '@helpers/solid/setStoreFunctionReturning';

const [appSettings, _setAppSettings] = createRoot(() => createStore<StateSettings>({} as any));

let silent = false;
const setAppSettings = ((...args: any[]) => {
  const keys = args.slice(0, -1);
  // @ts-ignore
  _setAppSettings(...args);
  const newValue = getDeepProperty(unwrap(appSettings), keys);

  if(silent) {
    return Promise.resolve();
  }

  return rootScope.managers.appStateManager.setByKey(joinDeepPath('settings', ...keys), newValue);
}) as SetStoreFunctionReturning<StateSettings, Promise<void>>;

const setAppSettingsSilent = (...args: any[]) => {
  const key = args[0];
  if(typeof(key) === 'object') {
    _setAppSettings(key);
    return;
  }

  silent = true;
  // @ts-ignore
  setAppSettings(...args);
  silent = false;
};

const useAppSettings = () => [appSettings, setAppSettings] as const;

export {
  appSettings,
  useAppSettings,
  setAppSettings,
  setAppSettingsSilent
};

MOUNT_CLASS_TO && (MOUNT_CLASS_TO.useAppSettings = useAppSettings);
