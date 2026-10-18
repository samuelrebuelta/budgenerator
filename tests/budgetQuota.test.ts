import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/entities/user/api/firestore', () => ({}));
import { getBudgetSlotsUsed } from '../src/shared/lib/utils';
import { useUserStore } from '../src/entities/user/model/store';
import { user } from './fixtures';

afterEach(() => useUserStore.setState({ userData: null, loaded: false }));

describe('getBudgetSlotsUsed', () => {
  it('counts every historical creation', () => {
    expect([0, 2, 3, 4].map(getBudgetSlotsUsed)).toEqual([0, 2, 3, 4]);
  });
});

describe('shared free budget quota', () => {
  it('blocks a fourth free budget even when a legacy conversion released a slot', () => {
    useUserStore.setState({
      userData: { ...user(), totalBudgetsCreated: 3, budgetSlotsReleased: 2 },
      loaded: true,
    });

    expect(useUserStore.getState().canCreateBudget()).toBe(false);
  });

  it('keeps premium creation unrestricted', () => {
    useUserStore.setState({
      userData: {
        ...user(),
        totalBudgetsCreated: 100,
        accountData: { isAdmin: false, plan: 'premium' },
      },
      loaded: true,
    });

    expect(useUserStore.getState().canCreateBudget()).toBe(true);
  });
});
