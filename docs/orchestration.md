# Use 0xStack with native tools, T3 Code, or Orca

0xStack's skills and playbooks choose work and verification. The orchestration backend chooses how workers run. Native remains available in every supported harness, including Cursor, Claude Code, Codex, OpenCode, and the original sequential fallback for hosts without subagents.

## Install and migrate safely

Keep the original installation instructions in the README. When selecting skills, include `0xstack-orchestration` with skills that delegate. It contains the shared instructions and helpers. No global agent installation or model file migration is required.

Existing native configuration stays in its original location and format:

- Cursor uses `~/.cursor/rules/pstack-models.mdc`.
- Claude Code uses `~/.claude/rules/pstack-models.md`, with the existing legacy fallback.
- Other hosts use `~/.agents/pstack-models.md`.

Native execution requires no new helper runtime. T3 and Orca helpers require Node 18 or newer. Backend settings live separately in `~/.config/0xstack/backends/t3.md` and `~/.config/0xstack/backends/orca.md`. Configure a new backend without deleting your native settings. To return to native, select it explicitly. The native files remain usable unchanged.

If you install only a standalone skill without the companion, its native behavior remains available. Explicit nonnative execution reports the missing companion.

## Choose a backend

Use these prompts in your coding agent:

```text
/poteto-mode use auto orchestration for this task
/poteto-mode use native orchestration for this task
/poteto-mode use t3 orchestration for this task
/poteto-mode use orca orchestration for this task
```

An explicit task selection overrides saved mode. Otherwise `~/.config/0xstack/orchestration.md` provides the mode and optional preference. No file means auto.

Auto requires callable T3 orchestration capabilities in an active T3 parent, or a reachable Orca runtime with a verified current workspace and usable orchestration. Installed executables alone do not qualify. If one qualifies, use it. If neither qualifies, use native. When both qualify, honor a saved preference or ask. The selected backend remains fixed for that task, including during outages.

Explicit T3 or Orca mode fails clearly when unavailable. It never silently launches native replacements. A saved auto preference is a tie-breaker among usable backends. To require that backend, save an explicit mode instead.

## Configure models independently

Use these setup requests:

```text
/setup-pstack
/setup-pstack native
/setup-pstack t3
/setup-pstack orca
/setup-pstack show model configurations for every backend
/setup-pstack change only the T3 how explorer assignment
/setup-pstack change Orca's reasoning budget to medium
/setup-pstack reset only the Orca model configuration
/setup-pstack save native as my orchestration mode
/setup-pstack save auto mode with a preference for T3
```

These are agent instructions, not shell commands. Plugin hosts may prefix slash commands, such as `/pstack:setup-pstack` in Claude Code.

Every backend keeps the existing 17 roles, ordered review panels, cross-judge pool, and budget policy. `auto` and `inherit-parent` role values keep their parent-target meaning. They are separate from auto backend selection. On T3 or Orca, the parent target must be discoverable on that backend.

Setup discovers execution targets, loads the selected backend's settings, proposes changes, and validates before writing. Reruns preserve role customizations. Missing backend settings request setup. Unavailable models or unsupported effort options are reported with alternatives where discovery permits. The saved assignment stays intact until you confirm its replacement.

Backend files contain a versioned JSON block inside Markdown. Exact fields, helper commands, and role semantics are documented in the [configuration reference](../skills/0xstack-orchestration/references/configuration.md). Helpers validate selections against a supplied observed catalog. They do not independently authenticate providers or discover remote models.

## Run inside T3 Code

Install and authenticate the desired providers through T3, then open the repository in a T3 thread. Configure 0xStack's T3 assignments with `/setup-pstack t3`.

0xStack discovers registered provider instances through `orchestrator_capabilities`. It supports runnable registered providers rather than a fixed Codex, Claude, and OpenCode allowlist. Model options come from each model's capability schema. Abbreviated catalogs require discovery searches before declaring a configured model unavailable.

