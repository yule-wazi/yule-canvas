import { WORKFLOW_CAPABILITY_SPEC } from './WorkflowCapabilitySpec';

function getDefaultPorts(type: string) {
  switch (type) {
    case 'extract':
      return {
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [
          { id: 'out', name: '输出', type: 'flow' },
          { id: 'data', name: '数据', type: 'data' }
        ]
      };
    case 'extract-links':
      return {
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [
          { id: 'out', name: '输出', type: 'flow' },
          { id: 'data', name: '链接列表', type: 'data' }
        ]
      };
    case 'loop':
      return {
        inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
        outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
      };
    case 'condition':
      return {
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [{ id: 'condition-fallback-bottom', name: '兜底', type: 'flow' }]
      };
    default:
      return {
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [{ id: 'out', name: '输出', type: 'flow' }]
      };
  }
}

export class WorkflowNormalizer {
  static normalize(workflow: any): any {
    if (!workflow || !Array.isArray(workflow.blocks)) {
      return workflow;
    }

    const normalizedBlocks = workflow.blocks.map((block: any, index: number) => {
      const capability = WORKFLOW_CAPABILITY_SPEC.supportedBlockTypes[block.type];
      const category = capability?.category || block.category || 'browser';
      const ports = getDefaultPorts(block.type);

      return {
        id: block.id || `block-${index + 1}`,
        type: block.type,
        label: block.label || block.type,
        category,
        position: {
          x: Number(block?.position?.x ?? 100 + index * 220),
          y: Number(block?.position?.y ?? 200)
        },
        data: block.data && typeof block.data === 'object' ? block.data : {},
        inputs: ports.inputs,
        outputs: ports.outputs
      };
    });

    return {
      blocks: normalizedBlocks,
      connections: Array.isArray(workflow.connections) ? workflow.connections : [],
      variables: workflow.variables && typeof workflow.variables === 'object' ? workflow.variables : {}
    };
  }
}
