import type { CaptureItem } from '../store/capture-store';
import { renderRequestAnatomy } from './request-anatomy';
import { renderOperationFlow } from './operation-flow';
import { renderMechDetail } from './mech-detail';

export function renderAnalysisView(container: HTMLElement, item: CaptureItem): void {
  container.style.cssText = 'flex:1;overflow-y:auto;display:block';

  const html = `<div class="analysis-container">
    ${renderRequestAnatomy(item)}
    ${renderOperationFlow(item)}
    ${renderMechDetail(item)}
  </div>`;

  container.innerHTML = html;

  // 섹션 헤더 클릭 → 섹션 접기/펼치기
  container.querySelectorAll<HTMLElement>('[data-section-toggle]').forEach((header) => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling as HTMLElement | null;
      const toggle = header.querySelector('.section-toggle') as HTMLElement | null;
      if (!body) return;
      const isCollapsed = body.classList.toggle('collapsed');
      if (toggle) toggle.classList.toggle('collapsed', isCollapsed);
    });
  });

  // 내부 블록 클릭 → 확대/축소
  container.querySelectorAll<HTMLElement>('.op-detail, .op-result, .mech-block-content').forEach((el) => {
    el.addEventListener('click', () => {
      el.classList.toggle('expanded');
    });
  });
}
