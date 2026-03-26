import { TraceEvent } from '../../src/services/WorkflowInterpreter';

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function blockOrder(trace: TraceEvent[]): string[] {
  return trace
    .filter(event => event.type === 'block-start')
    .map(event => event.blockId || '');
}

export function countEvents(
  trace: TraceEvent[],
  type: TraceEvent['type'],
  loopId?: string
): number {
  return trace.filter(event => event.type === type && (!loopId || event.loopId === loopId)).length;
}

export function normalizeVariables(variables: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      key,
      value && typeof value === 'object' && 'value' in value ? value.value : value
    ])
  );
}

export function port(id: string, name: string): { id: string; name: string; type: string } {
  return { id, name, type: 'flow' };
}
