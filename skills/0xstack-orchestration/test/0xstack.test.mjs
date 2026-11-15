import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as p from '../scripts/0xstack.mjs';

const claude = { provider: 'claudeAgent', model: 'claude-example', family: 'claude', options: { effort: 'high' } };
const codex = { provider: 'codex', model: 'gpt-example', family: 'gpt', options: { reasoningEffort: 'xhigh' } };
const open = { provider: 'opencode', model: 'provider/model', family: 'example' };
const catalog = [
  { provider: claude.provider, model: claude.model, options: [{ id: 'effort', values: ['medium', 'high', 'xhigh'] }] },
  { provider: codex.provider, model: codex.model, options: [{ id: 'reasoningEffort', values: ['medium', 'high', 'xhigh', 'max'] }] },
  { provider: open.provider, model: open.model, options: [] },
];
const config = backend => ({ version: 1, backend, budget: 'large', roles: { 'arena runners': [claude, backend === 'orca' ? { ...codex, options: {} } : codex], 'swarm workers': [open] } });
function sandbox(t) { const root = mkdtempSync(join(tmpdir(), '0xstack-test-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }

for (const [label, input, expected] of [
  ['native only', {}, 'native'], ['T3 only', { t3: true }, 't3'], ['Orca only', { orca: true }, 'orca'],
  ['explicit native with both', { mode: 'native', t3: true, orca: true }, 'native'],
  ['saved preference', { preference: 'orca', t3: true, orca: true }, 'orca'],
  ['explicit T3', { mode: 't3', t3: true, orca: true }, 't3'],
  ['locked during outage', { locked: 't3' }, 't3'],
]) test(`backend selection ${label}`, () => assert.equal(p.selectBackend(input), expected));
test('ambiguous, unavailable, invalid and switched backends fail clearly', () => {
  for (const input of [{ t3: true, orca: true }, { mode: 't3' }, { mode: 'orca' }, { mode: 'other' }, { mode: 'orca', locked: 't3', orca: true }]) assert.throws(() => p.selectBackend(input));
});
test('T3 requires delegation context and runnable providers', () => {
  const capabilities = { parentThreadId: 'parent', features: { appOwnedSubagents: true }, providers: [{ providerInstanceId: 'custom', canRunChildTask: true, canRunCrossProviderChildTask: true, models: [{ id: 'custom-model' }] }, { providerInstanceId: 'disabled', canRunChildTask: false, models: [{ id: 'hidden' }] }] };
  assert.equal(p.detectT3(capabilities), true);
  assert.deepEqual(p.t3Catalog(capabilities), [{ provider: 'custom', model: 'custom-model', options: [] }]);
  assert.equal(p.detectT3({ ...capabilities, parentThreadId: null }), false);
  assert.equal(p.detectT3({ ...capabilities, providers: [] }), false);
});
test('Orca needs runtime and verified workspace, not installation', () => {
  const status = { ok: true, result: { runtime: { reachable: true } } };
  assert.equal(p.detectOrca(status, { ok: true, result: {} }, '/repo', '/repo'), true);
  assert.equal(p.detectOrca(status, { ok: true, result: {} }, '/elsewhere', '/repo'), false);
  assert.equal(p.detectOrca({ ok: true, result: { runtime: { reachable: false } } }, { ok: true, result: {} }, '/repo', '/repo'), false);
  assert.equal(p.detectOrca(status, { ok: false }, '/repo', '/repo'), false);
});
test('all native role names are retained', () => {
  const setup = readFileSync(new URL('../../setup-pstack/SKILL.md', import.meta.url), 'utf8');
  const roles = [...setup.matchAll(/^([^#\n]+): (?:grok-|claude-).+$/gm)].map(m => m[1]);
  assert.deepEqual(p.roles, roles);
});
test('role targets retain panel order, aliases, and count', () => {
  const value = config('t3'); value.roles['arena runners'].push('auto', 'inherit-parent');
  p.validateConfig(value, 't3', catalog);
  assert.deepEqual(p.resolveRole(value, 'arena runners', catalog, codex), [claude, codex, codex, codex]);
  assert.throws(() => p.resolveRole(value, 'hardest tasks', catalog, codex), /setup-pstack/);
  assert.throws(() => p.resolveRole(value, 'arena runners', catalog), /Parent identity/);
});
test('models, options, budget, role shape and backend identity are validated', () => {
  for (const value of [
    { ...config('t3'), backend: 'orca' }, { ...config('t3'), budget: 'unknown' },
    { ...config('t3'), roles: { missing: [claude] } },
    { ...config('t3'), roles: { 'swarm workers': [claude, codex] } },
    { ...config('t3'), roles: { 'swarm workers': [{ ...claude, model: 'missing' }] } },
    { ...config('t3'), roles: { 'swarm workers': [{ ...claude, options: { effort: 'ultra' } }] } },
  ]) assert.throws(() => p.validateConfig(value, 't3', catalog));
});
test('budgets use supported levels within the chosen model and preserve aliases', () => {
  assert.equal(p.budgetTarget(claude, 'unlimited', catalog, 'effort').options.effort, 'xhigh');
  assert.equal(p.budgetTarget(codex, 'small', catalog, 'reasoningEffort').options.reasoningEffort, 'medium');
  assert.equal(p.budgetTarget('auto', 'small', catalog, 'effort'), 'auto');
  assert.throws(() => p.budgetTarget(open, 'small', catalog, 'effort'), /Request a choice/);
});
test('configuration updates, reruns, reset and rejection preserve other backends and native files', t => {
  const root = sandbox(t);
  for (const path of ['.agents/pstack-models.md', '.claude/rules/pstack-models.md', '.cursor/rules/pstack-models.mdc']) {
    mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), 'custom native configuration');
  }
  p.saveConfig(root, 't3', config('t3'), catalog);
  p.saveConfig(root, 'orca', config('orca'), catalog);
  const orca = readFileSync(p.configPath(root, 'orca'), 'utf8');
  p.updateRole(root, 't3', 'hardest tasks', [codex], catalog);
  const t3 = readFileSync(p.configPath(root, 't3'), 'utf8');
  assert.equal(readFileSync(p.configPath(root, 'orca'), 'utf8'), orca);
  p.saveConfig(root, 't3', p.decode(t3), catalog);
  assert.equal(readFileSync(p.configPath(root, 't3'), 'utf8'), t3);
  assert.throws(() => p.updateRole(root, 't3', 'hardest tasks', [{ ...codex, model: 'missing' }], catalog));
  assert.equal(readFileSync(p.configPath(root, 't3'), 'utf8'), t3);
  p.updateRole(root, 'orca', 'hardest tasks', [open], catalog);
  assert.equal(readFileSync(p.configPath(root, 't3'), 'utf8'), t3);
  p.resetConfig(root, 't3');
  assert.equal(p.cli('show', {}, root).t3, null);
  assert.ok(p.cli('show', {}, root).orca);
  for (const path of ['.agents/pstack-models.md', '.claude/rules/pstack-models.md', '.cursor/rules/pstack-models.mdc']) assert.equal(readFileSync(join(root, path), 'utf8'), 'custom native configuration');
  assert.throws(() => p.resetConfig(root, 'native'));
});
test('T3 cross-provider request builders support independent isolated writers', () => {
  const requests = [claude, open].map((target, index) => p.t3Request(target, 'self-contained brief', { requestId: `request-${index}`, writing: true }));
  assert.deepEqual(requests.map(r => r.target.providerInstanceId), ['claudeAgent', 'opencode']);
  assert.ok(requests.every(r => r.isolation === 'worktree'));
  assert.equal(new Set(requests.map(r => r.clientRequestId)).size, 2);
  assert.deepEqual(requests[0].target.options, { effort: 'high' });
});
test('Orca launch arguments preserve model, effort, IDs and placement', () => {
  const target = { ...claude, provider: 'claude' };
  const args = p.orcaArguments(target, 'task-1', { requestId: 'request-1', runId: 'run-1', worktree: 'new-child' });
  assert.deepEqual(args, ['orchestration', 'worker-start', '--run', 'run-1', '--task', 'task-1', '--worktree', 'new-child', '--agent', 'claude', '--model', 'claude-example', '--effort', 'high', '--json']);
  for (const provider of ['codex', 'opencode']) assert.ok(p.orcaArguments({ ...open, provider }, 'task-1', { requestId: 'request-1', runId: 'run-1', worktree: 'path:/isolated' }).includes(provider));
  assert.throws(() => p.orcaArguments(open, 'task-1', { requestId: 'request-1', runId: 'run-1', worktree: 'new-child' }), /existing selector/);
  assert.throws(() => p.validateTarget({ ...open, options: { effort: 'high' } }, 'orca', catalog));
});
test('ownership survives restart and uncertain dispatch never permits duplicate prepare', t => {
  const path = join(sandbox(t), 'run.json');
  p.beginRun(path, 't3');
  const prepared = p.prepareTask(path, 'research', claude, '/brief.md', 'worktree');
  p.recordTask(path, 'research', 't3', 'unknown', { evidence: 'Connection lost after submit.' });
  assert.equal(p.beginRun(path, 't3').tasks.research.requestId, prepared.requestId);
  assert.throws(() => p.beginRun(path, 'orca'), /immutable/);
  assert.throws(() => p.prepareTask(path, 'research', open, '/brief.md', 'worktree'), /already/);
  assert.throws(() => p.recordTask(path, 'research', 'orca', 'running', { taskId: 'other' }), /ownership/);
  p.recordTask(path, 'research', 't3', 'accepted', { taskId: 'task-1' });
  p.recordTask(path, 'research', 't3', 'cancel_requested', { status: 'cancel_requested' });
  assert.throws(() => p.recordTask(path, 'research', 't3', 'cancelled', { taskId: 'task-2', evidence: 'Stopped.' }), /immutable/);
  assert.throws(() => p.recordTask(path, 'research', 't3', 'cancelled', { status: 'cancelled' }), /evidence/);
  p.recordTask(path, 'research', 't3', 'cancelled', { status: 'cancelled', evidence: 'task_cancel confirmed cancellation.' });
  assert.throws(() => p.recordTask(path, 'research', 't3', 'running', { status: 'running' }), /transition/);
});
test('Orca completion requires task, run, dispatch and evidence', t => {
  const path = join(sandbox(t), 'run.json');
  p.beginRun(path, 'orca'); p.prepareTask(path, 'work', open, '/brief.md', 'path:/isolated');
  assert.throws(() => p.recordTask(path, 'work', 'orca', 'accepted', { taskId: 't' }), /Dispatch/);
  p.recordTask(path, 'work', 'orca', 'accepted', { taskId: 't', runId: 'r', dispatchId: 'd' });
  p.recordTask(path, 'work', 'orca', 'completed', { evidence: 'Accepted worker_done from active Dispatch d with outcome succeeded.' });
  assert.equal(JSON.parse(readFileSync(path)).tasks.work.dispatchId, 'd');
});
test('CLI can run entirely in a temporary configuration root', t => {
  const root = sandbox(t);
  const script = new URL('../scripts/0xstack.mjs', import.meta.url);
  const output = execFileSync(process.execPath, [script.pathname, 'show', '--root', root], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(output), { preference: null, t3: null, orca: null });
});

test('native instruction bodies remain identical after removing additive routing sections', async () => {
  const { createHash } = await import('node:crypto');
  const hashes = JSON.parse(readFileSync(new URL('./native-baseline.json', import.meta.url)));
  for (const [path, expected] of Object.entries(hashes)) {
    const text = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
    const restored = text
      .replace(/\n## Orchestration backend\n[\s\S]*?instead of silently running native\.\n/, '')
      .replace(/\n## Select the configuration backend\n[\s\S]*?falls back to editing native settings\.\n/, '');
    assert.equal(createHash('sha256').update(restored).digest('hex'), expected, path);
  }
});

test('malformed discovery flags cannot select a backend', () => {
  for (const input of [{ t3: 'false' }, { orca: 1 }, { t3: null }]) assert.throws(() => p.selectBackend(input), /boolean/);
});
test('T3 catalog excludes providers forbidden to run cross-provider children', () => {
  const capabilities = { parentThreadId: 'p', inheritedProviderInstanceId: 'codex', features: { appOwnedSubagents: true }, providers: [
    { providerInstanceId: 'codex', canRunChildTask: true, canRunCrossProviderChildTask: false, models: [{ id: 'own' }] },
    { providerInstanceId: 'restricted', canRunChildTask: true, canRunCrossProviderChildTask: false, models: [{ id: 'other' }] },
  ] };
  assert.deepEqual(p.t3Catalog(capabilities).map(t => t.model), ['own']);
});
test('reserved task keys cannot bypass durable duplicate prevention', t => {
  const path = join(sandbox(t), 'run.json'); p.beginRun(path, 't3');
  assert.throws(() => p.prepareTask(path, '__proto__', claude, '/brief', 'shared'));
  assert.deepEqual(JSON.parse(readFileSync(path)).tasks, {});
});
test('status updates preserve accepted launch receipts', t => {
  const path = join(sandbox(t), 'run.json'); p.beginRun(path, 't3');
  p.prepareTask(path, 'task', claude, '/brief', 'worktree');
  p.recordTask(path, 'task', 't3', 'accepted', { taskId: 't', effectiveModel: 'actual', worktreePath: '/actual' });
  const updated = p.recordTask(path, 'task', 't3', 'running', { taskId: 't', status: 'running' });
  assert.equal(updated.receipts[0].receipt.worktreePath, '/actual');
  assert.equal(updated.receipts[0].receipt.effectiveModel, 'actual');
});

test('malformed configuration and concurrent writes cannot corrupt a saved backend', t => {
  const root = sandbox(t);
  const path = p.saveConfig(root, 't3', config('t3'), catalog);
  const original = readFileSync(path, 'utf8');
  mkdirSync(path + '.lock');
  assert.throws(() => p.saveConfig(root, 't3', config('t3'), catalog), /Another writer/);
  assert.equal(readFileSync(path, 'utf8'), original);
  rmSync(path + '.lock', { recursive: true });
  assert.throws(() => p.decode('# broken\n```json\n{invalid}\n```'));
  assert.throws(() => p.decode(p.encode(config('t3')) + p.encode(config('orca'))), /exactly one/);
  assert.equal(readFileSync(path, 'utf8'), original);
});
test('confirmed runtime failure retains original ownership and evidence', t => {
  const path = join(sandbox(t), 'run.json'); p.beginRun(path, 't3');
  p.prepareTask(path, 'failed-attempt', open, '/brief', 'shared');
  p.recordTask(path, 'failed-attempt', 't3', 'accepted', { taskId: 'failed-task' });
  const failed = p.recordTask(path, 'failed-attempt', 't3', 'failed', { evidence: 'Backend reports provider authentication failure.' });
  assert.equal(failed.taskId, 'failed-task');
  assert.throws(() => p.recordTask(path, 'failed-attempt', 't3', 'accepted', { taskId: 'replacement' }));
  p.prepareTask(path, 'retry-after-confirmed-failure', claude, '/new-brief', 'shared');
  assert.equal(JSON.parse(readFileSync(path)).tasks['failed-attempt'].state, 'failed');
});


test('Orca operations retain distinct local identities and observed Run ownership', t => {
  const path = join(sandbox(t), 'run.json');
  const run = p.beginRun(path, 'orca');
  const prepared = p.prepareTask(path, 'work', open, '/brief', 'path:/isolated');
  assert.equal(new Set([run.runCreateOperationId, prepared.taskCreateOperationId, prepared.requestId]).size, 3);
  p.bindRun(path, 'orca', { runId: 'run-original' });
  assert.throws(() => p.bindRun(path, 'orca', { runId: 'run-other' }), /immutable/);
  assert.throws(() => p.recordTask(path, 'work', 'orca', 'prepared', { runId: 'run-other', taskId: 'task-original' }), /different Orca Run/);
  p.recordTask(path, 'work', 'orca', 'prepared', { runId: 'run-original', taskId: 'task-original' });
  const restarted = p.beginRun(path, 'orca');
  assert.equal(restarted.runCreateOperationId, run.runCreateOperationId);
  assert.equal(restarted.tasks.work.taskCreateOperationId, prepared.taskCreateOperationId);
});


test('Orca initial launch does not invent a recovery request token', () => {
 const input = { requestId: 'local-operation', runId: 'run-1' };
 assert.equal(p.orcaArguments(open, 'task-1', input).includes('--retry-request'), false);
 const recovered = p.orcaArguments(open, 'task-1', { ...input, retryRequestId: 'observed-runtime-request' });
 assert.equal(recovered[recovered.indexOf('--retry-request') + 1], 'observed-runtime-request');
});


test('Orca external coordination carries the explicitly observed handle', () => {
 const args = p.orcaArguments(open, 'task-1', { requestId: 'local-op', runId: 'run-1', coordinator: 'term-observed' });
 assert.equal(args[args.indexOf('--from') + 1], 'term-observed');
 assert.throws(() => p.orcaArguments(open, 'task-1', { requestId: 'local-op', runId: 'run-1', coordinator: '' }));
});


test('Orca detection reads the workspace envelope observed in the live runtime', () => {
 const status = { ok: true, result: { runtime: { state: 'ready', reachable: true } } };
 const current = { ok: true, result: { worktree: { id: 'repo::/workspace/0xstack', path: '/workspace/0xstack' } } };
 assert.equal(p.detectOrca(status, current, '/workspace/0xstack'), true);
 assert.equal(p.detectOrca(status, current, '/workspace/0xstack-other'), false);
 assert.equal(p.detectOrca(status, { ok: false, error: { code: 'selector_not_found' } }, '/workspace/0xstack'), false);
});
