---
name: 0xstack-orchestration
description: Selects native, T3 Code, or Orca orchestration and resolves backend-specific 0xStack model roles. Use before 0xStack delegates, monitors, cancels, recovers workers, or configures orchestration models.
---

# 0xStack orchestration

0xStack chooses the work, roles, panels, and acceptance criteria. The selected backend executes that work. Higher-priority host tool restrictions still apply.

## Resolve once

1. Reuse the current task's saved backend and task records when resuming. Status, result retrieval, and cancellation always use the recorded owner. A disconnected backend remains the owner.
2. For new work, honor the user's explicit `native`, `t3`, `orca`, or `auto` selection. Otherwise read `~/.config/0xstack/orchestration.md`. Its absent-file default is `auto`. A corrupt file is an error to report, not permission to overwrite it.
3. `native` immediately uses the original calling skill's harness mappings, model files, role defaults, effort rules, and fallback behavior. Backend helpers and Node are unnecessary in this branch. Installed T3 or Orca executables have no effect.
4. For `t3`, or to probe T3 in `auto`, discover `orchestrator_capabilities` among the available MCP tools. Call it once per thread before delegation. Reuse that discovery unless an error or provider change requires refresh. Require an active parent thread, `features.appOwnedSubagents`, and a runnable provider. Tool visibility or a `t3` executable alone is insufficient. Read [the T3 reference](references/t3.md) when T3 qualifies or reports an error.
5. For `orca`, or to probe Orca in `auto`, run `orca status --json` and `orca worktree current --json`. Parse the JSON envelope even when exit status is zero. Require a reachable runtime and workspace identity that matches the current repository or worktree, using the installed CLI's inspection commands and canonical paths. An executable alone is insufficient. Explicit Orca may use an explicitly identified reachable runtime and repository without automatic workspace detection. Read [the Orca reference](references/orca.md) before declaring it usable. If orchestration is disabled, report the limitation.
6. In `auto`, use the sole usable backend, or native when neither qualifies. If both qualify, use the saved preference when present. Otherwise ask the user. An unavailable saved preference in auto does not force an unavailable backend. An explicit `t3` or `orca` that is unusable is an error with its discovery reason, never a native fallback.
7. Announce and record the selected backend before dispatch. Keep it fixed for the task. To change backends, first account for every existing worker and start separately scoped work with new records. Never reassign an uncertain launch.

## Resolve models

For native, return to the calling skill's original model instructions unchanged. For T3 and Orca, read only `~/.config/0xstack/backends/<backend>.md`. These assignments take precedence over native model rules already loaded by the host. The calling skill's native model fallbacks apply only to native.

Read [configuration and helper usage](references/configuration.md). Keep every existing role label, ordered panel seat, cross-judge family exclusion, and `auto` or `inherit-parent` alias. The backend's `auto` role alias means the parent target, independent of backend selection mode. Verify the parent's provider and model on that backend before resolving an alias. If unavailable, request an explicit target. Never infer a cross-provider equivalent.

Missing files or role assignments require setup for that backend. Show unavailable selections and valid alternatives without modifying the saved configuration. A refused launch never justifies another provider or default model. Confirm a replacement before saving it.

Preserve the calling skill's effort and speed policy within the selected model family. Use discovered option names and allowed values instead of parsing Cursor suffixes. Map budgets to `max`, `xhigh`, `high`, or `medium`. Choose a supported level at or below the requested level in the same model. If none exists, or the model has no effort control, report this and request a choice. Aliases retain the verified parent target. Verification workers retain their configured speed. Do not invent a fast option when the backend lacks one.

## Dispatch and recover

Use `scripts/0xstack.mjs` with Node 18 or newer for configuration validation and durable records. It performs no backend calls and never reads or writes native model files. If Node is missing, report that requirement for T3 and Orca instead of claiming records were saved.

1. Save a self-contained brief before launch. Include the original task and later directives, exact scope and ownership, acceptance criteria, verification commands, repository path and base revision, required uncommitted changes, and the selected backend and role. Include the absolute installed `poteto-mode/SKILL.md` path for poteto workers. Include the applicable skill prompt and required principles, or attach their content when the worker cannot access those paths. A new child receives no presumed parent history, MCP access, credentials, or active skills. Grant only the task's authorized actions.
2. Give independent writers separate backend-managed worktrees. Read-only workers may share the checkout only when their brief prohibits writes. Preserve the calling skill's candidate output locations, cloud constraints, and exact review revision. Transfer required uncommitted changes explicitly before reviewing. If required local state or tools cannot reach an isolated worker, report the gap before launch.
3. Create a unique run record outside tracked source, such as a private temporary directory. Call `begin` once and `prepare` for each logical task before calling its backend. Save the request ID, target, brief path, and placement. Only the coordinator writes its own record. Nested coordinators use separate files and report their IDs upstream.
4. Launch through the selected reference. Record returned task identifiers and receipts immediately with `record`. Record `unknown` on a lost response. An existing task key prevents accidental duplicate preparation. A timeout means uncertainty unless the backend provides terminal failure evidence.
5. Recover by the original backend's request and task IDs. Follow its wait and notification contract. Process questions and escalations without treating them as completion. A cancellation request is not confirmed cancellation. Record terminal outcomes only from backend evidence, then inspect the resulting diff or artifact and run the task's verification.
6. For a justified retry after confirmed failure, preserve the original attempt and create a new attempt key. Follow backend retry lineage. Never launch a replacement while the original may still be writing. On restart, reconcile saved records with the original backend before any new dispatch. Keep receipts free of credentials.

Native tasks continue using their existing harness lifecycle. This record protocol adds ownership tracking for T3 and Orca without replacing native delegation.
