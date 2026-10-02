export type EventKind = 'gold' | 'clouds' | 'turbo' | 'character' | 'fireworks';
export type EventStatus = 'queued' | 'running' | 'completed' | 'review';

export interface StreamEvent {
  id: string;
  kind: EventKind;
  viewer: string;
  character?: string;
  status: EventStatus;
}

export interface ActiveEffect {
  event: StreamEvent;
  remaining: number;
  elapsed: number;
}

export const EVENT_NAMES: Record<EventKind, string> = {
  gold: 'Золотая звезда', clouds: 'Облачный дождь', turbo: 'Турбо-башня',
  character: 'Выбор героя', fireworks: 'Фейерверк',
};

export class EventQueue {
  readonly events: StreamEvent[];
  active: ActiveEffect | null = null;
  private readonly save: (events: StreamEvent[]) => void;

  constructor(saved: unknown = [], save: (events: StreamEvent[]) => void = () => {}) {
    this.save = save;
    const ids = new Set<string>();
    this.events = Array.isArray(saved) ? saved.filter((item): item is StreamEvent => {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
        || !Object.hasOwn(EVENT_NAMES, item.kind) || typeof item.viewer !== 'string'
        || !['queued', 'running', 'completed', 'review'].includes(item.status)
        || (item.kind === 'character' && typeof item.character !== 'string')) return false;
      ids.add(item.id);
      return true;
    }).map(item => ({ ...item, status: item.status === 'running' ? 'review' : item.status })) : [];
    this.save(this.events);
  }

  enqueue(input: Omit<StreamEvent, 'status'>) {
    if (!input.id || this.events.some(event => event.id === input.id)) return false;
    this.events.push({ ...input, viewer: input.viewer.trim().slice(0, 40) || 'Зритель', status: 'queued' });
    this.save(this.events);
    return true;
  }

  takeCharacter() {
    const event = this.events.find(item => item.kind === 'character' && item.status === 'queued');
    if (event) this.complete(event);
    return event;
  }

  tick(dt: number, playing: boolean, execute: (event: StreamEvent) => void) {
    if (!playing) return;
    if (this.active) {
      this.active.elapsed += dt;
      this.active.remaining -= dt;
      if (this.active.remaining <= 0) {
        this.complete(this.active.event);
        this.active = null;
      }
    }
    // Cosmetic effects can run alongside mechanics, but mechanics remain FIFO.
    for (const event of this.events.filter(item => item.status === 'queued' && item.kind === 'fireworks')) {
      execute(event);
      this.complete(event);
    }
    const next = this.events.find(item => item.status === 'queued' && item.kind !== 'character');
    if (!next) return;
    if (this.active) {
      const duration = next.kind === 'clouds' ? 30 : next.kind === 'turbo' ? 20 : 0;
      if (next.kind === this.active.event.kind && duration && this.active.elapsed + this.active.remaining + duration <= 60) {
        this.active.remaining += duration;
        this.complete(next);
      }
      return;
    }
    next.status = 'running';
    this.save(this.events);
    execute(next);
    if (next.kind === 'clouds' || next.kind === 'turbo') {
      this.active = { event: next, remaining: next.kind === 'clouds' ? 30 : 20, elapsed: 0 };
    } else if (next.kind === 'gold') {
      this.active = { event: next, remaining: Infinity, elapsed: 0 };
    } else {
      this.complete(next);
    }
  }

  endRun() {
    if (this.active) this.complete(this.active.event);
    this.active = null;
  }

  completeGold() {
    if (this.active?.event.kind !== 'gold') return;
    this.complete(this.active.event);
    this.active = null;
  }

  deferGold() {
    if (this.active?.event.kind !== 'gold') return;
    this.active.event.status = 'queued';
    this.active = null;
    this.save(this.events);
  }

  private complete(event: StreamEvent) {
    event.status = 'completed';
    this.save(this.events);
  }
}
