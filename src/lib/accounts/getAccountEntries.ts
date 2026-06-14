import {User} from '@layer';
import rootScope from '@lib/rootScope';
import AccountController from '@lib/accounts/accountController';
import {getCurrentAccount} from '@lib/accounts/getCurrentAccount';
import {createProxiedManagersForAccount} from '@lib/getProxiedManagers';
import {ActiveAccountNumber} from '@lib/accounts/types';

export type AccountEntry = {
  accountNumber: ActiveAccountNumber;
  peerId: PeerId;
  user?: User.user;
  active: boolean;
};

export async function getAccountEntries(): Promise<AccountEntry[]> {
  const totalAccounts = await AccountController.getTotalAccounts();
  return Promise.all(Array.from({length: totalAccounts}, async(_, idx): Promise<AccountEntry> => {
    const accountNumber = (idx + 1) as ActiveAccountNumber;
    const active = accountNumber === getCurrentAccount();

    if(active) {
      return {
        accountNumber,
        peerId: rootScope.myId,
        user: await rootScope.managers.appUsersManager!.getSelf(),
        active
      };
    }

    const [accountData, user] = await Promise.all([
      AccountController.get(accountNumber),
      createProxiedManagersForAccount(accountNumber).appUsersManager!.getSelf()
    ]);

    return {
      accountNumber,
      peerId: accountData.userId?.toPeerId()!,
      user,
      active
    };
  }));
}
