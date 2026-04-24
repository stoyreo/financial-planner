# Editing Guidelines for Claude

## Editing TypeScript source — avoid shell-escape artifacts

Never write or modify `.ts`/`.tsx` source via bash heredocs, `sed`, `echo >`, or any shell-redirection pipeline. These routes can escape `!` to `\!` (bash history expansion), `$` to `\$`, and similar — producing invalid TS that SWC rejects with "Expected unicode escape".

Always use direct file editor tools (Write/Edit). If a shell route is truly unavoidable, disable history expansion (`set +H`) and audit the output.

A pre-build check (`scripts/check-shell-escapes.mjs`, wired into `prebuild`) scans for the `\!` artifact and fails the build if it reappears. Do not bypass this check — fix the source instead.
