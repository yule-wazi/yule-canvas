import { ValidationResult } from './WorkflowValidator';
import { WORKFLOW_CAPABILITY_SPEC } from './WorkflowCapabilitySpec';
import { WorkflowGenerationHarness } from './WorkflowGenerationHarness';

export class WorkflowSemanticValidator {
  static validate(workflow: any, harness?: WorkflowGenerationHarness): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workflow || !Array.isArray(workflow.blocks) || !Array.isArray(workflow.connections)) {
      return {
        valid: false,
        errors: ['工作流缺少 blocks 或 connections'],
        warnings
      };
    }

    const variables = workflow.variables && typeof workflow.variables === 'object' ? workflow.variables : {};
    const variableNames = new Set<string>(Object.keys(variables));
    const blocksById = new Map<string, any>(workflow.blocks.map((block: any) => [block.id, block]));

    workflow.blocks.forEach((block: any, index: number) => {
      const capability = WORKFLOW_CAPABILITY_SPEC.supportedBlockTypes[block.type];
      const blockLabel = block.label || block.id || `Block[${index}]`;
      const data = block.data && typeof block.data === 'object' ? block.data : {};

      if (!capability) {
        errors.push(`E100 不支持的 block.type: ${block.type}（${blockLabel}）`);
        return;
      }

      const blockVariableName =
        block.type === 'loop' && data.useVariable
          ? String(data.variableName || 'index').trim()
          : '';
      if (blockVariableName) {
        variableNames.add(blockVariableName);
      }

      capability.requiredData.forEach((field) => {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          errors.push(`E110 ${blockLabel} 缺少必填 data.${field}`);
        }
      });

      Object.keys(data).forEach((field) => {
        const isAllowed = capability.requiredData.includes(field) || capability.optionalData.includes(field);
        if (!isAllowed) {
          errors.push(`E111 ${blockLabel} 包含未支持的 data.${field}`);
        }
      });

      capability.forbiddenData?.forEach((field) => {
        if (data[field] !== undefined) {
          errors.push(`E112 ${blockLabel} 禁止使用 data.${field}`);
        }
      });

      this.validateBlockData(block, data, errors, warnings, harness);
    });

    workflow.connections.forEach((connection: any, index: number) => {
      const source = blocksById.get(connection.source);
      const target = blocksById.get(connection.target);

      if (!source || !target) {
        return;
      }

      if (source.type === 'loop' && connection.sourceHandle === 'loop-start') {
        return;
      }

      if (target.type === 'loop' && connection.targetHandle === 'loop-end') {
        return;
      }

      const normalSource = WORKFLOW_CAPABILITY_SPEC.outputRules.normalSourceHandles.includes(connection.sourceHandle)
        || String(connection.sourceHandle || '').startsWith('condition-');
      const normalTarget = WORKFLOW_CAPABILITY_SPEC.outputRules.normalTargetHandles.includes(connection.targetHandle);

      if (!normalSource || !normalTarget) {
        errors.push(`E120 Connection[${index}] 使用了不受支持的连接句柄 ${connection.sourceHandle} -> ${connection.targetHandle}`);
      }
    });

    this.validateVariableReferences(workflow, variableNames, errors);
    this.validateEntrypoints(workflow, errors, warnings);
    this.validateHarnessBoundaries(workflow, harness, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateBlockData(
    block: any,
    data: Record<string, any>,
    errors: string[],
    warnings: string[],
    harness?: WorkflowGenerationHarness
  ) {
    const label = block.label || block.id || block.type;

    switch (block.type) {
      case 'navigate': {
        if (typeof data.url !== 'string' || !data.url.trim()) {
          errors.push(`E201 ${label} 的 data.url 必须是非空字符串`);
        }
        if (
          harness &&
          typeof data.url === 'string' &&
          data.url.trim() &&
          !data.url.includes('{{') &&
          !harness.observedUrls.includes(data.url.trim()) &&
          !harness.clickedHrefTargets.includes(data.url.trim())
        ) {
          errors.push(`E203 ${label} 的 data.url 必须来自录制证据中的 URL`);
        }
        if (data.waitUntil && !['load', 'domcontentloaded', 'networkidle'].includes(data.waitUntil)) {
          errors.push(`E202 ${label} 的 data.waitUntil 不合法`);
        }
        break;
      }
      case 'click': {
        if (typeof data.selector !== 'string' || !data.selector.trim()) {
          errors.push(`E210 ${label} 的 data.selector 必须是非空字符串`);
        }
        if (harness && String(data.selector || '').trim() && !harness.clickedSelectors.includes(String(data.selector).trim())) {
          errors.push(`E211 ${label} 的 data.selector 必须来自录制中的点击 selector`);
        }
        break;
      }
      case 'type': {
        if (!String(data.selector || '').trim()) {
          errors.push(`E220 ${label} 的 data.selector 必须是非空字符串`);
        }
        if (data.text === undefined) {
          errors.push(`E221 ${label} 的 data.text 不能为空`);
        }
        break;
      }
      case 'select': {
        if (!String(data.selector || '').trim()) {
          errors.push(`E230 ${label} 的 data.selector 必须是非空字符串`);
        }
        if (!String(data.value || '').trim()) {
          errors.push(`E231 ${label} 的 data.value 必须是非空字符串`);
        }
        break;
      }
      case 'scroll': {
        const target = data.target || 'page';
        if (!['page', 'element'].includes(target)) {
          errors.push(`E240 ${label} 的 data.target 仅允许 page 或 element`);
        }
        if (target === 'element' && !String(data.selector || '').trim()) {
          errors.push(`E241 ${label} 在 target=element 时必须提供 data.selector`);
        }
        if (data.mode && !['smart', 'fixed'].includes(data.mode)) {
          errors.push(`E242 ${label} 的 data.mode 仅允许 smart 或 fixed`);
        }
        break;
      }
      case 'wait': {
        const duration = Number(data.duration);
        if (!Number.isFinite(duration) || duration < 0) {
          errors.push(`E250 ${label} 的 data.duration 必须是大于等于 0 的数字`);
        }
        break;
      }
      case 'extract': {
        const hasExtractions = Array.isArray(data.extractions) && data.extractions.length > 0;
        const hasLegacySelector = String(data.selector || '').trim();
        if (!hasExtractions && !hasLegacySelector) {
          errors.push(`E260 ${label} 至少需要 data.extractions 或 data.selector`);
        }
        if (hasExtractions) {
          data.extractions.forEach((item: any, index: number) => {
            if (!String(item?.selector || '').trim()) {
              errors.push(`E261 ${label} 的 data.extractions[${index}].selector 不能为空`);
            }
            if (
              harness &&
              String(item?.selector || '').trim() &&
              !harness.markedFields.some(field => field.selector === String(item.selector).trim())
            ) {
              errors.push(`E263 ${label} 的 data.extractions[${index}].selector 必须来自字段标注`);
            }
            if (
              harness &&
              String(item?.saveToColumn || '').trim() &&
              !harness.markedFields.some(field => field.name === String(item.saveToColumn).trim())
            ) {
              errors.push(`E264 ${label} 的 data.extractions[${index}].saveToColumn 必须来自字段标注名称`);
            }
            if (item?.saveToColumn !== undefined && !String(item.saveToColumn).trim()) {
              errors.push(`E262 ${label} 的 data.extractions[${index}].saveToColumn 不能为空字符串`);
            }
          });
        }
        break;
      }
      case 'extract-links': {
        if (data.selector !== undefined || data.attribute !== undefined) {
          errors.push(`E270 ${label} 当前不支持 selector/attribute 方式的 extract-links`);
        }
        break;
      }
      case 'loop': {
        const mode = data.mode || 'count';
        if (!['count', 'condition'].includes(mode)) {
          errors.push(`E280 ${label} 的 data.mode 仅允许 count 或 condition`);
        }
        if (mode === 'count') {
          const count = Number.parseInt(String(data.count), 10);
          if (!Number.isFinite(count) || count <= 0) {
            errors.push(`E281 ${label} 在 count 模式下必须提供大于 0 的 data.count`);
          }
        }
        if (mode === 'condition' && !String(data.condition || '').trim()) {
          errors.push(`E282 ${label} 在 condition 模式下必须提供 data.condition`);
        }
        if (data.source !== undefined || data.variable !== undefined || data.arraySource !== undefined) {
          errors.push(`E283 ${label} 当前不支持数组遍历式循环字段（source/variable/arraySource）`);
        }
        break;
      }
      case 'condition': {
        if (!Array.isArray(data.branches) || data.branches.length === 0) {
          errors.push(`E290 ${label} 至少需要一个条件分支`);
          break;
        }
        data.branches.forEach((branch: any, branchIndex: number) => {
          if (!Array.isArray(branch?.rules) || branch.rules.length === 0) {
            errors.push(`E291 ${label} 的 branches[${branchIndex}] 至少需要一条 rule`);
          }
        });
        break;
      }
      case 'log': {
        if (typeof data.message !== 'string') {
          warnings.push(`W300 ${label} 的 data.message 建议为字符串`);
        }
        break;
      }
      default:
        break;
    }
  }

  private static validateVariableReferences(workflow: any, variableNames: Set<string>, errors: string[]) {
    const references = new Set<string>();

    const collect = (value: any) => {
      if (typeof value === 'string') {
        const matches = value.match(/\{\{(\w+)\}\}/g) || [];
        matches.forEach((match) => {
          const variableName = match.slice(2, -2);
          references.add(variableName);
        });
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }

      if (value && typeof value === 'object') {
        Object.values(value).forEach(collect);
      }
    };

    collect(workflow.blocks);

    references.forEach((variableName) => {
      if (!variableNames.has(variableName)) {
        errors.push(`E310 引用了未定义变量 {{${variableName}}}`);
      }
    });
  }

  private static validateEntrypoints(workflow: any, errors: string[], warnings: string[]) {
    const incomingNormal = new Map<string, number>();

    workflow.blocks.forEach((block: any) => incomingNormal.set(block.id, 0));
    workflow.connections.forEach((connection: any) => {
      if (WORKFLOW_CAPABILITY_SPEC.outputRules.normalTargetHandles.includes(connection.targetHandle)) {
        incomingNormal.set(connection.target, (incomingNormal.get(connection.target) || 0) + 1);
      }
    });

    const rootBlocks = workflow.blocks.filter((block: any) => block.type !== 'loop' && (incomingNormal.get(block.id) || 0) === 0);
    if (rootBlocks.length === 0) {
      errors.push('E320 工作流缺少入口块');
      return;
    }

    const rootNavigateBlocks = rootBlocks.filter((block: any) => block.type === 'navigate');
    if (rootNavigateBlocks.length === 0) {
      warnings.push('W321 当前入口块不是 navigate，生成结果可能不是最稳定的抓取流程');
    }
  }

  private static validateHarnessBoundaries(workflow: any, harness: WorkflowGenerationHarness | undefined, errors: string[]) {
    if (!harness) {
      return;
    }

    workflow.blocks.forEach((block: any) => {
      if (harness.forbiddenBlockTypes.includes(block.type)) {
        errors.push(`E330 当前录制证据不允许生成 ${block.type} block`);
      }
      if (harness.allowedBlockTypes.length > 0 && !harness.allowedBlockTypes.includes(block.type)) {
        errors.push(`E331 当前录制证据未授权生成 ${block.type} block`);
      }
    });
  }
}
