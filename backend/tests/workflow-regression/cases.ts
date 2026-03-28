import { Workflow } from '../../src/services/WorkflowInterpreter';
import { assert, blockOrder, countEvents, port } from './helpers';
import { WorkflowTestCase } from './types';

type Block = Workflow['blocks'][number];
type Connection = Workflow['connections'][number];

function makeBlock(
  id: string,
  type: Block['type'],
  data: any,
  category: Block['category'],
  label = id
): Block {
  const isLoop = type === 'loop';
  return {
    id,
    type,
    label,
    category,
    position: { x: 0, y: 0 },
    data,
    inputs: [port(isLoop ? 'loop-end' : 'in', isLoop ? 'Loop End' : 'In')],
    outputs: [port(isLoop ? 'loop-start' : 'out', isLoop ? 'Loop Start' : 'Out')]
  };
}

function makeWorkflow(blocks: Block[], connections: Connection[], variables: Record<string, any> = {}): Workflow {
  return { blocks, connections, variables };
}

function flow(source: string, target: string, id: string): Connection {
  return {
    id,
    source,
    sourceHandle: 'source-right',
    target,
    targetHandle: 'target-left'
  };
}

function loopStart(loopId: string, target: string, id: string): Connection {
  return {
    id,
    source: loopId,
    sourceHandle: 'loop-start',
    target,
    targetHandle: 'target-left'
  };
}

function loopEnd(source: string, loopId: string, id: string): Connection {
  return {
    id,
    source,
    sourceHandle: 'source-right',
    target: loopId,
    targetHandle: 'loop-end'
  };
}

