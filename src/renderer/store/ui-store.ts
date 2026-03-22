import { bus } from './event-bus';

export type DetailTab = 'messages' | 'request' | 'response' | 'analysis' | 'stats';
export type MsgFilter = 'all' | 'user' | 'assistant';

export const uiStore = {
  activeTab: 'messages' as DetailTab,
  msgFilter: 'all' as MsgFilter,
  searchQuery: '',
  locale: (localStorage.getItem('ccs-lang') ||
    (navigator.language.startsWith('ko') ? 'ko' : 'en')) as 'ko' | 'en',
  proxyRunning: false,
  proxyPort: 9002,

  setTab(tab: DetailTab): void {
    this.activeTab = tab;
    this.searchQuery = '';
    bus.emit('ui:tab-changed', tab);
  },

  setMsgFilter(f: MsgFilter): void {
    this.msgFilter = f;
    bus.emit('ui:filter-changed', f);
  },

  setSearch(q: string): void {
    this.searchQuery = q;
    bus.emit('ui:search-changed', q);
  },

  setLocale(lang: 'ko' | 'en'): void {
    this.locale = lang;
    localStorage.setItem('ccs-lang', lang);
    bus.emit('ui:locale-changed', lang);
  },

  setProxyState(running: boolean, port?: number): void {
    this.proxyRunning = running;
    if (port !== undefined) this.proxyPort = port;
    bus.emit('ui:proxy-changed', { running, port: this.proxyPort });
  },
};
