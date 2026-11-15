import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const roles = [
  'feature, refactoring', 'bug-fix', 'perf-issue', 'hillclimb', 'judgment and prose',
  'hardest tasks', 'how explorer', 'how explainer', 'why investigators', 'why synthesizer',
  'reflect tooling', 'reflect judgment, divergent, synthesizer', 'arena runners',
  'arena cross-judge pool', 'swarm workers', 'architect runners', 'interrogate reviewers',
];
const panels = new Set(['arena runners', 'arena cross-judge pool', 'architect runners', 'interrogate reviewers']);
const budgets = { unlimited: 'max', large: 'xhigh', medium: 'high', small: 'medium' };
const aliases = new Set(['auto', 'inherit-parent']);
const modes = new Set(['auto', 'native', 't3', 'orca']);
const backends = new Set(['t3', 'orca']);
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function backendName(backend) { requireValue(backends.has(backend), 'Expected t3 or orca. Native settings use the original setup flow.'); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }

export function decode(text) {
  const blocks = [...text.matchAll(/^```json\s*\n([\s\S]*?)^```\s*$/gm)];
  requireValue(blocks.length === 1, 'Expected exactly one fenced JSON configuration block.');
  return JSON.parse(blocks[0][1]);
}
export function encode(config) { return `# 0xStack orchestration configuration\n\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n`; }
export function selectBackend({ mode = 'auto', preference, t3 = false, orca = false, locked } = {}) {
  requireValue(typeof t3 === 'boolean' && typeof orca === 'boolean', 'Discovery flags must be boolean.');
  requireValue(modes.has(mode), `Unknown mode ${mode}.`);
  requireValue(preference === undefined || ['native', 't3', 'orca'].includes(preference), 'Invalid backend preference.');
  if (locked) {
    requireValue(['native', 't3', 'orca'].includes(locked), 'Invalid locked backend.');
    requireValue(mode === 'auto' || mode === locked, `This run belongs to ${locked}; backend switching is forbidden.`);
    return locked;
  }
  const available = { native: true, t3: t3 === true, orca: orca === true };
  if (mode !== 'auto') {
    requireValue(available[mode], `Requested ${mode} backend is unavailable. No fallback was performed.`);
    return mode;
  }
  if (preference && available[preference]) return preference;
  if (t3 && orca) throw new Error('Both T3 and Orca are available. Ask the user to choose a backend.');
  return t3 ? 't3' : orca ? 'orca' : 'native';
}
function runnableT3(provider, parentProvider) {
  return provider.canRunChildTask === true && (provider.providerInstanceId === parentProvider || provider.canRunCrossProviderChildTask === true);
}
export function detectT3(capabilities) {
  return object(capabilities) && nonempty(capabilities.parentThreadId) &&
    capabilities.features?.appOwnedSubagents === true &&
    capabilities.providers?.some(p => runnableT3(p, capabilities.inheritedProviderInstanceId)) === true;
}
export function detectOrca(status, current, cwd, verifiedWorkspacePath = current?.result?.worktree?.path) {
  const runtime = status?.result?.runtime;
  const workspace = current?.result;
  return status?.ok === true && runtime?.reachable === true && current?.ok === true &&
    object(workspace) && nonempty(cwd) && nonempty(verifiedWorkspacePath) &&
    (resolve(cwd) === resolve(verifiedWorkspacePath) || resolve(cwd).startsWith(resolve(verifiedWorkspacePath) + '/'));
}
export function t3Catalog(capabilities) {
  requireValue(detectT3(capabilities), 'T3 delegation requires an active T3 parent and a runnable provider.');
  return capabilities.providers.filter(p => runnableT3(p, capabilities.inheritedProviderInstanceId)).flatMap(p =>
    p.models.map(m => ({ provider: p.providerInstanceId, model: m.id, options: m.options ?? [] })));
}
export function validateConfig(config, backend, catalog) {
  backendName(backend);
  requireValue(object(config) && config.version === 1 && config.backend === backend, 'Configuration version or backend mismatch.');
  requireValue(Object.hasOwn(budgets, config.budget), 'Unknown reasoning budget.');
  requireValue(object(config.roles), 'Expected a role map.');
  requireValue(Array.isArray(catalog), 'A discovered target catalog is required.');
  for (const [role, entries] of Object.entries(config.roles)) {
    requireValue(roles.includes(role), `Unknown role ${role}.`);
    requireValue(Array.isArray(entries) && entries.length > 0 && (panels.has(role) || entries.length === 1), `Invalid number of targets for ${role}.`);
    for (const entry of entries) validateTarget(entry, backend, catalog);
  }
  return config;
}
export function validateTarget(target, backend, catalog) {
  if (aliases.has(target)) return target;
  requireValue(object(target) && nonempty(target.provider) && nonempty(target.model), 'Expected provider and model identifiers or a parent alias.');
  requireValue(nonempty(target.family), 'An explicit model family is required for panel diversity checks.');
  const found = catalog.find(t => t.provider === target.provider && t.model === target.model);
  requireValue(found, `Unavailable target ${target.provider}/${target.model}. Available targets: ${catalog.map(t => `${t.provider}/${t.model}`).join(', ') || 'none'}. Configuration was preserved.`);
  requireValue(target.options === undefined || object(target.options), 'Expected an options object.');
  for (const [id, value] of Object.entries(target.options ?? {})) {
    const option = found.options?.find(o => o.id === id);
    requireValue(option?.values.includes(value), `Unsupported option ${id}=${value} for ${target.provider}/${target.model}.`);
  }
  if (backend === 'orca') {
    requireValue(Object.keys(target.options ?? {}).every(k => k === 'effort'), 'Orca accepts only verified effort overrides.');
    if (['opencode', 'opencode2'].includes(target.provider)) requireValue(!target.options?.effort, 'Orca OpenCode effort overrides are unsupported.');
  }
  return target;
}
export function resolveRole(config, role, catalog, parent) {
  requireValue(roles.includes(role), `Unknown role ${role}.`);
  const entries = config.roles[role];
  requireValue(entries, `No ${config.backend} configuration for ${role}. Run setup-pstack for this backend.`);
  return entries.map(entry => {
    const target = aliases.has(entry) ? parent : entry;
    requireValue(target, 'Parent identity is unavailable. Configure an explicit target.');
    validateTarget(target, config.backend, catalog);
    return target;
  });
}
export function budgetTarget(target, budget, catalog, effortOption) {
  requireValue(Object.hasOwn(budgets, budget), 'Unknown reasoning budget.');
  if (aliases.has(target)) return target;
  const found = catalog.find(t => t.provider === target.provider && t.model === target.model);
  const option = found?.options?.find(o => o.id === effortOption);
  requireValue(option, `No supported reasoning option for ${target.provider}/${target.model}. Request a choice.`);
  const ladder = ['low', 'medium', 'high', 'xhigh', 'max'];
  const allowed = ladder.slice(0, ladder.indexOf(budgets[budget]) + 1).filter(v => option.values.includes(v));
  requireValue(allowed.length, 'No supported reasoning level at or below this budget. Request a choice.');
  return { ...target, options: { ...target.options, [effortOption]: allowed.at(-1) } };
}
export function t3Request(target, task, { requestId, writing = false } = {}) {
  requireValue(nonempty(task) && nonempty(requestId), 'Task and persistent request ID are required.');
  return { task, clientRequestId: requestId, isolation: writing ? 'worktree' : 'shared',
    target: { providerInstanceId: target.provider, model: target.model, options: target.options ?? {} } };
}
export function orcaArguments(target, taskId, { requestId, retryRequestId, worktree = 'current', runId, coordinator } = {}) {
  requireValue(nonempty(taskId) && nonempty(requestId) && nonempty(runId), 'Task, Run, and persistent request IDs are required.');
  requireValue(Object.keys(target.options ?? {}).every(k => k === 'effort'), 'Orca accepts only verified effort overrides.');
  if (['opencode', 'opencode2'].includes(target.provider)) requireValue(!target.options?.effort, 'Orca OpenCode effort overrides are unsupported.');
  if (['opencode', 'opencode2'].includes(target.provider)) requireValue(!['new-child', 'new-top-level'].includes(worktree), 'Create an isolated Orca worktree first, then launch OpenCode using its existing selector.');
  const args = ['orchestration', 'worker-start', '--run', runId, '--task', taskId, '--worktree', worktree, '--agent', target.provider, '--model', target.model];
  if (target.options?.effort) args.push('--effort', target.options.effort);
  if (retryRequestId !== undefined) {
    requireValue(nonempty(retryRequestId), 'Recovery requires the observed Orca request ID.');
    args.push('--retry-request', retryRequestId);
  }
  if (coordinator !== undefined) {
    requireValue(nonempty(coordinator), 'An observed coordinator handle is required.');
    args.push('--from', coordinator);
  }
  args.push('--json');
  return args;
}

