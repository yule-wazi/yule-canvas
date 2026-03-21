// Block类型定义

export type BlockType =
  // 浏览器控制类
  | 'navigate'
  | 'scroll'
  | 'wait'
  // 页面交互类
  | 'click'
  | 'type'
  | 'select'
  // 数据提取类
  | 'extract'
  | 'extract-images'
  | 'extract-links'
  // 逻辑控制类
  | 'condition'
  | 'loop'
  | 'log'
  // 数据处理类
  | 'transform'
  | 'filter';

export type BlockCategory = 'browser' | 'interaction' | 'extraction' | 'logic' | 'data';

export interface BlockPort {
  id: string;
  name: string;
  type: 'flow' | 'data';
}

export interface BlockData {
  [key: string]: any;
}

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  category: BlockCategory;
  position: { x: number; y: number };
  data: BlockData;
  inputs: BlockPort[];
  outputs: BlockPort[];
}

// 各种Block的具体数据类型

export interface NavigateBlockData extends BlockData {
  url: string;
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle';
  timeout: number;
}

export interface ScrollBlockData extends BlockData {
  mode: 'smart' | 'fixed';
  maxScrolls: number;
  delay: number;
}

export interface WaitBlockData extends BlockData {
  duration: number;
}

export interface ClickBlockData extends BlockData {
  selector: string;
  waitForElement: boolean;
  timeout: number;
}

export interface TypeBlockData extends BlockData {
  selector: string;
  text: string;
  delay: number;
}

export interface SelectBlockData extends BlockData {
  selector: string;
  value: string;
}

export interface ExtractBlockData extends BlockData {
  selector: string;
  attribute: 'text' | 'src' | 'href' | 'value';
  multiple: boolean;
}

export interface ExtractImagesBlockData extends BlockData {
  filterInvalid: boolean;
  attributes: string[];
}

export interface ExtractLinksBlockData extends BlockData {
  filterPattern?: string;
}

export interface ConditionBlockData extends BlockData {
  condition: string;
}

export interface LoopBlockData extends BlockData {
  mode: 'count' | 'array';
  count: number;
  arraySource?: string;
}

export interface LogBlockData extends BlockData {
  message: string;
}

export interface TransformBlockData extends BlockData {
  script: string;
}

export interface FilterBlockData extends BlockData {
  condition: string;
}
