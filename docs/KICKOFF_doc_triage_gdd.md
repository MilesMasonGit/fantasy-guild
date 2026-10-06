# Kickoff — Doc Triage + GDD Rewrite (Gemini)

Paste the prompt below into a fresh Gemini session.

---

> I'm starting the prep work for a crunch month on this game. You're handling
> the documentation side: **a doc triage first, then a fresh GDD**. No source
> code changes in this work.
>
> **Get oriented first:**
>
> 1. Read `CLAUDE.md` — it's written for Claude, but the "How to work with me"
>    rules apply to you too. Most importantly: I don't code, so explain things
>    plainly, and when you need a decision from me, give me multiple-choice
>    options with trade-offs and your recommendation first.
> 2. Read `crunch_prep_plan.md` — the overall plan. You're doing steps
>    **P1 (Doc triage)** and **P2 (GDD rewrite)**. Follow the rules in §4 for
>    both.
> 3. Read `docs/archive/README.md` — it explains what's already been archived
>    and why. This project has been misled by stale docs several times; that's
>    the problem we're fixing.
>
> **Part 1 — Doc triage:**
>
> - Go through every `.md` file in the repo root, `docs/`, `agent_briefs/` and
>   `.agent/` (guides, workflows, skills). Skip `node_modules/`, `archive/`
>   and `docs/archive/`.
> - For each one, decide: **Current / Reference / Historical / Dead /
>   Uncertain**, with a one-line reason. Check claims against the code when a
>   doc's status isn't obvious — don't judge on the title alone.
> - Write the result as `doc_triage_report.md` in the repo root: a table
>   grouped by category, with your proposed action for each (keep / move to
>   archive / needs review). Put the Uncertain ones at the top.
> - **Then stop and show me the report. Don't move anything yet.** Once I've
>   approved it, move the approved files into the archive (never delete),
>   add them to `docs/archive/README.md`, and fix any links that the moves
>   break.
>
> **Part 2 — GDD rewrite** (only after Part 1 is approved and done):
>
> - Before writing, send me a proposed **outline** of section headings, plus
>   the list of source docs you plan to draw from. Wait for my OK.
> - Write `GDD.md` in the repo root, from scratch, describing the game **as it
>   is built today**. Check it against the code and the current docs. Mark
>   anything planned but not built (e.g. the Atlas) clearly as **Planned**.
> - Keep it lean: summarize and link to the detailed docs instead of copying
>   them. Aim for under ~40 KB.
> - Include an empty **Performance Envelope** section and a short **Glossary**
>   of current terms.
> - **Don't invent or guess.** Wherever sources disagree or the code doesn't
>   match the docs, put it in an **Open Questions** list at the end for me
>   to answer.
> - Also copy the Atlas spec into the repo as `atlas_concept.md`. It currently
>   lives at
>   `C:\Users\16048\.gemini\antigravity-ide\brain\b6f8d4d8-8826-42e5-9759-22c42e559a95\atlas_system_specification.md`.
>
> When the GDD draft is done, update the P1/P2 rows in
> `crunch_prep_plan.md`'s Implementation Status table, then stop and tell me.
> The draft will get a review pass from Claude before it's final.
