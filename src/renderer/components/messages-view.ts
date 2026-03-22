import type { CaptureItem } from '../store/capture-store';
import type { AnthropicContentBlock } from '../../shared/types/capture';
import { parseUserText } from '../../shared/user-text-parser';
import { esc } from '../../shared/sanitize';
import { i18n } from '../i18n/index';
import { uiStore, type MsgFilter } from '../store/ui-store';
import { bus } from '../store/event-bus';

export function renderMessagesView(container: HTMLElement, item: CaptureItem): void {
  const reqMsgs = item.request.body?.messages || [];

  // 응답 본문의 assistant 메시지를 추가 (API 응답 = 최신 답변)
  const respBody = item.response?.body;
  const msgs = [...reqMsgs];
  if (respBody && typeof respBody === 'object' && 'content' in respBody && respBody.role === 'assistant') {
    msgs.push({ role: 'assistant', content: respBody.content as AnthropicContentBlock[] });
  }

  if (msgs.length === 0) {
    container.innerHTML = `<div class="empty-state"><span>${i18n.t('proxy.noMessages')}</span></div>`;
    return;
  }

  const filter = uiStore.msgFilter;
  const q = uiStore.searchQuery;

  // 필터 바
  const filterHtml = `<div class="msg-filter">
    ${(['all', 'user', 'assistant'] as MsgFilter[]).map((f) =>
      `<button class="mf-btn${filter === f ? ' active' : ''}" data-filter="${f}">${i18n.t('messages.filter' + f.charAt(0).toUpperCase() + f.slice(1))}</button>`
    ).join('')}
    <span class="msg-count" id="msgCount"></span>
  </div>`;

  // 검색 바
  const searchHtml = `<div class="msg-search-bar">
    <input type="text" class="msg-search-input" id="msgSearchInput"
      placeholder="${esc(i18n.t('messages.searchPlaceholder'))}" value="${esc(q)}">
    ${q ? '<button class="msg-search-clear" id="msgSearchClear">✕</button>' : ''}
  </div>`;

  // 메시지 카드
  const baseFiltered = filter === 'user'
    ? msgs.filter((m) => m.role === 'user')
    : filter === 'assistant'
      ? msgs.filter((m) => m.role === 'assistant')
      : msgs;

  const isUserFilter = filter === 'user';
  const cards: string[] = [];
  for (const msg of baseFiltered) {
    const contents: AnthropicContentBlock[] = Array.isArray(msg.content)
      ? msg.content as AnthropicContentBlock[]
      : [{ type: 'text', text: String(msg.content || '') }];

    if (isUserFilter && msg.role === 'user') {
      const hasTyped = contents.some((c) => {
        if (c.type !== 'text' || !c.text?.trim()) return false;
        return parseUserText(c.text!).some((p) => p.type === 'text');
      });
      if (!hasTyped) continue;
    }

    const bodyParts: string[] = [];
    for (const c of contents) {
      if (c.type === 'text' && c.text) {
        if (msg.role === 'user') {
          const parts = parseUserText(c.text);
          for (const p of parts) {
            if (p.type === 'text') {
              bodyParts.push(`<div class="msg-typed">${highlightSearch(esc(p.content), q)}</div>`);
            } else {
              const uid = Math.random().toString(36).slice(2, 8);
              bodyParts.push(`<div>
                <span class="msg-badge ${p.cls || 'green'}" data-badge-uid="${uid}">${esc(p.label || '')}</span>
                <div class="badge-expand-content" data-badge-content="${uid}">${highlightSearch(esc(p.content), q)}</div>
              </div>`);
            }
          }
        } else {
          bodyParts.push(`<div class="msg-text">${highlightSearch(esc(c.text), q)}</div>`);
        }
      } else if (c.type === 'tool_use' && !isUserFilter) {
        bodyParts.push(`<div class="msg-tool">🔧 ${esc(c.name || '')}()</div>`);
      } else if (c.type === 'tool_result' && !isUserFilter) {
        const preview = typeof c.content === 'string'
          ? c.content.slice(0, 120)
          : Array.isArray(c.content)
            ? (c.content as Array<{text?: string}>).map((x) => x.text || '').join('').slice(0, 120)
            : '[object]';
        bodyParts.push(`<div class="msg-tool-result">📤 ${esc(preview)}${preview.length >= 120 ? '…' : ''}</div>`);
      }
    }

    if (bodyParts.length === 0) continue;
    if (q && !bodyParts.join('').includes('search-hl')) continue;

    cards.push(`<div class="msg-card msg-${esc(msg.role)}">
      <div class="msg-role">${esc(msg.role)}</div>
      <div class="msg-body">${bodyParts.join('')}</div>
    </div>`);
  }

  container.style.cssText = 'flex:1;overflow-y:auto;display:block';
  container.innerHTML =
    `<div style="position:sticky;top:0;z-index:1;background:var(--bg)">${filterHtml}${searchHtml}</div>`
    + `<div class="msgs-list">${cards.length > 0 ? cards.join('') : `<div class="empty-state">${i18n.t('proxy.noBody')}</div>`}</div>`;

  const countEl = document.getElementById('msgCount');
  if (countEl) countEl.textContent = `${cards.length} / ${msgs.length}`;

  // 이벤트 바인딩
  container.querySelectorAll<HTMLElement>('.mf-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiStore.setMsgFilter(btn.dataset.filter as MsgFilter);
      renderMessagesView(container, item);
    });
  });

  const searchInput = document.getElementById('msgSearchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      uiStore.setSearch(searchInput.value);
      renderMessagesView(container, item);
      const inp = document.getElementById('msgSearchInput') as HTMLInputElement | null;
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    });
  }

  const clearBtn = document.getElementById('msgSearchClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      uiStore.setSearch('');
      renderMessagesView(container, item);
    });
  }

  // 배지 토글
  container.querySelectorAll<HTMLElement>('.msg-badge').forEach((badge) => {
    badge.addEventListener('click', () => {
      const uid = badge.dataset.badgeUid;
      if (!uid) return;
      const content = container.querySelector(`[data-badge-content="${uid}"]`) as HTMLElement | null;
      if (!content) return;
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'block';
      badge.classList.toggle('open', !isOpen);
    });
  });
}

function highlightSearch(html: string, query: string): string {
  if (!query) return html;
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return html.replace(re, (m) => `<mark class="search-hl">${m}</mark>`);
}