function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, value, { mode: 0o600, flag: 'wx' }); renameSync(temporary, path); }
  finally { rmSync(temporary, { force: true }); }
}
function readOptional(path, parser) { return existsSync(path) ? parser(readFileSync(path, 'utf8')) : null; }
function locked(path, action) {
  mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  try { mkdirSync(lock); } catch { throw new Error(`Another writer or interrupted write owns ${lock}. Inspect before removing this lock.`); }
  try { return action(); } finally { rmSync(lock, { recursive: true }); }
}
export function configPath(root, backend) { backendName(backend); return join(root, 'backends', `${backend}.md`); }
export function saveConfig(root, backend, config, catalog) {
  validateConfig(config, backend, catalog);
  const path = configPath(root, backend);
  return locked(path, () => { atomicWrite(path, encode(config)); return path; });
}
export function updateRole(root, backend, role, targets, catalog, budget) {
  const path = configPath(root, backend);
  return locked(path, () => {
    const config = readOptional(path, decode) ?? { version: 1, backend, budget: budget ?? 'large', roles: {} };
    const next = { ...config, roles: { ...config.roles, [role]: targets } };
    if (budget !== undefined) next.budget = budget;
    validateConfig(next, backend, catalog);
    atomicWrite(path, encode(next));
    return next;
  });
}
export function resetConfig(root, backend) {
  const path = configPath(root, backend);
  return locked(path, () => { rmSync(path, { force: true }); return path; });
}
export function savePreference(root, config) {
  requireValue(config.version === 1 && modes.has(config.mode), 'Invalid preference configuration.');
  requireValue(config.preference === undefined || ['native', 't3', 'orca'].includes(config.preference), 'Invalid backend preference.');
  const path = join(root, 'orchestration.md');
  return locked(path, () => { atomicWrite(path, encode(config)); return path; });
}
export function beginRun(path, backend) {
  requireValue(['native', 't3', 'orca'].includes(backend), 'Invalid run backend.');
  return locked(path, () => {
    const existing = readOptional(path, JSON.parse);
    if (existing) { requireValue(existing.backend === backend, 'Run backend is immutable.'); return existing; }
    const run = { version: 1, backend, ...(backend === 'orca' ? { runCreateOperationId: randomUUID() } : {}), tasks: {} };
    atomicWrite(path, JSON.stringify(run, null, 2));
    return run;
  });
}
export function bindRun(path, backend, receipt) {
  return locked(path, () => {
    const run = JSON.parse(readFileSync(path, 'utf8'));
    requireValue(backend === 'orca' && run.backend === backend, 'Only the owning Orca backend can bind its Run.');
    requireValue(object(receipt) && nonempty(receipt.runId), 'An observed Orca Run ID is required.');
    requireValue(run.runId === undefined || run.runId === receipt.runId, 'Orca Run ID is immutable.');
    requireValue(Object.values(run.tasks).every(t => t.runId === undefined || t.runId === receipt.runId), 'Existing tasks belong to a different Orca Run.');
    run.runId = receipt.runId;
    run.runReceipt = receipt;
    atomicWrite(path, JSON.stringify(run, null, 2));
    return run;
  });
}
export function prepareTask(path, key, target, briefPath, placement) {
  requireValue(nonempty(key) && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key) && nonempty(briefPath) && nonempty(placement), 'A task key starting with a letter or digit, saved brief, and placement are required.');
  return locked(path, () => {
    const run = JSON.parse(readFileSync(path, 'utf8'));
    requireValue(!Object.hasOwn(run.tasks, key), 'Task already has an attempt. Recover its original backend record; do not dispatch again.');
    const task = { backend: run.backend, ...(run.backend === 'orca' ? { taskCreateOperationId: randomUUID() } : {}), requestId: randomUUID(), state: 'prepared', target, briefPath, placement };
    run.tasks[key] = task;
    atomicWrite(path, JSON.stringify(run, null, 2));
    return task;
  });
}
const transitions = {
  prepared: ['accepted', 'unknown', 'failed'], accepted: ['running', 'waiting', 'unknown', 'completed', 'failed', 'cancel_requested', 'cancelled'],
  running: ['waiting', 'unknown', 'completed', 'failed', 'cancel_requested', 'cancelled'], waiting: ['running', 'unknown', 'completed', 'failed', 'cancel_requested', 'cancelled'],
  unknown: ['accepted', 'running', 'waiting', 'completed', 'failed', 'cancel_requested', 'cancelled'],
  cancel_requested: ['unknown', 'completed', 'failed', 'cancelled'], completed: [], failed: [], cancelled: [],
};
export function recordTask(path, key, backend, state, receipt) {
  return locked(path, () => {
    const run = JSON.parse(readFileSync(path, 'utf8'));
    const task = Object.hasOwn(run.tasks, key) ? run.tasks[key] : undefined;
    requireValue(task && backend === run.backend && backend === task.backend, 'Task backend ownership mismatch.');
    requireValue(transitions[task.state]?.includes(state) || task.state === state, `Invalid transition ${task.state} to ${state}.`);
    requireValue(object(receipt) && Object.keys(receipt).length > 0, 'Backend receipt or explicit uncertainty evidence is required.');
    for (const id of ['taskId', 'runId', 'dispatchId', 'childThreadId', 'environmentId']) {
      if (task[id] !== undefined && receipt[id] !== undefined) requireValue(task[id] === receipt[id], `Task ${id} is immutable.`);
    }
    if (backend === 'orca' && run.runId !== undefined && receipt.runId !== undefined) requireValue(run.runId === receipt.runId, 'Task belongs to a different Orca Run.');
    const merged = { ...task, ...Object.fromEntries(['taskId', 'runId', 'dispatchId', 'childThreadId', 'environmentId'].filter(id => receipt[id] !== undefined).map(id => [id, receipt[id]])) };
    if (!['prepared', 'unknown', 'failed'].includes(state)) {
      requireValue(nonempty(merged.taskId), 'Accepted work needs its backend task ID.');
      if (backend === 'orca') requireValue(nonempty(merged.runId) && nonempty(merged.dispatchId), 'Orca work needs Run and Dispatch IDs.');
    }
    if (['completed', 'failed', 'cancelled'].includes(state)) requireValue(nonempty(receipt.evidence), 'Terminal states need completion evidence.');
    run.tasks[key] = { ...merged, state, receipt, receipts: [...(task.receipts ?? []), { state, receipt }] };
    atomicWrite(path, JSON.stringify(run, null, 2));
    return run.tasks[key];
  });
}