Workers use explicit provider instances and model IDs. Independent writers use T3 worktree isolation. Their briefs carry the task, applicable 0xStack instructions, acceptance criteria, and verification requirements. Uncommitted parent changes require explicit transfer to isolated review workers.

T3's delegation tools require a parent running inside T3. An outside Codex or Claude MCP connection may expose those tools without permission to use them. 0xStack reports this restriction instead of substituting top-level threads. See [T3's outside-agent documentation](https://github.com/pingdotgg/t3code/blob/main/docs/user/outside-agents.md).

## Use Orca IDE from your coding host

Start the Orca runtime, open the repository, and confirm the CLI can reach that runtime. The coordinator can run in another host, including T3 Code, while workers execute through Orca. Use explicit workspace selectors and a dedicated Orca coordinator handle for external CLI calls. Shell cwd alone does not select the coordinator terminal. Structured orchestration must be available and enabled for your installed version. Configure `/setup-pstack orca` after discovery succeeds.

0xStack reads `orca skills get orchestration --full` and installed command help. It uses supervised Runs, Tasks, Dispatches, and workers. It processes completion messages, questions, and escalations before acknowledging deliveries. Independent code writers use separate worktrees.

Provider support depends on the installed Orca version and execution host. In the version examined for this integration, Claude and Codex support model overrides. OpenCode model overrides require an existing worktree and host validation, and effort overrides are unsupported. 0xStack creates an isolated worktree first for an OpenCode writer. Other agents are usable only when their documented launch controls can honor the requested assignment. 0xStack does not claim exhaustive model discovery.

Public Orca documentation describes orchestration as experimental and notes temporary settings-panel restrictions. Check runtime availability rather than relying on installed help. See [Orca orchestration documentation](https://orca.dev/docs/cli/orchestration).

## Recover or cancel work

The coordinator saves a private run record before dispatch and retains backend task identifiers and receipts. The original backend owns that task through completion, cancellation, and restart. Keep the record path with your resume note.

A timeout or communication loss does not prove the worker stopped. Recover using the saved request and task identifiers. Never launch another backend's replacement while the first attempt may still be running. Record unknown outcomes as unknown.

T3 workers use task cancellation and completion notifications. Orca workers use Dispatch lifecycle commands. Orca release cleans up a settled worker and is separate from cancellation. Preserve worktrees and partial work when cancelling. After an interrupted setup write, inspect a leftover lock before removing it.

## Troubleshoot

- Explicit backend unavailable. Read the discovery error. Check authentication, runtime reachability, tool permissions, and workspace identity. Select native explicitly only for separately scoped work with no unresolved workers.
- Both environments detected. Choose a backend or save an auto preference. 0xStack does not choose arbitrarily.
- Model missing. Expand T3's abbreviated catalog or check the provider CLI on Orca's execution host. Preserve the assignment until a replacement is confirmed.
- Effort rejected. Inspect model-specific options. A provider's `effort`, `reasoningEffort`, and `variant` fields are not interchangeable.
- Orca structured orchestration unavailable. Report the runtime limitation. A bare terminal launch is insufficient when completion tracking is required.
- Worker result missing. Recover the saved backend record. Idle output, stale status, and an empty inbox are not completion evidence.
- New backend selected but native model rules are loaded. Backend-specific assignments take precedence for delegation. Native mode continues using the original rules.

## Verify the implementation

Run the focused offline tests without touching user configuration:

```sh
node --test skills/0xstack-orchestration/test/*.test.mjs
```

These tests use mock catalogs, request builders, temporary configuration roots, and durable-record simulations. They cover selection, validation, isolation, and recovery logic. They do not prove provider authentication, actual worker execution, or agent compliance with Markdown instructions.

Live verification must separately record provider, selected model, backend task IDs, effective placement, terminal outcome, and evidence. Mark unavailable runtimes as untested. Native compatibility checks preserve the original instruction bodies; real native agent behavior still requires execution in the corresponding host.
