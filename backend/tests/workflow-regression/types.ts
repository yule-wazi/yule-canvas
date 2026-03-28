import { TraceEvent, Workflow } from '../../src/services/WorkflowInterpreter';

export type BlockTypeUnderTest =
  | 'navigate'
  | 'back'
  | 'forward'
  | 'scroll'
  | 'wait'
  | 'click'
  | 'type'
  | 'select'
  | 'extract'
  | 'extract-links'
  | 'condition'
  | 'loop'
  | 'log';

export interface Scenario {
  multipleRowCount?: number;
  linkCount?: number;
  clickTargets?: Record<string, string>;
  selectorValues?: Record<string, string[]>;
  conditionElementValues?: Record<string, string>;
  waitForSelectorDelayMs?: number;
  evaluateDelayMs?: number;
  extractEvaluateDelayMs?: number;
}

export interface ActionRecord {
  type: string;
  [key: string]: any;
}

export interface TestExecution {
  result: any;
  trace: TraceEvent[];
  saveEvents: any[];
  actions: ActionRecord[];
}

export interface WorkflowTestCase {
  name: string;
  workflow: Workflow;
  scenario?: Scenario;
  cancelAfterMs?: number;
  closePageOnCancel?: boolean;
  coveredTypes: BlockTypeUnderTest[];
  assert: (execution: TestExecution) => void;
}

export const REQUIRED_BLOCK_TYPES: BlockTypeUnderTest[] = [
  'navigate',
  'back',
  'forward',
  'scroll',
  'wait',
  'click',
  'type',
  'select',
  'extract',
  'extract-links',
  'condition',
  'loop',
  'log'
];