export function cli(command, input, root = join(homedir(), '.config', '0xstack')) {
  switch (command) {
    case 'show': return { preference: readOptional(join(root, 'orchestration.md'), decode), t3: readOptional(configPath(root, 't3'), decode), orca: readOptional(configPath(root, 'orca'), decode) };
    case 'select': return selectBackend(input);
    case 'detect': return { t3: detectT3(input.t3), orca: detectOrca(input.status, input.current, input.cwd, input.verifiedWorkspacePath) };
    case 'catalog': return t3Catalog(input);
    case 'budget': return budgetTarget(input.target, input.budget, input.catalog, input.effortOption);
    case 't3-request': return t3Request(input.target, input.task, input);
    case 'orca-args': return orcaArguments(input.target, input.taskId, input);
    case 'preference': return savePreference(root, input);
    case 'save': return saveConfig(root, input.backend, input.config, input.catalog);
    case 'set-role': return updateRole(root, input.backend, input.role, input.targets, input.catalog, input.budget);
    case 'reset': return resetConfig(root, input.backend);
    case 'resolve': return resolveRole(input.config, input.role, input.catalog, input.parent);
    case 'begin': return beginRun(input.path, input.backend);
    case 'bind': return bindRun(input.path, input.backend, input.receipt);
    case 'prepare': return prepareTask(input.path, input.key, input.target, input.briefPath, input.placement);
    case 'record': return recordTask(input.path, input.key, input.backend, input.state, input.receipt);
    default: throw new Error('Commands: show, detect, select, catalog, budget, preference, save, set-role, reset, resolve, t3-request, orca-args, begin, bind, prepare, record. Pass JSON on stdin. Optional --root <isolated-config-directory>.');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, flag, root] = process.argv.slice(2);
    requireValue(flag === undefined || flag === '--root' && nonempty(root), 'Expected --root <directory>.');
    const input = command === 'show' ? {} : JSON.parse(readFileSync(0, 'utf8'));
    console.log(JSON.stringify(cli(command, input, root), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
