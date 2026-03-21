// Workflow类型定义

import type { Block } from './block';
import type { Connection } from './connection';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  blocks: Block[];
  connections: Connection[];
  variables: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowExecutionResult {
  success: boolean;
  dataType: string;
  url: string;
  timestamp: number;
  count: number;
  items: any[];
  error?: string;
}
