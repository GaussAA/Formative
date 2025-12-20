/**
 * Memory Module Entry Point
 * 提供统一的记忆存储访问接口
 */

import { LocalJSONStorage } from './local-storage';
import { MemoryStorage } from './interface';

// MVP阶段使用本地JSON存储
const storage: MemoryStorage = new LocalJSONStorage();

export default storage;
export type { MemoryStorage } from './interface';
