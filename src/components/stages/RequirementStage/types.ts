/**
 * RequirementStage 组件类型定义
 */

import type { OptionChip } from '@/types';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  options?: OptionChip[];
}

export type Mode = 'chat' | 'form';

export interface ChatModeProps {
  messages: Message[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  sendMessage: (text: string) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  streamingContent?: string; // React 19: 流式响应内容
}

export interface FormModeProps {
  formData: import('@/types').RequirementProfile;
  setFormData: React.Dispatch<React.SetStateAction<import('@/types').RequirementProfile>>;
  coreFunctionInput: string;
  setCoreFunctionInput: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  handleFormSubmit: (e: React.FormEvent) => Promise<void>;
  handleAddCoreFunction: () => void;
  handleRemoveCoreFunction: (index: number) => void;
}

export interface ModeSwitcherProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  title: string;
}
