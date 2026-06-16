import type { AnyDialog } from '@/lib/storages/dialogs';
import type { Dialog } from '@/lib/appManagers/appMessagesManager';
import type getDialogIndexKey from '@/lib/appManagers/utils/dialogs/getDialogIndexKey';

export default function setDialogIndex(
  dialog: AnyDialog,
  indexKey: ReturnType<typeof getDialogIndexKey>,
  index: number
) {
  return (dialog as Dialog)[indexKey] = index;
}
