import { assert } from './helpers';
import { findLoopBody, hasLoopIntersection } from '../../../shared/workflowLoopGuards';

interface LoopGuardCase {
  name: string;
  run: () => void;
}

function flow(source: string, target: string) {
  return {
    source,
    sourceHandle: 'source-right',
    target,
    targetHandle: 'target-left'
  };
}

function conditionFlow(source: string, sourceHandle: string, target: string) {
  return {
    source,
    sourceHandle,
    target,
    targetHandle: 'target-left'
  };
}

function loopStart(loopId: string, target: string) {
  return {
    source: loopId,
    sourceHandle: 'loop-start',
    target,
    targetHandle: 'target-left'
  };
}

function loopEnd(source: string, loopId: string) {
  return {
    source,
    sourceHandle: 'source-right',
    target: loopId,
    targetHandle: 'loop-end'
  };
}

export function buildLoopGuardCases(): LoopGuardCase[] {
  return [
    {
      name: 'loop-guard-allows-nested-condition-page-loop',
      run: () => {
        const blocks = [
          { id: 'navigate', type: 'navigate' },
          { id: 'condition', type: 'condition' },
          { id: 'extract-list', type: 'extract' },
          { id: 'click-detail', type: 'click' },
          { id: 'extract-detail', type: 'extract' },
          { id: 'back', type: 'back' },
          { id: 'next-page', type: 'click' },
          { id: 'item-loop', type: 'loop' },
          { id: 'page-loop', type: 'loop' }
        ];

        const connections = [
          flow('navigate', 'condition'),
          conditionFlow('condition', 'condition-path-1-right', 'extract-list'),
          flow('extract-list', 'click-detail'),
          flow('click-detail', 'extract-detail'),
          flow('extract-detail', 'back'),
          loopStart('item-loop', 'condition'),
          loopEnd('back', 'item-loop'),
          flow('back', 'next-page'),
          loopStart('page-loop', 'condition'),
          loopEnd('next-page', 'page-loop')
        ];

        const itemLoopBody = findLoopBody(connections, 'condition', 'back');
        assert(
          hasLoopIntersection(blocks, connections, itemLoopBody, 'item-loop') === false,
          'nested page loop case should not be treated as loop intersection'
        );
      }
    },
    {
      name: 'loop-guard-rejects-real-partial-intersection',
      run: () => {
        const blocks = [
          { id: 'a', type: 'click' },
          { id: 'b', type: 'click' },
          { id: 'c', type: 'click' },
          { id: 'd', type: 'click' },
          { id: 'loop-1', type: 'loop' },
          { id: 'loop-2', type: 'loop' }
        ];

        const connections = [
          loopStart('loop-1', 'a'),
          flow('a', 'b'),
          flow('b', 'c'),
          loopEnd('c', 'loop-1'),
          loopStart('loop-2', 'b'),
          flow('b', 'c'),
          flow('c', 'd'),
          loopEnd('d', 'loop-2')
        ];

        const loop1Body = findLoopBody(connections, 'a', 'c');
        assert(
          hasLoopIntersection(blocks, connections, loop1Body, 'loop-1') === true,
          'partially overlapping loops should be rejected as intersection'
        );
      }
    }
  ];
}
