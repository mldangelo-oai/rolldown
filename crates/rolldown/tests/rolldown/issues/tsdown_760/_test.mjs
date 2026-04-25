import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(import.meta.dirname, 'dist');

function listJsFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((dirent) => {
      const absolutePath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        return listJsFiles(absolutePath, base);
      }
      if (!dirent.isFile() || !dirent.name.endsWith('.js')) {
        return [];
      }
      return path.relative(base, absolutePath).split(path.sep).join(path.posix.sep);
    })
    .sort();
}

const jsFiles = listJsFiles(distDir);

function normalizeRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  return normalized.endsWith('.js') ? normalized : null;
}

function getStaticImports(file, code) {
  const imports = [];
  const pattern =
    /\bimport\s*(?:["']([^"']+)["']|(?:[^;\n]*?)\bfrom\s*["']([^"']+)["'])|\bexport\s*(?:\*\s*)?(?:[^;\n]*?\bfrom\s*)["']([^"']+)["']/g;
  for (const match of code.matchAll(pattern)) {
    const dep = normalizeRelativeImport(file, match[1] ?? match[2] ?? match[3]);
    if (dep) {
      imports.push(dep);
    }
  }
  return imports;
}

const graph = Object.fromEntries(
  jsFiles.map((file) => {
    const code = fs.readFileSync(path.join(distDir, file), 'utf8');
    return [file, getStaticImports(file, code)];
  }),
);

function findCycle() {
  const visited = new Set();
  const inStack = new Set();

  function dfs(file, pathSoFar) {
    if (inStack.has(file)) {
      return pathSoFar.slice(pathSoFar.indexOf(file)).concat(file);
    }
    if (visited.has(file)) {
      return null;
    }
    visited.add(file);
    inStack.add(file);
    for (const dep of graph[file] ?? []) {
      const cycle = dfs(dep, pathSoFar.concat(file));
      if (cycle) {
        return cycle;
      }
    }
    inStack.delete(file);
    return null;
  }

  for (const file of Object.keys(graph)) {
    const cycle = dfs(file, []);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

const missingEdges = Object.entries(graph).flatMap(([file, imports]) =>
  imports.filter((dep) => !Object.hasOwn(graph, dep)).map((dep) => `${file} -> ${dep}`),
);
assert.deepStrictEqual(missingEdges, [], 'Output chunks must not import missing JS chunks');

assert.strictEqual(
  findCycle(),
  null,
  `Output chunks must not have circular static imports: ${JSON.stringify(graph)}`,
);

await import('./dist/main.js');
assert.strictEqual(globalThis.__rolldown_tsdown_760_value, 300000);
assert.strictEqual(globalThis.__rolldown_tsdown_760_side, 1);

await Promise.all(globalThis.__rolldown_tsdown_760_imports);
assert.strictEqual(globalThis.__rolldown_tsdown_760_side, 1);