export function buildWorkflowRegressionCases(): WorkflowTestCase[] {
  const cases: WorkflowTestCase[] = [];

  cases.push({
    name: 'linear-browser-flow',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/list', waitUntil: 'domcontentloaded', timeout: 10000 }, 'browser'),
        makeBlock('wait-1', 'wait', { duration: 250 }, 'browser'),
        makeBlock('log-1', 'log', { message: 'done' }, 'browser')
      ],
      [flow('navigate-1', 'wait-1', 'c1'), flow('wait-1', 'log-1', 'c2')]
    ),
    coveredTypes: ['navigate', 'wait', 'log'],
    assert: ({ result, trace, actions, saveEvents }) => {
      assert(result.success, 'linear-browser-flow should succeed');
      assert(blockOrder(trace).join(',') === 'navigate-1,wait-1,log-1', 'linear-browser-flow block order mismatch');
      assert(actions.some(action => action.type === 'goto' && action.url === 'https://example.com/list'), 'linear-browser-flow should navigate');
      assert(actions.some(action => action.type === 'waitForTimeout' && action.duration === 250), 'linear-browser-flow should wait');
      assert(saveEvents.length === 0, 'linear-browser-flow should not emit saveData');
    }
  });

  cases.push({
    name: 'navigate-load-waituntil',
    workflow: makeWorkflow(
      [makeBlock('navigate-1', 'navigate', { url: 'https://example.com/load', waitUntil: 'load', timeout: 3210 }, 'browser')],
      []
    ),
    coveredTypes: ['navigate'],
    assert: ({ result, actions }) => {
      assert(result.success, 'navigate-load-waituntil should succeed');
      const nav = actions.find(action => action.type === 'goto');
      assert(nav?.options?.waitUntil === 'load', 'navigate should preserve waitUntil=load');
      assert(nav?.options?.timeout === 3210, 'navigate should preserve timeout');
    }
  });

  cases.push({
    name: 'navigate-networkidle-with-global-variable',
    workflow: makeWorkflow(
      [makeBlock('navigate-1', 'navigate', { url: 'https://example.com/page/{{page}}', waitUntil: 'networkidle', timeout: 2000 }, 'browser')],
      [],
      { page: { value: '9', description: '' } }
    ),
    coveredTypes: ['navigate'],
    assert: ({ result, actions }) => {
      assert(result.success, 'navigate-networkidle-with-global-variable should succeed');
      const nav = actions.find(action => action.type === 'goto');
      assert(nav?.url === 'https://example.com/page/9', 'navigate should replace global variable in url');
      assert(nav?.options?.waitUntil === 'networkidle', 'navigate should preserve waitUntil=networkidle');
    }
  });

  cases.push({
    name: 'extract-single-text-no-table',
    workflow: makeWorkflow(
      [makeBlock('extract-1', 'extract', { selector: '.title', attribute: 'text', customAttribute: '', saveToColumn: 'title', multiple: false, timeout: 1200 }, 'extraction')],
      []
    ),
    coveredTypes: ['extract'],
    assert: ({ result, actions, saveEvents }) => {
      assert(result.success, 'extract-single-text-no-table should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '.title'), 'extract should wait for selector');
      assert(result.result.results.data.length === 1, 'single extract should produce one row');
      assert(result.result.results.data[0].title === 'title:text:1', 'single extract should map text attribute');
      assert(saveEvents.length === 0, 'single extract without table should not save');
    }
  });

  cases.push({
    name: 'extract-multiple-table-save-without-merge',
    workflow: makeWorkflow(
      [makeBlock('extract-1', 'extract', {
        extractions: [
          { selector: '.page-{{page}} .card img', attribute: 'src', customAttribute: '', saveToColumn: 'cover' },
          { selector: '.page-{{page}} .card .title', attribute: 'text', customAttribute: '', saveToColumn: 'title' }
        ],
        multiple: true,
        timeout: 5000,
        saveToTable: 'table_posts',
        mergeKey: 'page'
      }, 'extraction')],
      [],
      { page: { value: '2', description: '' } }
    ),
    scenario: { multipleRowCount: 4 },
    coveredTypes: ['extract'],
    assert: ({ result, actions, saveEvents }) => {
      assert(result.success, 'extract-multiple-table-save-without-merge should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '.page-2 .card img'), 'extract should replace variable in selector');
      assert(saveEvents.length === 1, 'extract should emit one save event');
      assert(saveEvents[0].rows.length === 4, 'extract should save all extracted rows');
      assert(saveEvents[0].rows.every((row: any) => row._mergeDisplayKey === undefined), 'multiple extract should not emit readable merge key');
      assert(saveEvents[0].rows.every((row: any) => row._mergeKey === undefined), 'multiple extract should not emit merge key');
      assert(result.result.results.data.length === 4, 'extract should persist all rows');
    }
  });

  cases.push({
    name: 'extract-custom-attribute-poster',
    workflow: makeWorkflow(
      [makeBlock('extract-1', 'extract', {
        extractions: [
          { selector: 'video.preview', attribute: 'data-*', customAttribute: 'poster', saveToColumn: 'poster' }
        ],
        multiple: false,
        timeout: 1800
      }, 'extraction')],
      []
    ),
    coveredTypes: ['extract'],
    assert: ({ result }) => {
      assert(result.success, 'extract-custom-attribute-poster should succeed');
      assert(result.result.results.data[0].poster === 'poster:poster:1', 'extract should support custom data-* attribute');
    }
  });

  cases.push({
    name: 'extract-literal-merge-key',
    workflow: makeWorkflow(
      [makeBlock('extract-1', 'extract', {
        extractions: [
          { selector: '.item img', attribute: 'src', customAttribute: '', saveToColumn: 'cover' }
        ],
        multiple: false,
        timeout: 1000,
        saveToTable: 'table_literal',
        mergeKey: 'constant-key'
      }, 'extraction')],
      []
    ),
    coveredTypes: ['extract'],
    assert: ({ result, saveEvents }) => {
      assert(result.success, 'extract-literal-merge-key should succeed');
      assert(saveEvents[0].rows.every((row: any) => row._mergeKey === 'constant-key'), 'extract should preserve literal mergeKey');
      assert(saveEvents[0].rows.every((row: any) => row._mergeDisplayKey === 'constant-key'), 'extract should expose readable merge key display');
      assert(result.result.results.data.length === 1, 'single extract should persist one row');
    }
  });

  cases.push({
    name: 'extract-multiple-ignores-stale-merge-key',
    workflow: makeWorkflow(
      [makeBlock('extract-1', 'extract', {
        extractions: [
          { selector: '.feed .card .title', attribute: 'text', customAttribute: '', saveToColumn: 'title' }
        ],
        multiple: true,
        timeout: 1000,
        saveToTable: 'table_multiple',
        mergeKey: '{{index}}'
      }, 'extraction')],
      [],
      { index: { value: '1', description: '' } }
    ),
    scenario: { multipleRowCount: 4 },
    coveredTypes: ['extract'],
    assert: ({ result, saveEvents }) => {
      assert(result.success, 'extract-multiple-ignores-stale-merge-key should succeed');
      assert(saveEvents.length === 1, 'multiple extract should emit one save event batch');
      assert(saveEvents[0].rows.length === 4, 'multiple extract should keep all rows instead of merging them');
      assert(saveEvents[0].rows.every((row: any) => row._mergeKey === undefined), 'multiple extract should ignore stale mergeKey values');
      assert(result.result.results.data.length === 4, 'multiple extract should retain four result rows');
    }
  });

  cases.push({
    name: 'extract-variable-selector-and-columns',
    workflow: makeWorkflow(
      [makeBlock('extract-1', 'extract', {
        extractions: [
          { selector: '.{{section}} .name', attribute: 'text', customAttribute: '', saveToColumn: 'name' },
          { selector: '.{{section}} .image', attribute: 'src', customAttribute: '', saveToColumn: 'image' }
        ],
        multiple: true,
        timeout: 1500
      }, 'extraction')],
      [],
      { section: { value: 'featured', description: '' } }
    ),
    scenario: { multipleRowCount: 3 },
    coveredTypes: ['extract'],
    assert: ({ result, actions }) => {
      assert(result.success, 'extract-variable-selector-and-columns should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '.featured .name'), 'extract should replace selector variables');
      assert(result.result.results.data[0].name === 'name:text:1', 'extract should fill first custom column');
      assert(result.result.results.data[0].image === 'image:src:1', 'extract should fill second custom column');
    }
  });

  cases.push({
    name: 'extract-links-filtered',
    workflow: makeWorkflow(
      [makeBlock('extract-links-1', 'extract-links', { filterPattern: 'item-' }, 'extraction')],
      []
    ),
    scenario: { linkCount: 3 },
    coveredTypes: ['extract-links'],
    assert: ({ result, actions }) => {
      assert(result.success, 'extract-links-filtered should succeed');
      assert(actions.some(action => action.type === 'extractLinks' && action.pattern === 'item-'), 'extract-links should pass filter pattern');
      assert(result.result.results.data.length === 3, 'extract-links should keep matching links');
    }
  });

  cases.push({
    name: 'extract-links-no-filter',
    workflow: makeWorkflow(
      [makeBlock('extract-links-1', 'extract-links', {}, 'extraction')],
      []
    ),
    scenario: { linkCount: 5 },
    coveredTypes: ['extract-links'],
    assert: ({ result }) => {
      assert(result.success, 'extract-links-no-filter should succeed');
      assert(result.result.results.data.length === 5, 'extract-links without filter should return all mock links');
    }
  });

  cases.push({
    name: 'type-basic',
    workflow: makeWorkflow(
      [makeBlock('type-1', 'type', { selector: '#keyword', text: 'playwright', delay: 10, timeout: 1000 }, 'interaction')],
      []
    ),
    coveredTypes: ['type'],
    assert: ({ result, actions }) => {
      assert(result.success, 'type-basic should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '#keyword'), 'type should wait for selector');
      assert(actions.some(action => action.type === 'type' && action.text === 'playwright' && action.options.delay === 10), 'type should send text with delay');
    }
  });

  cases.push({
    name: 'type-with-global-variable',
    workflow: makeWorkflow(
      [makeBlock('type-1', 'type', { selector: '#keyword', text: '{{term}}', delay: 25, timeout: 1500 }, 'interaction')],
      [],
      { term: { value: 'workflow-json', description: '' } }
    ),
    coveredTypes: ['type'],
    assert: ({ result, actions }) => {
      assert(result.success, 'type-with-global-variable should succeed');
      assert(actions.some(action => action.type === 'type' && action.text === 'workflow-json'), 'type should replace text variable');
    }
  });

  cases.push({
    name: 'select-basic',
    workflow: makeWorkflow(
      [makeBlock('select-1', 'select', { selector: '#sort', value: 'latest', timeout: 1000 }, 'interaction')],
      []
    ),
    coveredTypes: ['select'],
    assert: ({ result, actions }) => {
      assert(result.success, 'select-basic should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '#sort'), 'select should wait for selector');
      assert(actions.some(action => action.type === 'selectOption' && action.value === 'latest'), 'select should choose option');
    }
  });

  cases.push({
    name: 'select-with-global-variable',
    workflow: makeWorkflow(
      [makeBlock('select-1', 'select', { selector: '#sort', value: '{{sort}}', timeout: 1000 }, 'interaction')],
      [],
      { sort: { value: 'popular', description: '' } }
    ),
    coveredTypes: ['select'],
    assert: ({ result, actions }) => {
      assert(result.success, 'select-with-global-variable should succeed');
      assert(actions.some(action => action.type === 'selectOption' && action.value === 'popular'), 'select should replace variable in selected value');
    }
  });

  cases.push({
    name: 'click-with-wait',
    workflow: makeWorkflow(
      [makeBlock('click-1', 'click', { selector: '.detail-link', waitForElement: true, timeout: 1000 }, 'interaction')],
      []
    ),
    coveredTypes: ['click'],
    assert: ({ result, actions }) => {
      assert(result.success, 'click-with-wait should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '.detail-link'), 'click should optionally wait for selector');
      assert(actions.some(action => action.type === 'click' && action.selector === '.detail-link'), 'click should click selector');
    }
  });

  cases.push({
    name: 'click-without-wait',
    workflow: makeWorkflow(
      [makeBlock('click-1', 'click', { selector: '.quick-action', waitForElement: false, timeout: 1000 }, 'interaction')],
      []
    ),
    coveredTypes: ['click'],
    assert: ({ result, actions }) => {
      assert(result.success, 'click-without-wait should succeed');
      assert(!actions.some(action => action.type === 'waitForSelector' && action.selector === '.quick-action'), 'click without wait should skip waitForSelector');
      assert(actions.some(action => action.type === 'click' && action.selector === '.quick-action'), 'click should still click selector');
    }
  });

  cases.push({
    name: 'click-open-in-new-tab-then-back',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/list', waitUntil: 'domcontentloaded', timeout: 1000 }, 'browser'),
        makeBlock('click-1', 'click', { selector: '.detail-link', waitForElement: true, timeout: 1000, openInNewTab: true, waitUntil: 'domcontentloaded' }, 'interaction'),
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.detail video', attribute: 'src', customAttribute: '', saveToColumn: 'video' }],
          multiple: false,
          timeout: 1000
        }, 'extraction'),
        makeBlock('back-1', 'back', {}, 'browser'),
        makeBlock('log-1', 'log', { message: 'returned' }, 'browser')
      ],
      [
        flow('navigate-1', 'click-1', 'c1'),
        flow('click-1', 'extract-1', 'c2'),
        flow('extract-1', 'back-1', 'c3'),
        flow('back-1', 'log-1', 'c4')
      ]
    ),
    coveredTypes: ['navigate', 'click', 'extract', 'back', 'log'],
    scenario: {
      clickTargets: {
        '.detail-link': 'https://example.com/detail/1'
      }
    },
    assert: ({ result, actions, trace }) => {
      assert(result.success, 'click-open-in-new-tab-then-back should succeed');
      assert(blockOrder(trace).join(',') === 'navigate-1,click-1,extract-1,back-1,log-1', 'new tab flow block order mismatch');
      assert(actions.some(action => action.type === 'newPage'), 'click should create a new page');
      assert(actions.some(action => action.type === 'goto' && action.url === 'https://example.com/detail/1'), 'new tab should navigate to extracted link');
      assert(actions.some(action => action.type === 'closePage' && action.url === 'https://example.com/detail/1'), 'back should close popup page');
      assert(actions.some(action => action.type === 'bringToFront' && action.url === 'https://example.com/list'), 'back should restore parent page');
      assert(result.result.url === 'https://example.com/list', 'workflow should end back on the list page');
    }
  });

  cases.push({
    name: 'click-open-in-new-tab-falls-back-to-normal-click-without-href',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/list', waitUntil: 'domcontentloaded', timeout: 1000 }, 'browser'),
        makeBlock('click-1', 'click', { selector: '.js-action', waitForElement: true, timeout: 1000, openInNewTab: true, waitUntil: 'domcontentloaded' }, 'interaction'),
        makeBlock('log-1', 'log', { message: 'after click' }, 'browser')
      ],
      [
        flow('navigate-1', 'click-1', 'c1'),
        flow('click-1', 'log-1', 'c2')
      ],
      {}
    ),
    scenario: {
      clickTargets: {
        '.js-action': ''
      }
    },
    coveredTypes: ['navigate', 'click', 'log'],
    assert: ({ result, actions, trace }) => {
      assert(result.success, 'click-open-in-new-tab-falls-back-to-normal-click-without-href should succeed');
      assert(blockOrder(trace).join(',') === 'navigate-1,click-1,log-1', 'fallback click flow block order mismatch');
      assert(!actions.some(action => action.type === 'newPage'), 'fallback click should not create a new tab');
      assert(actions.some(action => action.type === 'click' && action.selector === '.js-action'), 'fallback click should behave like normal click');
    }
  });

  cases.push({
    name: 'click-open-in-new-tab-background-child-chain',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/list', waitUntil: 'domcontentloaded', timeout: 1000 }, 'browser'),
        makeBlock('click-1', 'click', { selector: '.detail-link', waitForElement: true, timeout: 1000, openInNewTab: true, runInBackground: true, waitUntil: 'domcontentloaded' }, 'interaction'),
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.detail video', attribute: 'src', customAttribute: '', saveToColumn: 'video' }],
          multiple: false,
          timeout: 1000,
          saveToTable: 'table_background',
          mergeKey: '{{index}}'
        }, 'extraction'),
        makeBlock('back-1', 'back', {}, 'browser'),
        makeBlock('log-1', 'log', { message: 'continue list {{index}}' }, 'browser'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 10,
          useVariable: true,
          variableName: 'index',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [
        loopStart('loop-1', 'click-1', 'c1'),
        flow('click-1', 'extract-1', 'c2'),
        flow('extract-1', 'back-1', 'c3'),
        flow('back-1', 'log-1', 'c4'),
        loopEnd('log-1', 'loop-1', 'c5')
      ]
    ),
    coveredTypes: ['navigate', 'click', 'extract', 'back', 'log', 'loop'],
    scenario: {
      clickTargets: {
        '.detail-link': 'https://example.com/detail/1'
      }
    },
    assert: ({ result, trace, actions, saveEvents }) => {
      assert(result.success, 'click-open-in-new-tab-background-child-chain should succeed');
      assert(countEvents(trace, 'loop-iteration', 'loop-1') === 2, 'background click loop should iterate twice');
      assert(actions.filter(action => action.type === 'newPage').length === 2, 'background click should open one popup per loop iteration');
      assert(actions.filter(action => action.type === 'goto' && action.url === 'https://example.com/detail/1').length === 2, 'background click should navigate each popup to detail url');
      assert(actions.filter(action => action.type === 'closePage' && action.url === 'https://example.com/detail/1').length === 2, 'background child chain should close popups via back');
      assert(saveEvents.length === 2, 'background child chain should save one detail row per iteration');
      assert(saveEvents.every((event: any) => event.rows[0].video === 'video:src:1'), 'background child chain should extract detail data');
      assert(result.logs.some((line: string) => line.includes('continue list 1')), 'main chain should continue after first spawned child');
      assert(result.logs.some((line: string) => line.includes('continue list 2')), 'main chain should continue after second spawned child');
    }
  });

  cases.push({
    name: 'stop-cancels-background-child-chain-without-crash',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/list', waitUntil: 'domcontentloaded', timeout: 1000 }, 'browser'),
        makeBlock('click-1', 'click', { selector: '.detail-link', waitForElement: true, timeout: 1000, openInNewTab: true, runInBackground: true, waitUntil: 'domcontentloaded' }, 'interaction'),
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.detail video', attribute: 'src', customAttribute: '', saveToColumn: 'video' }],
          multiple: false,
          timeout: 1000,
          saveToTable: 'table_background',
          mergeKey: '{{index}}'
        }, 'extraction'),
        makeBlock('back-1', 'back', {}, 'browser'),
        makeBlock('wait-1', 'wait', { duration: 50 }, 'browser'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 10,
          useVariable: true,
          variableName: 'index',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [
        loopStart('loop-1', 'click-1', 'c1'),
        flow('click-1', 'extract-1', 'c2'),
        flow('extract-1', 'back-1', 'c3'),
        flow('back-1', 'wait-1', 'c4'),
        loopEnd('wait-1', 'loop-1', 'c5')
      ]
    ),
    scenario: {
      clickTargets: {
        '.detail-link': 'https://example.com/detail/1'
      },
      extractEvaluateDelayMs: 40
    },
    cancelAfterMs: 10,
    closePageOnCancel: true,
    coveredTypes: ['navigate', 'click', 'extract', 'back', 'wait', 'loop'],
    assert: ({ result, actions }) => {
      assert(!result.success, 'stop-cancels-background-child-chain-without-crash should stop execution');
      assert(result.error === 'Execution stopped', 'stop-cancels-background-child-chain-without-crash should surface stop status');
      assert(actions.some(action => action.type === 'newPage'), 'stop case should still open background popup before cancellation');
      assert(actions.some(action => action.type === 'closePage' && action.url === 'https://example.com/list'), 'stop case should close the root page during cancellation');
    }
  });

  cases.push({
    name: 'history-back-forward',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/home', waitUntil: 'domcontentloaded', timeout: 10000 }, 'browser'),
        makeBlock('click-1', 'click', { selector: '.detail-link', waitForElement: true, timeout: 1000 }, 'interaction'),
        makeBlock('back-1', 'back', {}, 'browser'),
        makeBlock('forward-1', 'forward', {}, 'browser')
      ],
      [
        flow('navigate-1', 'click-1', 'c1'),
        flow('click-1', 'back-1', 'c2'),
        flow('back-1', 'forward-1', 'c3')
      ]
    ),
    coveredTypes: ['navigate', 'click', 'back', 'forward'],
    assert: ({ result, actions }) => {
      assert(result.success, 'history-back-forward should succeed');
      const types = actions.map(action => action.type);
      assert(types.includes('goBack'), 'back should execute');
      assert(types.includes('goForward'), 'forward should execute');
      assert(result.result.url === 'mock://clicked/1', 'forward should restore clicked page');
    }
  });

  cases.push({
    name: 'scroll-page-fixed',
    workflow: makeWorkflow(
      [makeBlock('scroll-1', 'scroll', { target: 'page', mode: 'fixed', maxScrolls: 3, scrollDistance: 200, delay: 20 }, 'browser')],
      []
    ),
    coveredTypes: ['scroll'],
    assert: ({ result, actions }) => {
      assert(result.success, 'scroll-page-fixed should succeed');
      assert(actions.filter(action => action.type === 'pageScroll').length === 3, 'fixed page scroll should run exactly maxScrolls times');
    }
  });

  cases.push({
    name: 'scroll-page-smart',
    workflow: makeWorkflow(
      [makeBlock('scroll-1', 'scroll', { target: 'page', mode: 'smart', maxScrolls: 10, scrollDistance: 500, delay: 20 }, 'browser')],
      []
    ),
    coveredTypes: ['scroll'],
    assert: ({ result, actions }) => {
      assert(result.success, 'scroll-page-smart should succeed');
      const pageScrolls = actions.filter(action => action.type === 'pageScroll').length;
      assert(pageScrolls > 0, 'smart page scroll should scroll at least once');
      assert(pageScrolls <= 10, 'smart page scroll should stop within maxScrolls');
    }
  });

  cases.push({
    name: 'scroll-element-fixed',
    workflow: makeWorkflow(
      [makeBlock('scroll-1', 'scroll', { target: 'element', selector: '.list', mode: 'fixed', maxScrolls: 4, scrollDistance: 120, delay: 10, timeout: 800 }, 'browser')],
      []
    ),
    coveredTypes: ['scroll'],
    assert: ({ result, actions }) => {
      assert(result.success, 'scroll-element-fixed should succeed');
      assert(actions.some(action => action.type === 'waitForSelector' && action.selector === '.list'), 'element scroll should wait for element');
      const action = actions.find(item => item.type === 'elementScroll');
      assert(action?.mode === 'fixed' && action?.maxTimes === 4, 'element fixed scroll should pass correct parameters');
    }
  });

  cases.push({
    name: 'scroll-element-smart',
    workflow: makeWorkflow(
      [makeBlock('scroll-1', 'scroll', { target: 'element', selector: '.grid', mode: 'smart', maxScrolls: 6, scrollDistance: 180, delay: 15, timeout: 900 }, 'browser')],
      []
    ),
    coveredTypes: ['scroll'],
    assert: ({ result, actions }) => {
      assert(result.success, 'scroll-element-smart should succeed');
      const action = actions.find(item => item.type === 'elementScroll');
      assert(action?.selector === '.grid' && action?.mode === 'smart', 'element smart scroll should use smart mode and selector');
    }
  });

  cases.push({
    name: 'loop-count-basic',
    workflow: makeWorkflow(
      [
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.row:nth-child({{index}}) .title', attribute: 'text', customAttribute: '', saveToColumn: 'title' }],
          multiple: false,
          timeout: 1000
        }, 'extraction'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 3,
          condition: '',
          maxIterations: 10,
          useVariable: true,
          variableName: 'index',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [loopStart('loop-1', 'extract-1', 'c1'), loopEnd('extract-1', 'loop-1', 'c2')]
    ),
    coveredTypes: ['loop', 'extract'],
    assert: ({ result, trace, actions }) => {
      assert(result.success, 'loop-count-basic should succeed');
      assert(countEvents(trace, 'loop-iteration', 'loop-1') === 3, 'count loop should iterate exact count');
      const selectors = actions.filter(action => action.type === 'waitForSelector').map(action => action.selector);
      assert(selectors.join(',') === '.row:nth-child(1) .title,.row:nth-child(2) .title,.row:nth-child(3) .title', 'count loop should advance loop variable');
      assert(result.result.results.data.length === 3, 'count loop should collect three rows');
    }
  });

  cases.push({
    name: 'loop-count-start-from-variable',
    workflow: makeWorkflow(
      [
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.card:nth-child({{index}}) img', attribute: 'src', customAttribute: '', saveToColumn: 'cover' }],
          multiple: false,
          timeout: 1000
        }, 'extraction'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 10,
          useVariable: true,
          variableName: 'index',
          startValueType: 'variable',
          startValue: '{{seed}}'
        }, 'logic')
      ],
      [loopStart('loop-1', 'extract-1', 'c1'), loopEnd('extract-1', 'loop-1', 'c2')],
      { seed: { value: '4', description: '' } }
    ),
    coveredTypes: ['loop', 'extract'],
    assert: ({ result, trace, actions }) => {
      assert(result.success, 'loop-count-start-from-variable should succeed');
      assert(countEvents(trace, 'loop-iteration', 'loop-1') === 2, 'variable start loop should iterate exact count');
      const selectors = actions.filter(action => action.type === 'waitForSelector').map(action => action.selector);
      assert(selectors.join(',') === '.card:nth-child(4) img,.card:nth-child(5) img', 'loop should honor startValueType=variable');
      assert(result.result.results.data.length === 2, 'loop should collect two rows');
    }
  });

  cases.push({
    name: 'loop-condition-mode',
    workflow: makeWorkflow(
      [
        makeBlock('log-1', 'log', { message: 'page={{page}}' }, 'browser'),
        makeBlock('loop-1', 'loop', {
          mode: 'condition',
          count: 0,
          condition: 'Number(page) < 4',
          maxIterations: 10,
          useVariable: true,
          variableName: 'page',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [loopStart('loop-1', 'log-1', 'c1'), loopEnd('log-1', 'loop-1', 'c2')],
      { page: { value: '1', description: '' } }
    ),
    coveredTypes: ['loop', 'log'],
    assert: ({ result, trace }) => {
      assert(result.success, 'loop-condition-mode should succeed');
      assert(countEvents(trace, 'loop-iteration', 'loop-1') === 4, 'condition loop should reflect current condition-loop semantics');
      assert(result.logs.some((line: string) => line.includes('page=1')), 'condition loop should execute first iteration');
      assert(result.logs.some((line: string) => line.includes('page=4')), 'condition loop should execute final iteration before next condition check stops');
    }
  });

  cases.push({
    name: 'loop-restores-global-variable-after-end',
    workflow: makeWorkflow(
      [
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.page-{{page}} .title', attribute: 'text', customAttribute: '', saveToColumn: 'title' }],
          multiple: false,
          timeout: 1000
        }, 'extraction'),
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/final/{{page}}', waitUntil: 'domcontentloaded', timeout: 1000 }, 'browser'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 10,
          useVariable: true,
          variableName: 'page',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [loopStart('loop-1', 'extract-1', 'c1'), loopEnd('extract-1', 'loop-1', 'c2'), flow('extract-1', 'navigate-1', 'c3')],
      { page: { value: '9', description: '' } }
    ),
    coveredTypes: ['loop', 'extract', 'navigate'],
    assert: ({ result, actions }) => {
      assert(result.success, 'loop-restores-global-variable-after-end should succeed');
      const nav = actions.find(action => action.type === 'goto');
      assert(nav?.url === 'https://example.com/final/9', 'loop should restore original global variable after completion');
    }
  });

  cases.push({
    name: 'merge-key-is-scoped-by-loop-context',
    workflow: makeWorkflow(
      [
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.page .card:nth-child({{index}}) img', attribute: 'src', customAttribute: '', saveToColumn: 'cover' }],
          multiple: false,
          timeout: 1000,
          saveToTable: 'table_loop_merge',
          mergeKey: 'index'
        }, 'extraction'),
        makeBlock('extract-2', 'extract', {
          extractions: [{ selector: '.detail video', attribute: 'src', customAttribute: '', saveToColumn: 'video' }],
          multiple: false,
          timeout: 1000,
          saveToTable: 'table_loop_merge',
          mergeKey: 'index'
        }, 'extraction'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 10,
          useVariable: false
        }, 'logic')
      ],
      [
        loopStart('loop-1', 'extract-1', 'c1'),
        flow('extract-1', 'extract-2', 'c2'),
        loopEnd('extract-2', 'loop-1', 'c3')
      ],
      { index: { value: '1', description: '' } }
    ),
    coveredTypes: ['loop', 'extract'],
    assert: ({ result, saveEvents }) => {
      assert(result.success, 'merge-key-is-scoped-by-loop-context should succeed');
      assert(saveEvents.length === 4, 'two extracts across two outer iterations should emit four save events');
      const firstThumbKey = saveEvents[0].rows[0]._mergeKey;
      const firstVideoKey = saveEvents[1].rows[0]._mergeKey;
      const secondThumbKey = saveEvents[2].rows[0]._mergeKey;
      const secondVideoKey = saveEvents[3].rows[0]._mergeKey;
      assert(firstThumbKey === firstVideoKey, 'same inner iteration should merge across extract blocks');
      assert(secondThumbKey === secondVideoKey, 'same later iteration should merge across extract blocks');
      assert(firstThumbKey !== secondThumbKey, 'different loop iterations should not collide on merge key');
      assert(saveEvents.every((event: any) => String(event.rows[0]._mergeDisplayKey) === '1'), 'display merge key should stay readable');
      assert(result.result.results.data.length === 4, 'execution result should retain all saved row payloads');
    }
  });

  cases.push({
    name: 'nested-loop-order-and-scope',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/list', waitUntil: 'domcontentloaded', timeout: 10000 }, 'browser'),
        makeBlock('extract-1', 'extract', {
          extractions: [{ selector: '.page-{{page}} .card:nth-child({{index}}) img', attribute: 'src', customAttribute: '', saveToColumn: 'cover' }],
          multiple: false,
          timeout: 3000,
          saveToTable: 'table_nested',
          mergeKey: 'page'
        }, 'extraction'),
        makeBlock('click-1', 'click', { selector: '.page-{{page}} .card:nth-child({{index}}) a', waitForElement: true, timeout: 3000 }, 'interaction'),
        makeBlock('back-1', 'back', {}, 'browser'),
        makeBlock('wait-1', 'wait', { duration: 150 }, 'browser'),
        makeBlock('log-1', 'log', { message: 'next page' }, 'browser'),
        makeBlock('inner-loop', 'loop', {
          mode: 'count',
          count: 1,
          condition: '',
          maxIterations: 100,
          useVariable: true,
          variableName: 'index',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic'),
        makeBlock('outer-loop', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 100,
          useVariable: true,
          variableName: 'page',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [
        flow('navigate-1', 'extract-1', 'c0'),
        loopStart('inner-loop', 'extract-1', 'c1'),
        flow('extract-1', 'click-1', 'c2'),
        flow('click-1', 'back-1', 'c3'),
        loopEnd('back-1', 'inner-loop', 'c4'),
        flow('back-1', 'wait-1', 'c5'),
        flow('wait-1', 'log-1', 'c6'),
        loopEnd('log-1', 'outer-loop', 'c7'),
        loopStart('outer-loop', 'extract-1', 'c8')
      ],
      {
        page: { value: '1', description: '' },
        index: { value: '1', description: '' }
      }
    ),
    coveredTypes: ['navigate', 'loop', 'extract', 'click', 'back', 'wait', 'log'],
    assert: ({ result, trace, saveEvents }) => {
      assert(result.success, 'nested-loop-order-and-scope should succeed');
      assert(blockOrder(trace).join(',') === 'navigate-1,extract-1,click-1,back-1,wait-1,log-1,extract-1,click-1,back-1,wait-1,log-1', 'nested loop block order mismatch');
      assert(countEvents(trace, 'loop-iteration', 'outer-loop') === 2, 'outer loop should iterate twice');
      assert(countEvents(trace, 'loop-iteration', 'inner-loop') === 2, 'inner loop should iterate once per outer loop');
      assert(saveEvents.length === 2, 'nested loop should save once per outer iteration');
      assert(String(saveEvents[0].rows[0]._mergeDisplayKey) === '1', 'first nested save should display page=1');
      assert(String(saveEvents[1].rows[0]._mergeDisplayKey) === '2', 'second nested save should display page=2');
      assert(String(saveEvents[0].rows[0]._mergeKey).includes('outer-loop:1'), 'first nested save should scope merge key to outer iteration');
      assert(String(saveEvents[1].rows[0]._mergeKey).includes('outer-loop:2'), 'second nested save should scope merge key to outer iteration');
    }
  });

  cases.push({
    name: 'loop-followed-by-tail-chain',
    workflow: makeWorkflow(
      [
        makeBlock('log-body', 'log', { message: 'body={{index}}' }, 'browser'),
        makeBlock('log-tail', 'log', { message: 'tail' }, 'browser'),
        makeBlock('loop-1', 'loop', {
          mode: 'count',
          count: 2,
          condition: '',
          maxIterations: 10,
          useVariable: true,
          variableName: 'index',
          startValueType: 'custom',
          startValue: '1'
        }, 'logic')
      ],
      [loopStart('loop-1', 'log-body', 'c1'), loopEnd('log-body', 'loop-1', 'c2'), flow('log-body', 'log-tail', 'c3')]
    ),
    coveredTypes: ['loop', 'log'],
    assert: ({ result, trace }) => {
      assert(result.success, 'loop-followed-by-tail-chain should succeed');
      assert(countEvents(trace, 'loop-iteration', 'loop-1') === 2, 'loop-followed-by-tail-chain should iterate twice');
      assert(blockOrder(trace).join(',') === 'log-body,log-body,log-tail', 'tail chain should execute after loop body completes');
    }
  });

  cases.push({
    name: 'wait-different-duration',
    workflow: makeWorkflow(
      [makeBlock('wait-1', 'wait', { duration: 3333 }, 'browser')],
      []
    ),
    coveredTypes: ['wait'],
    assert: ({ result, actions }) => {
      assert(result.success, 'wait-different-duration should succeed');
      assert(actions.some(action => action.type === 'waitForTimeout' && action.duration === 3333), 'wait should preserve configured duration');
    }
  });

  cases.push({
    name: 'log-with-global-variable',
    workflow: makeWorkflow(
      [makeBlock('log-1', 'log', { message: 'page={{page}} user={{user}}' }, 'browser')],
      [],
      {
        page: { value: '6', description: '' },
        user: { value: 'alice', description: '' }
      }
    ),
    coveredTypes: ['log'],
    assert: ({ result }) => {
      assert(result.success, 'log-with-global-variable should succeed');
      assert(result.logs.some((line: string) => line.includes('page=6 user=alice')), 'log should replace variables in message');
    }
  });

  cases.push({
    name: 'search-form-chain',
    workflow: makeWorkflow(
      [
        makeBlock('navigate-1', 'navigate', { url: 'https://example.com/search', waitUntil: 'domcontentloaded', timeout: 10000 }, 'browser'),
        makeBlock('type-1', 'type', { selector: '#q', text: '{{query}}', delay: 5, timeout: 1000 }, 'interaction'),
        makeBlock('select-1', 'select', { selector: '#sort', value: '{{sort}}', timeout: 1000 }, 'interaction'),
        makeBlock('click-1', 'click', { selector: '#submit', waitForElement: false, timeout: 1000 }, 'interaction'),
        makeBlock('extract-links-1', 'extract-links', { filterPattern: 'item-' }, 'extraction')
      ],
      [
        flow('navigate-1', 'type-1', 'c1'),
        flow('type-1', 'select-1', 'c2'),
        flow('select-1', 'click-1', 'c3'),
        flow('click-1', 'extract-links-1', 'c4')
      ],
      {
        query: { value: 'automation', description: '' },
        sort: { value: 'recent', description: '' }
      }
    ),
    scenario: { linkCount: 2 },
    coveredTypes: ['navigate', 'type', 'select', 'click', 'extract-links'],
    assert: ({ result, actions, trace }) => {
      assert(result.success, 'search-form-chain should succeed');
      assert(blockOrder(trace).join(',') === 'navigate-1,type-1,select-1,click-1,extract-links-1', 'search-form-chain block order mismatch');
      assert(actions.some(action => action.type === 'type' && action.text === 'automation'), 'search-form-chain should type query variable');
      assert(actions.some(action => action.type === 'selectOption' && action.value === 'recent'), 'search-form-chain should select variable value');
      assert(result.result.results.data.length === 2, 'search-form-chain should extract filtered links');
    }
  });

  return cases;
}
