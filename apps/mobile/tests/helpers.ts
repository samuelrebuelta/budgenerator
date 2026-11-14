import { authState, emitAuthUser, fakeUser, type FakeUser } from './fakeRepositories';

/** Signed-in user that the fake auth repository reports first (`null` → signed out). */
export function setMockUser(user: { uid: string } | FakeUser | null) {
  authState.user = user ? fakeUser(user.uid, user as Partial<FakeUser>) : null;
}

export { emitAuthUser, fakeUser };

interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: (HostNode | string)[] | null;
}

function collectHosts(node: unknown, prefix: string, out: HostNode[]) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => collectHosts(child, prefix, out));
    return;
  }
  const host = node as HostNode;
  if (host.type.startsWith(prefix)) out.push(host);
  collectHosts(host.children, prefix, out);
}

/**
 * Native tab bar as `NativeTabs` hands it to react-native-screens (`RNSTabsHostIOS` and one
 * `RNSTabsScreenIOS` per tab): the tab bar itself is drawn by UIKit, so the tests read its props.
 */
export function nativeTabBar(tree: unknown) {
  const hosts: HostNode[] = [];
  collectHosts(tree, 'RNSTabs', hosts);
  const host = hosts.find((node) => node.type === 'RNSTabsHostIOS');
  const items = hosts
    .filter((node) => node.type === 'RNSTabsScreenIOS')
    .map((node) => ({
      key: node.props.screenKey as string,
      title: node.props.title as string,
      icon: node.props.iconResourceName as string,
      selectedIcon: node.props.selectedIconResourceName as string,
      testID: node.props.tabBarItemTestID as string,
    }));
  const request = host?.props.navStateRequest as { selectedScreenKey?: string } | undefined;
  return { host: host?.props ?? {}, items, selected: request?.selectedScreenKey };
}
