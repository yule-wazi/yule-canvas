import { WorkflowInterpreter, TraceEvent } from '../../src/services/WorkflowInterpreter';
import { WorkflowValidator } from '../../src/services/WorkflowValidator';
import { buildWorkflowRegressionCases } from './cases';
import { assert, normalizeVariables } from './helpers';
import { buildLoopGuardCases } from './loopGuardCases';
import { MockPage } from './mockPage';
import { REQUIRED_BLOCK_TYPES, WorkflowTestCase } from './types';

async function runCase(testCase: WorkflowTestCase): Promise<void> {
  const validation = WorkflowValidator.validate(testCase.workflow);
  assert(validation.valid, `[${testCase.name}] validation failed: ${validation.errors.join('; ')}`);

  const page = new MockPage(testCase.scenario);
  const trace: TraceEvent[] = [];
  const saveEvents: any[] = [];
  let cancelled = false;
  let cancelTimer: NodeJS.Timeout | null = null;
  const interpreter = new WorkflowInterpreter(page as any, {
    onTrace: event => trace.push(event),
    onSaveData: event => saveEvents.push(event),
    isCancelled: () => cancelled,
    silent: true
  });

  const normalizedVariables = normalizeVariables(testCase.workflow.variables);
  Object.entries(normalizedVariables).forEach(([key, value]) => {
    assert(value !== undefined, `[${testCase.name}] variable ${key} should be normalizable`);
  });

  if (typeof testCase.cancelAfterMs === 'number') {
    cancelTimer = setTimeout(async () => {
      cancelled = true;
      if (testCase.closePageOnCancel) {
        await page.close().catch(() => null);
      }
    }, testCase.cancelAfterMs);
  }

  const result = await interpreter.execute(testCase.workflow);
  if (cancelTimer) {
    clearTimeout(cancelTimer);
  }
  const blockStarts = trace.filter(event => event.type === 'block-start').length;
  const blockEnds = trace.filter(event => event.type === 'block-end').length;

  if (typeof testCase.cancelAfterMs !== 'number') {
    assert(blockStarts === blockEnds, `[${testCase.name}] block trace should be balanced`);
  }
  testCase.assert({
    result,
    trace,
    saveEvents,
    actions: page.actions
  });
}

function parseArgs(argv: string[]): { caseFilter?: string; listOnly: boolean } {
  const caseIndex = argv.indexOf('--case');
  const listOnly = argv.includes('--list');

  if (caseIndex === -1) {
    return { listOnly };
  }

  const caseFilter = argv[caseIndex + 1];
  assert(caseFilter, 'Missing value for --case');

  return { caseFilter, listOnly };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const allCases = buildWorkflowRegressionCases();
  const loopGuardCases = buildLoopGuardCases();

  if (args.listOnly) {
    allCases.forEach(testCase => console.log(testCase.name));
    loopGuardCases.forEach(testCase => console.log(testCase.name));
    return;
  }

  const testCases = allCases.filter(testCase => !args.caseFilter || testCase.name === args.caseFilter);
  const selectedLoopGuardCases = loopGuardCases.filter(testCase => !args.caseFilter || testCase.name === args.caseFilter);
  assert(
    testCases.length + selectedLoopGuardCases.length > 0,
    args.caseFilter
      ? `No workflow regression case named "${args.caseFilter}"`
      : 'No workflow regression cases configured'
  );

  if (!args.caseFilter) {
    const coveredTypes = new Set<string>();
    allCases.forEach(testCase => testCase.coveredTypes.forEach(type => coveredTypes.add(type)));
    REQUIRED_BLOCK_TYPES.forEach(type => {
      assert(
        coveredTypes.has(type),
        `Workflow regression suite is missing coverage for block type "${type}"`
      );
    });
  }

  let passed = 0;
  for (const testCase of testCases) {
    await runCase(testCase);
    passed++;
    console.log(`PASS ${testCase.name}`);
  }

  for (const testCase of selectedLoopGuardCases) {
    testCase.run();
    passed++;
    console.log(`PASS ${testCase.name}`);
  }

  console.log(`Workflow regression suite passed: ${passed}/${testCases.length + selectedLoopGuardCases.length}`);
}

main().catch((error: any) => {
  console.error(error.message || error);
  process.exit(1);
});
