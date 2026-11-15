# Configuration and helpers

All paths below are user settings written only during an authorized setup operation. Development tests use temporary roots. Native files and their formats remain owned by the original setup flow.

## Backend files

Store one fenced JSON object in each Markdown file. Outside the block, human notes are allowed. T3 and Orca have separate files under `~/.config/0xstack/backends/`. Example shape with placeholder identifiers:

```json
{
  "version": 1,
  "backend": "t3",
  "budget": "large",
  "roles": {
    "feature, refactoring": [{"provider": "<instance-id>", "model": "<model-id>", "family": "<family>", "options": {"<effort-option>": "xhigh"}}],
    "arena runners": ["inherit-parent", "auto"],
    "arena cross-judge pool": [{"provider": "<other-instance>", "model": "<other-model>", "family": "<other-family>"}]
  }
}
```

Use discovered identifiers, never these placeholders. `family` identifies the model family for the existing panel diversity rules, independently of the provider executing it. Scalar roles are one-element arrays. Panel lists preserve every seat and their order. The full list of 17 role labels is exported as `roles` by `scripts/0xstack.mjs` and matches native setup. Sparse files are allowed, but a missing role requests setup instead of using native defaults.

The preference file `~/.config/0xstack/orchestration.md` has the same Markdown wrapper and this object:

```json
{"version": 1, "mode": "auto", "preference": "t3"}
```

Omit `preference` to ask when both environments qualify. `native`, `t3`, and `orca` are valid preferences. Mode defaults to auto when the file is absent. Validate a read preference before resolving it.

## Configure one backend

1. Resolve the requested setup backend, or ask which backend to configure when auto is ambiguous. `setup-pstack native` follows the original setup steps unchanged.
2. Show the selected backend's current configuration. Read other backends only to display them on request. Native viewing follows native paths, including Claude Code's legacy fallback.
3. Discover and validate models and options on the execution host. Build a catalog array with `{provider, model, options: [{id, values}]}`. This is an observation of supported choices, not a static list shipped by 0xStack. T3's `catalog` command normalizes a capability response. For Orca, use verified agent and model output and installed help. If discovery is incomplete, say so. Reject unsupported overrides instead of probing with a billable worker launch.
4. Preserve existing assignments, panel lists, aliases, and family choices on rerun. Ask for a budget using the original four labels. Apply its target effort per backend capability. Keep non-effort options. Show all roles, unresolved assignments, unsupported controls, and proposed changes before confirmation. An unchanged unavailable assignment remains on disk until its replacement is confirmed.
5. Save only the selected backend with `save` after validation. For a single-role edit, use `set-role` so other assignments survive. Reset only the backend the user selected with `reset`, after explaining that its assignments will require setup again. Reset never changes the orchestration preference or native files. Native reset remains a separately authorized native-file operation.

## Run the helper

Use the actual installed absolute script path in place of `<helper>`. Each command reads JSON from stdin and emits JSON. Use a file redirect for complex inputs. Node 18 or newer is required only for the new backend helpers.

```sh
node <helper> show
node <helper> save < confirmed-config-input.json
node <helper> set-role < confirmed-role-input.json
node <helper> select < discovery-input.json
```

For isolated development, append `--root <temporary-directory>`. The default root is `~/.config/0xstack`. Never run setup mutations against that default during development or tests.

| Command | Input |
| --- | --- |
| `show` | None. Displays preference, T3, and Orca files. Missing files are null. |
| `preference` | A confirmed preference object with version, mode, and optional preference. |
| `detect` | `t3` capability response, Orca `status`, `current`, `cwd`, and optional `verifiedWorkspacePath`. By default, the workspace path comes from the observed `result.worktree.path` schema. An explicit path comes from inspected runtime output, never a guess. This checks runtime and workspace evidence; separately verify Orca orchestration is enabled. |
| `select` | `mode`, optional `preference`, verified `t3` and `orca` booleans, optional `locked` backend. |
| `catalog` | The structured T3 capability response. Merge exact-search responses when catalogs are abbreviated. |
| `save` | `{backend, config, catalog}`. Writes only that backend after full validation. |
| `set-role` | `{backend, role, targets, catalog, budget?}`. Preserves other role assignments. |
| `reset` | `{backend}`. Removes only the selected backend model file. |
| `resolve` | `{config, role, catalog, parent?}`. Parent is a validated target when aliases occur. |
| `budget` | `{target, budget, catalog, effortOption}`. Returns a proposal without saving. |
| `t3-request` | `{target, task, requestId, writing?}`. Produces a schema-shaped delegation request. |
| `orca-args` | `{target, taskId, runId, requestId, worktree, retryRequestId?, coordinator?}`. Produces argv, not shell text. |
| `begin` | `{path, backend}`. Creates or reads a run with an immutable backend. |
| `bind` | `{path, backend, receipt}`. Saves the observed Orca `runId` without changing the run owner. |
| `prepare` | `{path, key, target, briefPath, placement}`. Saves one new attempt and returns its request ID. Keys start with a letter or digit and contain only letters, digits, dots, underscores, or hyphens. |
| `record` | `{path, key, backend, state, receipt}`. Saves backend identifiers and observed state. |

Pass generated argv as separate arguments, or shell-quote each value properly. JSON encoding is not shell escaping. Validate targets against current discovery before using request builders. 0xStack role labels belong in briefs, not T3's fixed `role` enum.

Record states are `prepared`, `accepted`, `running`, `waiting`, `unknown`, `cancel_requested`, `completed`, `failed`, and `cancelled`. A receipt stores backend output or explicit communication-loss evidence. Every update appends to receipt history so launch-effective settings and placement survive later status updates. Terminal receipts require an `evidence` string. For Orca, `begin` saves a local `runCreateOperationId`, and `prepare` saves separate local `taskCreateOperationId` and worker-launch `requestId` values. These are local correlation IDs, not Orca recovery tokens. Capture the CLI’s observed `orchestrationRequestId` and full receipt in private output files for each operation. Only pass that observed ID as `retryRequestId` during exact recovery. Bind the observed Run with `bind`. Record Task creation using state `prepared` before worker launch. Orca accepted work requires `taskId`, `runId`, and `dispatchId`. T3 accepted work requires `taskId`; preserve `childThreadId` and `environmentId` when returned. IDs cannot change within an attempt.

Writes use an exclusive per-file lock and atomic replacement. An interrupted write may leave a `.lock` directory. Inspect the writer and backend state before removing a stale lock. Configuration writes preserve other files. Replacing a file normalizes the Markdown wrapper; keep external notes elsewhere if they must survive setup.
