import { describe, it, expect } from 'vitest';
import { parseSSEEvent, SSEStreamParser } from '../use-sse-parser';

describe('parseSSEEvent', () => {
  it('parses text-delta event', () => {
    const result = parseSSEEvent('text-delta', '{"text":"Hello"}');
    expect(result).toEqual({
      type: 'text-delta',
      data: { text: 'Hello' },
    });
  });

  it('parses plan-step event', () => {
    const result = parseSSEEvent(
      'plan-step',
      '{"step":"Analyzing CSV","index":0,"total":3}',
    );
    expect(result).toEqual({
      type: 'plan-step',
      data: { step: 'Analyzing CSV', index: 0, total: 3 },
    });
  });

  it('parses blueprint-item event', () => {
    const data = JSON.stringify({
      rid: 'ri.test.001',
      itemType: 'object_type',
      suggestion: { displayName: 'Order' },
      confidence: 0.92,
      confidenceLevel: 'high',
    });
    const result = parseSSEEvent('blueprint-item', data);
    expect(result?.type).toBe('blueprint-item');
    expect(result?.data).toHaveProperty('rid', 'ri.test.001');
  });

  it('parses blueprint-complete event', () => {
    const data = JSON.stringify({
      blueprintRid: 'ri.test.bp',
      name: 'E-Commerce',
      status: 'pending_review',
      itemCount: 8,
    });
    const result = parseSSEEvent('blueprint-complete', data);
    expect(result?.type).toBe('blueprint-complete');
  });

  it('parses done event', () => {
    const result = parseSSEEvent(
      'done',
      '{"sessionRid":"ri.test.session","summary":"Analysis complete"}',
    );
    expect(result).toEqual({
      type: 'done',
      data: { sessionRid: 'ri.test.session', summary: 'Analysis complete' },
    });
  });

  it('parses error event', () => {
    const result = parseSSEEvent(
      'error',
      '{"code":"LLM_API_ERROR","message":"Rate limit exceeded"}',
    );
    expect(result).toEqual({
      type: 'error',
      data: { code: 'LLM_API_ERROR', message: 'Rate limit exceeded' },
    });
  });

  it('returns null for unknown event type', () => {
    const result = parseSSEEvent('unknown-type', '{"data":"test"}');
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const result = parseSSEEvent('text-delta', 'not json');
    expect(result).toBeNull();
  });
});

describe('SSEStreamParser', () => {
  it('parses a complete single event', () => {
    const parser = new SSEStreamParser();
    const events = parser.feed(
      'event: text-delta\ndata: {"text":"Hi"}\n\n',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'text-delta',
      data: { text: 'Hi' },
    });
  });

  it('parses multiple events in one chunk', () => {
    const parser = new SSEStreamParser();
    const chunk =
      'event: text-delta\ndata: {"text":"Hello"}\n\nevent: text-delta\ndata: {"text":" world"}\n\n';
    const events = parser.feed(chunk);
    expect(events).toHaveLength(2);
    expect(events[0]?.data).toEqual({ text: 'Hello' });
    expect(events[1]?.data).toEqual({ text: ' world' });
  });

  it('handles events split across chunks', () => {
    const parser = new SSEStreamParser();

    // First chunk: partial event
    const events1 = parser.feed('event: text-del');
    expect(events1).toHaveLength(0);

    // Second chunk: rest of event
    const events2 = parser.feed(
      'ta\ndata: {"text":"partial"}\n\n',
    );
    expect(events2).toHaveLength(1);
    expect(events2[0]).toEqual({
      type: 'text-delta',
      data: { text: 'partial' },
    });
  });

  it('ignores incomplete events without empty line terminator', () => {
    const parser = new SSEStreamParser();
    const events = parser.feed('event: text-delta\ndata: {"text":"no end"}');
    expect(events).toHaveLength(0);
  });

  it('handles plan-step and done events in sequence', () => {
    const parser = new SSEStreamParser();
    const chunk = [
      'event: plan-step',
      'data: {"step":"Step 1","index":0,"total":2}',
      '',
      'event: done',
      'data: {"sessionRid":"sess-1","summary":"Done"}',
      '',
      '',
    ].join('\n');

    const events = parser.feed(chunk);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('plan-step');
    expect(events[1]?.type).toBe('done');
  });

  it('reset clears internal state', () => {
    const parser = new SSEStreamParser();
    parser.feed('event: text-delta\n');
    parser.reset();

    const events = parser.feed(
      'event: done\ndata: {"sessionRid":"s","summary":"x"}\n\n',
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('done');
  });
});
