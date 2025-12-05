import { useHooks } from "../hooks";
import { Directive } from "@zhinjs/directive";
import { MessageEvent } from "../event";

const {root,directive} = useHooks();

// 性能优化：预编译格式化函数
const formatMemory = (bytes: number) => (bytes / 1048576).toFixed(2) + " MB";

// 性能优化：缓存固定字符串
const HEADER = "=== System Status ===";
const FOOTER = "====================";

const status = new Directive<[MessageEvent]>("zt").handle(() => {
  // 触发垃圾回收（如果可用）
  if (global.gc) global.gc();
  
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // 性能优化：使用数组join代替字符串拼接
  return [
    HEADER,
    `Plugin Count: ${root.children.length}`,
    `Adapter Count: ${root.adapters.size}`,
    `Account Count: ${root.root.accounts.length}`,
    `Uptime: ${uptime.toFixed(2)}s`,
    `Memory Rss: ${formatMemory(memUsage.rss)}`,
    `Memory Heap: ${formatMemory(memUsage.heapUsed)}/${formatMemory(memUsage.heapTotal)}`,
    `Memory External: ${formatMemory(memUsage.external)}`,
    FOOTER,
  ].join("\n");
});

directive(status);
