# Systems Audit — status

*The living view of the audit. The plan and the owner's rulings:
[concept_systems_audit.md](../concept_systems_audit.md). Sessions start with
`/auditor`.*

## Start gate

**Not open.** The audit starts once the outstanding briefs in the
[briefs order table](../briefs/README.md) are built and merged. Then the
director makes one desktop test build of `main` (QA panel included), tags
that commit **`audit-build`**, gives the owner the build, and changes this
line to "Open (tag `audit-build`, <hash>, <date>)".

## Sessions

| Session | System | Group | State | Tickets | Concept docs | Notes |
|---|---|---|---|---|---|---|
| S0 | Cross-system sweep | — | waiting on the gate | | | |

The system sessions (A1 to A36, listed in [SYSTEMS.md](SYSTEMS.md)) and their
groups are added once the owner approves S0's proposal.

## Groups

None yet. A group is **ready to brief** once all its systems are done; the
planning agent then briefs its tickets together.
