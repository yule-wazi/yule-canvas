// Connection类型定义

export interface Connection {
  id: string;
  source: string;        // 源block ID
  sourceHandle: string;  // 源端口ID
  target: string;        // 目标block ID
  targetHandle: string;  // 目标端口ID
  type?: 'flow' | 'data'; // 连接类型
}
