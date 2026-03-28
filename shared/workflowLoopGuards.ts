export interface LoopGuardBlock {
  id: string;
  type: string;
}

export interface LoopGuardConnection {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

function isNormalSourceHandle(handle?: string) {
  return handle === 'source-right' || handle === 'out' || Boolean(handle?.startsWith('condition-'));
}

function isNormalTargetHandle(handle?: string) {
  return handle === 'target-left' || handle === 'in';
}

function isNormalConnection(connection: LoopGuardConnection) {
  return isNormalSourceHandle(connection.sourceHandle) && isNormalTargetHandle(connection.targetHandle);
}

export function findLoopBody(
  connections: LoopGuardConnection[],
  startBlockId: string,
  endBlockId: string
): Set<string> {
  const bodyBlockIds = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [startBlockId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    bodyBlockIds.add(currentId);

    if (currentId === endBlockId) {
      continue;
    }

    connections
      .filter(c => c.source === currentId && isNormalConnection(c))
      .forEach(c => {
        if (!visited.has(c.target)) {
          queue.push(c.target);
        }
      });
  }

  return bodyBlockIds;
}

export function hasLoopIntersection(
  blocks: LoopGuardBlock[],
  connections: LoopGuardConnection[],
  currentLoopBody: Set<string>,
  currentLoopId: string
): boolean {
  const otherLoops = blocks.filter(b => b.type === 'loop' && b.id !== currentLoopId);

  for (const otherLoop of otherLoops) {
    const loopStartConn = connections.find(c => c.source === otherLoop.id && c.sourceHandle === 'loop-start');
    const loopEndConn = connections.find(c => c.target === otherLoop.id && c.targetHandle === 'loop-end');

    if (!loopStartConn || !loopEndConn) {
      continue;
    }

    const otherLoopBody = findLoopBody(connections, loopStartConn.target, loopEndConn.source);

    let currentContainsOther = 0;
    let otherContainsCurrent = 0;

    for (const blockId of otherLoopBody) {
      if (currentLoopBody.has(blockId)) {
        currentContainsOther++;
      }
    }

    for (const blockId of currentLoopBody) {
      if (otherLoopBody.has(blockId)) {
        otherContainsCurrent++;
      }
    }

    if (currentContainsOther === 0 && otherContainsCurrent === 0) {
      continue;
    }

    if (currentContainsOther === otherLoopBody.size) {
      if (currentLoopBody.has(loopStartConn.target) && currentLoopBody.has(loopEndConn.source)) {
        continue;
      }
    }

    if (otherContainsCurrent === currentLoopBody.size) {
      const currentLoopStartConn = connections.find(c => c.source === currentLoopId && c.sourceHandle === 'loop-start');
      const currentLoopEndConn = connections.find(c => c.target === currentLoopId && c.targetHandle === 'loop-end');

      if (currentLoopStartConn && currentLoopEndConn) {
        if (otherLoopBody.has(currentLoopStartConn.target) && otherLoopBody.has(currentLoopEndConn.source)) {
          continue;
        }
      }
    }

    return true;
  }

  return false;
}
