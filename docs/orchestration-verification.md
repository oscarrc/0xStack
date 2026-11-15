# Orchestration verification

Verification performed on 2026-11-13 against upstream base `97de40dcca2fa396124c3e70a1d8cc28005f60a3`. Host runtimes were Node 22.21.0, Bun 1.3.14, and Orca CLI 1.4.241.

## Automated checks

- `node --test skills/0xstack-orchestration/test/*.test.mjs` passes all 31 tests. Catalogs, provider failures, configuration roots, request construction, and lifecycle records use fixtures or temporary directories.
- `bun test watch-pr check-plan.test.ts` in `skills/poteto-mode/scripts` passes all 61 tests.
- Native compatibility hashes confirm that removing the additive routing sections restores all ten original skill instruction bodies exactly. This preserves the source instructions for Codex, Claude Code, OpenCode, and Cursor. It does not prove runtime behavior in each host.
- JavaScript syntax, local links in new documentation, and diff whitespace checks pass.
- Development and tests did not modify installed skills or user model configurations. No commits or pushes were made.

## Live T3 checks

A Codex parent successfully delegated a read-only source inspection to both of these targets and collected terminal results:

- Provider `claudeAgent`, model `claude-opus-5-5`, option `effort=medium`.
- Provider `opencode`, model `opencode/beam-free`, option `variant=medium`.

Both workers identified the 17 roles, auto default, and writer-isolation request behavior from the actual helper. Backend results reported completed work with no pending descendants. Private run records retain task identities, selected options, and receipts.

These were sequential read-only smoke tests. Actual parallel worker execution, isolated code writing, live cancellation, authentication failure, and restart recovery were not exercised. Offline tests cover request construction and ownership rules, not those runtime outcomes.

## Live Orca checks

The runtime was initially stopped. After the user opened Orca, CLI 1.4.241 reported a reachable ready runtime with structured orchestration available. The coordinator ran from T3 Code through the CLI. 0xStack was registered with Orca, and three separate worktrees were created for test markers. User model configurations and installed skills were unchanged.

Run `run_561930e90696` completed these supervised smoke tasks:

- Codex used `gpt-6.1-sol` with medium effort. Task `task_3ceae4e2c74f`, Dispatch `ctx_8b3aa7684e70`.
- Claude used `opus` with medium effort. Task `task_a476dbc65c40`, Dispatch `ctx_fcef380a0c6c`.
- OpenCode used `opencode/beam-free` without an effort override. Task `task_d8d1280cca1d`, Dispatch `ctx_e7f83cb5d571`.

Launch receipts confirmed requested and effective settings. Each worker independently wrote and read a marker in its own checkout. The coordinator also read all three markers and checked provider, 17 roles, auto mode, unique cwd, and base revision. Each accepted worker_done matched its expected Task and Dispatch. The workers ran concurrently in separate worktrees. Codex's blocking ask received a coordinator reply before it wrote its marker.

The settled Codex terminal was reused for an intentional cancellation probe. Task `task_6cf1587a2fe0`, Dispatch `ctx_f4bba7872ddb`, reached a blocking question. `worker-stop` confirmed process closure, and Task state was recorded as failed with result cancelled. Worker release completed. Claude and OpenCode worker release also closed their owned terminals and captured output archives. The final reclaimable-worker query returned no workers. The original Codex Dispatch transferred terminal ownership to the cancellation Dispatch, which then stopped that terminal.

Request recovery was verified by querying the original Codex launch request. The runtime returned its completed receipt and original Dispatch instead of creating work. Run rebinding through an explicit coordinator handle was verified. No application restart, transport-loss injection, remote-host execution, authentication failure, or circuit-breaker scenario was tested.

External CLI calls initially inferred an active terminal belonging to a different workspace. Before launching workers, the test Run was rebound to a dedicated 0xStack coordinator terminal. The execution reference and argument builder now support explicit coordinator handles, with a regression test. The dedicated coordinator terminal was closed after completion accounting. Test worktrees and private receipts were retained as evidence.

## Existing statechart failures

The broader statechart suite does not pass in this environment:

- The absolute-and-relative-symlink launcher test fails with `undefined !== ''`. The same failure reproduces from an untouched HEAD archive.
- `test/differential.test.ts` fails to load because the existing development dependency `fast-check` is not installed.

No files under `skills/statechart` changed. These failures were left outside the orchestration change. The optional live TLC checks also require the existing `TLA2TOOLS` setup.

## Remaining runtime verification

Before describing all backends as fully live-verified, run isolated writer and cancellation scenarios inside a registered T3 repository, test Orca runtime restart and communication-loss recovery, and execute native-host scenarios in Codex, Claude Code, and OpenCode. Keep the recorded backend owner during outages and preserve uncertain attempts instead of resubmitting them.
