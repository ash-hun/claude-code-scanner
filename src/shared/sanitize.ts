/** HTML 엔티티 이스케이프 (XSS 방지) */
export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** HTML 속성값 이스케이프 */
export function escAttr(s: unknown): string {
  return esc(s).replace(/"/g, '&quot;');
}
