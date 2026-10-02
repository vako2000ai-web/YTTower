import test from 'node:test';
import assert from 'node:assert/strict';
import { EventQueue } from '../src/events.ts';
import { recordKey, readRecord } from '../src/records.ts';

test('duplicates are rejected even after completion and results pause execution', () => {
  const q = new EventQueue();
  const event = { id: 'payment-1', kind: 'gold' as const, viewer: 'Tester' };
  let executed = 0;
  q.enqueue(event);
  q.tick(1, false, () => executed++);
  assert.equal(executed, 0);
  q.tick(1, true, () => executed++);
  assert.equal(executed, 1);
  assert.equal(q.enqueue(event), false);
});

test('mechanics are FIFO; fireworks do not block; effect cap is 60 seconds', () => {
  const q = new EventQueue();
  for (const [i, kind] of ['turbo', 'turbo', 'turbo', 'turbo', 'clouds', 'fireworks'].entries()) {
    q.enqueue({ id: String(i), kind: kind as 'turbo' | 'clouds' | 'fireworks', viewer: 'Tester' });
  }
  const executed: string[] = [];
  for (let i = 0; i < 4; i++) q.tick(0, true, e => executed.push(e.kind));
  assert.equal(q.active?.remaining, 60);
  assert.equal(q.events[3].status, 'queued');
  assert.deepEqual(executed, ['fireworks', 'turbo']);
  q.tick(61, true, e => executed.push(e.kind));
  assert.equal(q.active?.remaining, 20);
  q.endRun();
  assert.equal(q.active, null);
  assert.equal(q.events[4].status, 'queued');
});

test('another effect in queue prevents extension from overtaking it', () => {
  const q = new EventQueue();
  for (const [i, kind] of ['turbo', 'clouds', 'turbo'].entries()) {
    q.enqueue({ id: String(i), kind: kind as 'turbo' | 'clouds', viewer: 'Tester' });
  }
  q.tick(0, true, () => {});
  q.tick(0, true, () => {});
  assert.equal(q.active?.remaining, 20);
  assert.equal(q.events[2].status, 'queued');
});

test('gold purchases wait for the previous star instead of merging into one', () => {
  const q = new EventQueue();
  q.enqueue({ id: 'gold-1', kind: 'gold', viewer: 'A' });
  q.enqueue({ id: 'gold-2', kind: 'gold', viewer: 'B' });
  let stars = 0;
  q.tick(0, true, () => stars++);
  q.tick(1, true, () => stars++);
  assert.equal(stars, 1);
  assert.equal(q.events[1].status, 'queued');
  q.completeGold();
  q.tick(1, true, () => stars++);
  assert.equal(stars, 2);
});

test('gold request not yet spawned is deferred rather than lost at finish', () => {
  const q = new EventQueue();
  q.enqueue({ id: 'gold', kind: 'gold', viewer: 'A' });
  q.tick(0, true, () => {});
  q.deferGold();
  q.endRun();
  assert.equal(q.events[0].status, 'queued');
  assert.equal(q.active, null);
});

test('restart preserves queued events and flags interrupted execution for review', () => {
  const q = new EventQueue([
    { id: '1', kind: 'turbo', viewer: 'A', status: 'running' },
    { id: '2', kind: 'character', character: 'Tiny Ninja', viewer: 'B', status: 'queued' },
    { id: '3', kind: '__proto__', viewer: 'C', status: 'queued' },
  ]);
  assert.equal(q.events[0].status, 'review');
  assert.equal(q.events.length, 2);
  assert.equal(q.takeCharacter()?.character, 'Tiny Ninja');
  assert.equal(q.takeCharacter(), undefined);
});

test('records separate configs and support category; legacy or invalid values are ignored', () => {
  assert.notEqual(recordKey({ floors: 100 }, 'standard'), recordKey({ floors: 100 }, 'supported'));
  assert.notEqual(recordKey({ floors: 100 }, 'standard'), recordKey({ floors: 10 }, 'standard'));
  assert.equal(recordKey({ floors: 100, speed: 1 }, 'standard'), recordKey({ speed: 1, floors: 100 }, 'standard'));
  assert.equal(readRecord(null), Infinity);
  assert.equal(readRecord(-5), Infinity);
  assert.equal(readRecord(12.5), 12.5);
});
