# Orca IDE execution

Read `orca --version`, `orca status --json`, and `orca skills get orchestration --full`. Use that installed contract and relevant command help, not memorized commands. This reference was checked with CLI 1.4.241. Older or newer runtimes can differ.

## Discover the runtime and targets

Parse the `ok`, `error`, and `result` envelope. A successful CLI exit alone proves nothing. Inspect `orca worktree current --json` and version-supported repository, worktree, agent, and host inspection commands. Match the runtime's repository and worktree to the current canonical path. Explicit mode may use an identified reachable runtime with an explicit repository selector even when current-worktree inference fails.

Check structured orchestration availability with installed runtime inspection and non-mutating orchestration queries, such as `orca orchestration run-current --json`. Distinguish an unbound Run from a disabled feature. Public docs identify orchestration as experimental and warn that its settings panel can be unavailable. A CLI help page does not prove runtime enablement. Report disabled or unsupported structured orchestration. Use a simpler launch only if the installed documentation provides equivalent completion tracking for this task. Otherwise stop rather than losing supervision.

Use execution-host agent discovery and provider CLI model catalogs where available. Do not claim exhaustive model discovery from a static list. Validate agent IDs, opaque model IDs, and effort controls using installed help and provider capabilities. Record the evidence behind the normalized catalog used by setup.

In 1.4.241, `worker-start --model` supports documented agents including Claude, Codex, Cursor, Antigravity, Muse, and OpenCode. OMP accepts model only. Other agents can lack explicit model overrides. Report that limitation rather than claiming the configured role was honored. `--effort` requires `--model` and model-specific support. OpenCode effort overrides are unsupported. OpenCode model overrides require an existing worktree, a verified execution-host CLI, and an available model.

## Bind coordinator context

An external CLI can infer the currently active Orca terminal even when its workspace differs from the shell's working directory. Before Run creation, inspect the caller and workspace context. From outside an Orca terminal, create a dedicated coordinator terminal in an explicitly selected 0xStack workspace with the installed `terminal create` command. Save its returned handle. Pass `--from <coordinator_handle>` to Run creation and coordinator mutations, and `--terminal <coordinator_handle>` to `check`. Pass explicit Run and worktree selectors as well. Never assume shell cwd alone selects the coordinator. On recovery, `run-use --id <run_id> --from <coordinator_handle>` binds the saved Run under the installed contract.

## Launch a supervised wave

1. Save the self-contained 0xStack brief and create a run record. Preserve a distinct local operation record before every mutation, including Run and Task creation. Capture each CLI command’s stdout and stderr in separate private files so observed runtime request IDs survive a lost parent response. Local operation IDs are not Orca request IDs. Installed help reserves `--retry-request` for exact recovery. Use it only with an observed runtime request ID, not a new 0xStack UUID.
2. `orca orchestration run-create --objective <objective> --json` creates and binds the Run. Save its returned ID with the helper’s `bind` command. Prepare each logical task before Task creation so its local operation identities survive interruption. Use `task-create --spec <brief> --task-title <title> --json` for each planned task. Preserve each Task ID with `record` in the `prepared` state. Dependencies express actual ordering only.
3. Launch with `orca orchestration worker-start --run <run_id> --task <task_id> --worktree <placement> --agent <agent_id> --model <model_id> --json`. Add `--effort` only if supported. Use `new-child` or `new-top-level` for independent writers. Read the installed placement rules for remote workers.
4. For an OpenCode writer, create a separate worktree using version-matched worktree commands first. Preserve its returned selector. Pass that existing selector to `worker-start`, then validate its model on the execution host. Do not send `--effort`. Never run independent OpenCode writers in the coordinator's checkout to evade the existing-worktree requirement.
5. Save the returned Run, Task, Dispatch, worker, placement, launch-requested, and launch-effective information. Verify effective settings match the approved role. If not, report the launch discrepancy and reconcile the worker before any replacement.
6. A nonzero worker-start exit can leave resources or accepted input behind. Inspect `failedStage`, `residualResources`, and supplied recovery commands. Record `unknown` when readiness or submit is uncertain. Load the installed recovery-and-cleanup reference before taking further lifecycle action.

A worker brief includes the 0xStack instructions and acceptance criteria, then follows Orca's injected lifecycle preamble. Preserve its exact executable, handles, Task ID, and Dispatch ID. The worker checks coordinator mail at natural checkpoints and reports exactly one `worker_done` with explicit succeeded or failed outcome. Its own question uses Orca ask so the coordinator can answer. Worker completion does not authorize new work.

## Collect, recover, and release

Use `orca orchestration check --wait --types worker_done,escalation,question --timeout-ms <supported-timeout> --json`. Use bounded waits compatible with the host's turn rules. Process every message in a delivery before acknowledging its delivery ID. Reply with `reply --id <message_id> --body <answer>`. Resume an unanswered ask by its existing message ID.

Accept completion only from the expected active Dispatch with a matching Task ID and explicit outcome. A heartbeat, idle terminal, timeout, or empty inbox is not completion. Save the evidence and inspect the artifact. Handle failures and escalations explicitly. Record cancellation through the installed stop or abandon workflow, then the documented failed-task result. Cancellation is not worker release.

On communication loss, read the captured CLI error or receipt for its `orchestrationRequestId`. If no runtime ID or Dispatch can be recovered, preserve unknown state and reconcile affected resources without replay. When a runtime request ID is known, inspect `request-show --request <request_id> --json`. A completed request returns its receipt. A pending request uses the same command and `--retry-request` identity under the installed contract. An absent receipt is not proof that nothing happened. Inspect Task, Dispatch, and worker state before replay.

On restart, recover the existing Run with `run-use`, enumerate tasks and workers, and reconcile saved IDs. Use `worker-show`, `worker-read`, and `worker-list --include-remote` with returned cursors. Follow literal recovery actions in receipts. `unverifiable` means uncertainty. Only positive evidence of exit authorizes failure recovery or replacement. A justified retry uses the same Task and `--retry-of <dispatch_id>` with explicit placement. Respect the runtime's circuit breaker.

For cancellation, load the installed recovery contract and use `worker-stop --dispatch <dispatch_id>` or an explicitly justified `worker-abandon`. Abandon fences ownership without proving the process stopped. Preserve that distinction in the record. Never start a conflicting editor while a process may remain live.

After accepted settlement, release the owned worker with `worker-release --dispatch <dispatch_id>`, retain it only at the user's request, or explicitly reuse it for a documented follow-up Dispatch. Release is post-settlement resource cleanup. Preserve worktrees and partial work. Account for every worker before finishing. Do not close terminals as a substitute for lifecycle commands.

Retired commands include `orchestration run`, `run-stop`, `coordinator-start`, and `coordinator-stop`. Use Run, Task, and worker-start commands instead.

Sources:

- https://github.com/stablyai/orca
- https://orca.dev/docs/cli/orchestration
- Installed `orca skills get orchestration --full` and `orca orchestration worker-start --help`.
