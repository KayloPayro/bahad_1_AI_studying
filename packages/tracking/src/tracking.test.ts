import { beforeEach, describe, expect, it } from 'vitest';
import { clearIdentity, getIdentity, maskPn, setIdentity, validatePn } from './identity';
import { enqueue, flush, readQueue, type TrackEvent } from './queue';
import { removeItem } from './storage';

const ev = (step: number): TrackEvent => ({
  pn: '9324493',
  team: '18',
  module: 'L01',
  event: 'step',
  step,
  score: '',
  seconds: step * 10,
  version: '1.0',
});

describe('identity', () => {
  beforeEach(() => clearIdentity());
  it('validates digits-only fixed length', () => {
    expect(validatePn('9324493', 7)).toBeNull();
    expect(validatePn('932449', 7)).toBe('מספר אישי הוא 7 ספרות, בלי אותיות ורווחים');
    expect(validatePn('93244a3', 7)).not.toBeNull();
    expect(validatePn('932 4493', 7)).not.toBeNull();
    expect(validatePn('1234567890', 10)).toBeNull();
  });
  it('masks all but the last three digits', () => {
    expect(maskPn('9324493')).toBe('XXXX493');
  });
  it('persists and clears', () => {
    setIdentity({ pn: '9324493', team: '18' });
    expect(getIdentity()).toEqual({ pn: '9324493', team: '18' });
    clearIdentity();
    expect(getIdentity()).toBeNull();
  });
});

describe('event queue', () => {
  beforeEach(() => removeItem('lumda.queue'));

  it('sends in order and empties the queue', async () => {
    const sent: number[] = [];
    enqueue(ev(1));
    enqueue(ev(2));
    const n = await flush('https://x', async (_u, body) => {
      sent.push(JSON.parse(body).step);
    });
    expect(n).toBe(2);
    expect(sent).toEqual([1, 2]);
    expect(readQueue()).toEqual([]);
  });

  it('keeps events when offline and resends later', async () => {
    enqueue(ev(1));
    enqueue(ev(2));
    const n = await flush('https://x', async () => {
      throw new TypeError('offline');
    });
    expect(n).toBe(0);
    expect(readQueue()).toHaveLength(2);
    const sent: number[] = [];
    await flush('https://x', async (_u, b) => void sent.push(JSON.parse(b).step));
    expect(sent).toEqual([1, 2]);
  });

  it('stops at the first failure and keeps the rest', async () => {
    enqueue(ev(1));
    enqueue(ev(2));
    let calls = 0;
    await flush('https://x', async () => {
      if (++calls === 2) throw new Error('net');
    });
    expect(readQueue().map((e) => e.step)).toEqual([2]);
  });

  it('a flush on an empty queue does not block later flushes (regression)', async () => {
    const sent: number[] = [];
    const send = async (_u: string, b: string) => void sent.push(JSON.parse(b).step);
    expect(await flush('https://x', send)).toBe(0);
    enqueue(ev(7));
    expect(await flush('https://x', send)).toBe(1);
    expect(sent).toEqual([7]);
  });

  it('does nothing without a URL (tracking not connected yet)', async () => {
    enqueue(ev(1));
    expect(await flush('', async () => undefined)).toBe(0);
    expect(readQueue()).toHaveLength(1);
  });
});
