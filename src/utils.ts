import * as process from "node:process";
import * as fs from "node:fs";
import * as path from "node:path";
import jsYaml from "js-yaml";
import { supportedPluginExtensions } from "./constanse";
import { WatchListener } from "fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// 缓存 cwd
let cachedCwd: string | undefined;
const getCwd = () => {
  if (!cachedCwd) cachedCwd = process.cwd();
  return cachedCwd;
};

export function display_path(input_path: string) {
  return input_path.replace(getCwd(), "").replace(/^([/\\])*/g, "");
}
export function isClassConstructor<T extends Function>(target: T): boolean {
  return typeof target === "function" && target.toString().startsWith("class");
}
export function isExistDir(dir: string) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}
export function isExistFile(file: string) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}
export function isSameObj<T = any>(a: T, b: T) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function currentFile(current=import.meta.url) {
  const previousPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = function (_, stack) {
    return stack;
  };
  const stack = new Error().stack as unknown as NodeJS.CallSite[];
  Error.prepareStackTrace = previousPrepareStackTrace;
  const stackFiles= Array.from(new Set(stack.map(site=>site.getFileName())));
  const idx=stackFiles.findIndex(f=>f===fileURLToPath(current)||f===current);
  const result=stackFiles[idx+1];
  if(!result) throw new Error("Cannot resolve current file path");
  try {
    return fileURLToPath(result);
  } catch {
    return result;
  }
}
export function watchFile(
  file_path: string | string[],
  callback: WatchListener<string>
) {
  if (typeof file_path === 'string') {
    const watcher = fs.watch(file_path, callback);
    return () => watcher.close();
  }
  
  const watchers = file_path.map((file) => fs.watch(file, callback));
  return () => {
    for(const watcher of watchers) watcher.close();
  };
}
export function wrapExport<T = any>(m: any): T {
  if (!m?.default) return m as T;
  return new Proxy(m.default, {
    get(target, p, receiver) {
      return target[p];
    },
  }) as T;
}
export function loadYaml<T extends object>(file: string,defaultObj:Partial<T>): Partial<T> {
  if (!fs.existsSync(file)) fs.writeFileSync(file, jsYaml.dump(defaultObj));
  if (/\.ya?ml$/.test(file))
    return jsYaml.load(fs.readFileSync(file).toString()) as Partial<T>;
  if (/\on$/.test(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  throw new Error(`Unsupported options file format: ${file}`);
}
export function saveYaml<T extends object>(options: Partial<T>, file: string) {
  if (/\.ya?ml$/.test(file))
    return fs.writeFileSync(file, jsYaml.dump(options));
  if (/\on$/.test(file))
    return fs.writeFileSync(file, JSON.stringify(options, null, 2));
  throw new Error(`Unsupported options file format: ${file}`);
}
export function resolveEntry(pluginName: string, pluginDirs: string[]) {
  for (const dir of pluginDirs) {
    for(const ext of supportedPluginExtensions){
      const fullPath = path.join(dir, pluginName + ext)
      if(fs.existsSync(fullPath)) return fullPath
    }
  }
  throw new Error(
    `Plugin entry for "${pluginName}" not found in dirs: ${pluginDirs.join(", ")}`
  );
}
// Hash 缓存
const fileHashCache = new Map<string, {hash: string, mtime: number}>()

export function getFileHash(filePath: string): string {
  const stat = fs.statSync(filePath);
  let targetFile = filePath
  
  if (stat.isDirectory()) {
    const pkgPath = path.join(filePath, "package.json");
    let main:string|undefined
    
    // 优化：先检查 package.json
    if(fs.existsSync(pkgPath)){
      const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf-8'));
      if(pkg.main) main = path.join(filePath,pkg.main);
    }
    
    // 如果没有在 package.json 中找到，按顺序查找
    if(!main){
      const candidates = ['index.js', 'index.ts', 'index.mjs', 'index.cjs', 'index.jsx', 'index.tsx']
      for(const file of candidates){
        const fullPath = path.join(filePath, file)
        if(fs.existsSync(fullPath)){
          main = fullPath
          break
        }
      }
    }
    
    if(!main) throw new Error(`Cannot determine main file for directory "${filePath}"`);
    targetFile = main
  }
  
  // 检查缓存
  const targetStat = targetFile === filePath ? stat : fs.statSync(targetFile)
  const mtime = targetStat.mtimeMs
  const cached = fileHashCache.get(targetFile)
  if(cached && cached.mtime === mtime) return cached.hash
  
  // 计算新 hash
  const content = fs.readFileSync(targetFile);
  const hash = createHash("sha256").update(content).digest("hex");
  
  // 缓存结果（限制缓存大小）
  if(fileHashCache.size > 1000) fileHashCache.clear()
  fileHashCache.set(targetFile, {hash, mtime})
  
  return hash;
}