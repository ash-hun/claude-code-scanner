import { bus } from './event-bus';
import type { CaptureRequest, CaptureResponse } from '../../shared/types/capture';
import { detectMechanisms } from '../../shared/mechanism-detector';
import type { MechanismDetection } from '../../shared/types/analysis';

export interface CaptureItem {
  request: CaptureRequest;
  response: CaptureResponse | null;
  mechanisms: MechanismDetection | null;
}

export const captureStore = {
  entries: [] as CaptureItem[],
  selectedId: null as number | null,

  addRequest(req: CaptureRequest): void {
    const mechanisms = req.body ? detectMechanisms(req.body) : null;
    this.entries.unshift({ request: req, response: null, mechanisms });
    if (this.entries.length > 200) this.entries.pop();
    bus.emit('captures:changed', this.entries);
  },

  setResponse(resp: CaptureResponse): void {
    const entry = this.entries.find((e) => e.request.id === resp.id);
    if (entry) {
      entry.response = resp;
      bus.emit('captures:changed', this.entries);
      if (this.selectedId === resp.id) {
        bus.emit('captures:selected', entry);
      }
    }
  },

  select(id: number): void {
    this.selectedId = id;
    const entry = this.entries.find((e) => e.request.id === id) || null;
    bus.emit('captures:selected', entry);
  },

  getSelected(): CaptureItem | null {
    if (this.selectedId === null) return null;
    return this.entries.find((e) => e.request.id === this.selectedId) || null;
  },

  clear(): void {
    this.entries = [];
    this.selectedId = null;
    bus.emit('captures:changed', this.entries);
    bus.emit('captures:selected', null);
  },
};
