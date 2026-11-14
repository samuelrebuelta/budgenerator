import * as sessionReset from '../src/platform/sessionReset';
import { existingUserStorage, userStorage } from '../src/platform/userStorage';
import { deviceSessionUid, reconcileDeviceSession } from '../src/session';
import { setMockUser } from './helpers';

describe('cambio de cuenta (D3)', () => {
  it('borra los datos de la cuenta anterior sin cerrar la sesión de la nueva', async () => {
    const reset = jest.spyOn(sessionReset, 'resetSession');
    await reconcileDeviceSession('alice');
    expect(deviceSessionUid()).toBe('alice');
    expect(reset).not.toHaveBeenCalled();
    userStorage('alice').set('navigation.lastTab', 'team');

    setMockUser({ uid: 'bob' });
    await reconcileDeviceSession('bob');

    expect(reset).toHaveBeenCalledWith('alice', undefined, { signOut: false });
    expect(existingUserStorage('alice')?.getString('navigation.lastTab')).toBeUndefined();
    expect(deviceSessionUid()).toBe('bob');
  });

  it('bloquea la sesión nueva si no se puede borrar la anterior y lo reintenta', async () => {
    await reconcileDeviceSession('carol');
    const reset = jest
      .spyOn(sessionReset, 'resetSession')
      .mockRejectedValueOnce(new sessionReset.SessionResetError([]));

    await expect(reconcileDeviceSession('dave')).rejects.toThrow(sessionReset.SessionResetError);
    expect(deviceSessionUid()).toBe('carol');

    await reconcileDeviceSession('dave');
    expect(reset).toHaveBeenLastCalledWith('carol', undefined, { signOut: false });
    expect(deviceSessionUid()).toBe('dave');
  });
});
