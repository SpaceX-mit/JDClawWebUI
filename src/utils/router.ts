export type Route = 'chat' | 'sessions' | 'agents' | 'settings';

export const ROUTES: { id: Route; label: string; icon: string }[] = [
  { id: 'chat', label: '聊天', icon: 'chat' },
  { id: 'sessions', label: '会话', icon: 'sessions' },
  { id: 'agents', label: '助手', icon: 'agents' },
  { id: 'settings', label: '设置', icon: 'settings' },
];

export function getCurrentRoute(): Route {
  const hash = window.location.hash.replace('#/', '').split('?')[0];
  const route = ROUTES.find(r => r.id === hash);
  return route ? route.id : 'chat';
}

export function navigateTo(route: Route): void {
  window.location.hash = `#/${route}`;
}

export function onRouteChange(callback: (route: Route) => void): () => void {
  const handler = () => callback(getCurrentRoute());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
