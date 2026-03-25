import type { SSEEvent } from '../types';

/**
 * Parse a complete SSE event block (event + data lines) into a typed SSEEvent.
 */
export function parseSSEEvent(
  eventType: string,
  dataStr: string,
): SSEEvent | null {
  try {
    const data = JSON.parse(dataStr);
    switch (eventType) {
      case 'text-delta':
        return { type: 'text-delta', data };
      case 'plan-step':
        return { type: 'plan-step', data };
      case 'blueprint-item':
        return { type: 'blueprint-item', data };
      case 'blueprint-complete':
        return { type: 'blueprint-complete', data };
      case 'material-uploaded':
        return { type: 'material-uploaded', data };
      case 'done':
        return { type: 'done', data };
      case 'error':
        return { type: 'error', data };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Incrementally parse SSE text stream into events.
 * Handles partial lines across chunks.
 */
export class SSEStreamParser {
  private buffer = '';
  private currentEventType = '';
  private currentData = '';

  /**
   * Feed a chunk of text and return any complete events.
   */
  feed(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    const events: SSEEvent[] = [];

    const lines = this.buffer.split('\n');
    // Keep the last (possibly incomplete) line in the buffer
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        this.currentEventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        this.currentData += line.slice(6);
      } else if (line === '') {
        // Empty line = end of event
        if (this.currentEventType && this.currentData) {
          const event = parseSSEEvent(this.currentEventType, this.currentData);
          if (event) events.push(event);
        }
        this.currentEventType = '';
        this.currentData = '';
      }
    }

    return events;
  }

  reset() {
    this.buffer = '';
    this.currentEventType = '';
    this.currentData = '';
  }
}
