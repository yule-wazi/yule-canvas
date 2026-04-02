import { WORKFLOW_CAPABILITY_SPEC } from './WorkflowCapabilitySpec';

export function createWorkflowCapabilityPromptCompact(): string {
  const compactSpec = {
    version: WORKFLOW_CAPABILITY_SPEC.version,
    outputRules: WORKFLOW_CAPABILITY_SPEC.outputRules,
    supportedBlockTypes: Object.fromEntries(
      Object.entries(WORKFLOW_CAPABILITY_SPEC.supportedBlockTypes).map(([type, spec]) => [
        type,
        {
          category: spec.category,
          requiredData: spec.requiredData,
          optionalData: spec.optionalData,
          forbiddenData: spec.forbiddenData || []
        }
      ])
    ),
    unsupportedPatterns: WORKFLOW_CAPABILITY_SPEC.unsupportedPatterns
  };

  return [
    'Only use the capability manifest below. Never invent unsupported block types, data fields, handles, or dataflow semantics.',
    JSON.stringify(compactSpec, null, 2)
  ].join('\n');
}
