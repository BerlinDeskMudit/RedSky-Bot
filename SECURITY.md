# Security Policy

## Threat model, in one paragraph

Red Sky launches a locally installed OpenCode server and gives the agents it runs file and shell access inside
a single sandboxed workspace directory. It has no backend, no accounts, and no telemetry, and it binds nothing
to a public interface. The workspace is the security boundary. Auto Review and the destructive-command filter
are safety nets that sit in front of an agent that is, by design, allowed to run commands — they are **not** a
sandbox and should not be relied on as one.

## Supported versions

Fixes land on `main` and are released in the latest minor version. Older versions are not patched.

| Version | Supported |
| --- | --- |
| `main` (unreleased) | ✅ |
| 0.2.x | ✅ |
| < 0.2 | ❌ |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository:
**[Report a vulnerability](https://github.com/BerlinDeskMudit/RedSky-Bot/security/advisories/new)**.

If you cannot use that channel, open a minimal public issue that says only *"security report — please contact
me"* and wait for a maintainer to reach out. Do not include reproduction details, payloads, or affected
paths in a public thread.

Please include, as far as you can:

- A clear description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- The version (or commit) and platform you tested on.
- Whether it requires a specific configuration, connector state, or user action.
- Any suggested fix or mitigation.

## What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement | 72 hours |
| Initial assessment (severity + whether it is in scope) | 7 days |
| Fix or documented mitigation | Depends on severity; you will get a timeline in the assessment |

This is a maintained-as-a-side-project with one maintainer, so those are honest best-effort targets rather than
contractual SLAs. We will credit you in the advisory and the release notes unless you ask us not to.

## In scope

- Escape from the workspace sandbox — path traversal, symlink games, or shell escapes that reach outside
  `userData/workspace`.
- Bypass of the preload allow-list, the IPC surface, or `contextIsolation`, letting renderer content reach
  Node, Electron internals, or the filesystem.
- Prompt-injection or policy bypass paths that cause an outbound, destructive, or spending action to execute
  without the approval Auto Review is supposed to require.
- Exfiltration of secrets or personal data into logs, drafts, notices, or the activity feed despite privacy
  mode being enabled.
- Remote code execution, or command injection through a value the app interpolates.
- Supply-chain issues in code shipped in this repository (dependency confusion, malicious install scripts).
- Exposure of the OpenCode server beyond loopback.

## Out of scope

- **Anything in OpenCode itself.** Report it to the [OpenCode project](https://github.com/sst/opencode). If the
  bug is in how Red Sky invokes or trusts OpenCode, that part *is* in scope — please say which.
- **An agent doing something wrong with capabilities you granted it.** Asking an agent to modify a file, then
  being unhappy that it modified the file, is expected behavior. Auto Review exists to slow that down; it is
  not a guarantee.
- **Local denial of service on your own machine**, including resource exhaustion from an agent you invoked.
- **Unsigned-build warnings.** SmartScreen and macOS Gatekeeper prompts on a developer build are documented
  behavior — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#packaging-and-os-warnings).
- **Anything requiring an attacker who already has code execution or filesystem access on your machine**, or
  physical access to it.
- **Findings from an automated scanner with no demonstrated impact.**

## If you are running Red Sky

- Keep the workspace directory free of credentials you would not hand to a shell.
- Leave Auto Review on `sensitive` (the default) and privacy mode on, at least until you trust the workflows
  you have set up.
- Read the activity feed after a run you did not watch. It lists every tool call, file touch, and shell
  command the agent made.
- Treat connector status as intent, not access. Marking Gmail "connected" changes what the agent is told, not
  what it can reach.
