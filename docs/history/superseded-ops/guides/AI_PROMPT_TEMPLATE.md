<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# AI Prompt Template v2 — The Elevated Edition

> **How to get consistently better answers, with less back-and-forth.**
> v2 adds what v1 lacked: **standing instructions** (paste once, reuse forever),
> **three depth tiers**, a **response contract** the AI commits to, a **self-check**
> loop, and **one-word steering commands** to fix any answer fast.

---

## 🚦 How to Use — Three Tiers

| Tier | Use for | What you paste |
|---|---|---|
| **Quick** | Simple questions ("what does X mean?", "where is Y?") | Just ask naturally — no template needed |
| **Standard** | Most work queries | Standing Instructions (once) + 4–6 filled template lines |
| **Deep** | Design, debugging, research, writing tasks | Standing Instructions + full template + self-check |

---

## 📌 Standing Instructions — paste ONCE at the top of a conversation

These apply to *every* message after them, so you never re-type the context.

```
[STANDING INSTRUCTIONS — apply to all my queries in this chat]
- Repo context: SOVR — a spec-first financial protocol. YAML sources of truth in
  protocol/, compiler in compiler/, runtime in packages/, docs in docs/.
  Trust repo files over any summary you have; cite file paths when referring to
  repo content.
- Lead with the answer, not the journey. Explanation follows only if useful.
- Never invent facts, APIs, or file names. If unsure, say so and mark it [UNKNOWN].
- If a query is ambiguous or missing critical info, ask up to 2 clarifying
  questions before answering; otherwise state your assumptions explicitly.
- When I ask for changes, propose them first — don't modify files unless I say so.
- Always end with the single most useful next step.
```

---

## 🧩 The Full Template (Standard / Deep)

Copy and fill the sections you need. Optional sections are marked ⬜.

```
[ROLE & MINDSET]
Act as [expert role]. Approach this with [rigor / a beginner-friendly tone /
a skeptical reviewer's eye]. Call out my assumptions if they're wrong.

[GOAL]
I want to end this conversation having [one concrete outcome].

[CONTEXT PACK]
- What I'm working on: [topic]
- What I already know: [brief — so you don't re-explain]
- What I've already tried: [attempts + what happened]
- Relevant files/URLs: [paths — instantly focuses your search]

[TASK]
[Precise ask. Number it if it has multiple parts.]

[DEPTH] ⬜
[Quick — answer in ≤3 sentences / Standard — explain + example /
Deep — full analysis with 2–3 options and a recommendation]

[FORMAT CONTRACT] ⬜
- Structure: [TL;DR first / numbered steps / table / code + explanation]
- Length cap: [e.g. under 400 words / no cap — depth matters]
- Artifacts: [e.g. a YAML snippet / a diff / a markdown doc / a diagram]

[SUCCESS CRITERIA]
The response is good when: [write 2–3 checkable statements, e.g. "it explains why
the build failed, not just what the error says"].

[GUARDRAILS] ⬜
- Do / Don't: [e.g. don't edit files; do use repo conventions; don't propose
  new dependencies.]

[IF UNSURE] ⬜
If you're missing info: [ask me first / proceed with stated assumptions /
give a best guess labeled [UNKNOWN]].

[SELF-CHECK — Deep tier only]
Before you answer, verify against: [repo files / my success criteria / the exact
task wording]. If your draft fails any check, fix it before sending.
```

---

## ✍️ Filled Example (Deep tier, SOVR-flavored)

```
[ROLE & MINDSET]
Act as a SOVR protocol expert with a skeptical reviewer's eye. If my diagnosis
is wrong, tell me plainly.

[GOAL]
I want to end this conversation knowing exactly why the registry compilation
fails and what to change — or knowing it's a compiler bug.

[CONTEXT PACK]
- Working on: compiler validation stage; `npm run build` fails with
  "unresolved reference" in a domain file that looks correct to me.
- Already know: the registry was regenerated recently (last commit was
  "registry regenerated after the above fixes").
- Already tried: clean rebuild, checked the offending YAML by eye.
- Relevant files: protocol/domains/*.yaml, compiler/src/* (validation pass).

[TASK]
1. Find the root cause of the unresolved reference.
2. Give the minimal fix (or prove it's a compiler bug, with evidence).

[DEPTH]
Deep — full diagnosis with evidence, then the fix.

[FORMAT CONTRACT]
- Structure: root cause first (2–3 sentences), then evidence, then fix steps.
- Length cap: under 500 words.
- Artifacts: the exact YAML lines to change.

[SUCCESS CRITERIA]
The response is good when I can apply the fix and the registry compiles cleanly,
or when you've shown me the compiler bug with a minimal repro.

[GUARDRAILS]
- Don't modify files; show me the change and I'll apply it.
- Don't suggest restructuring the domain model to dodge the bug.

[SELF-CHECK]
Before answering: re-read the actual error output and the referenced YAML; make
sure the fix addresses the failing symbol, not a symptom.
```

---

## 🎮 Steering Commands — fix any answer in one word

Reply to my answer with any of these. No need to re-explain:

| Command | Effect |
|---|---|
| `DEEPER` | Expand the analysis — more depth, options, edge cases |
| `SHORTER` | Compress to the essentials, drop the padding |
| `SIMPLER` | Rewrite in plain language, no jargon |
| `TIGHTEN [topic]` | Drop everything except [topic] |
| `SWITCH` | Take a different approach or angle entirely |
| `REDO — [what was wrong]` | Start over; treat the bracket as the new spec |
| `NO — [correction]` | You're wrong about X; continue from the correction |

---

## ⚠️ Anti-Patterns — what silently degrades answers

| ❌ Don't | ✅ Do |
|---|---|
| "Help me with this" (no goal) | "I want to end up with ___" |
| Ask everything at once | One task per query; split big ones |
| Hide what you tried | List attempts — saves a round-trip |
| Say "make it better" | Define better: shorter? faster? more thorough? |
| Rewrite the whole prompt when an answer misses | Use a steering command |
| Treat the AI as an oracle | Require file-path citations and [UNKNOWN] honesty |

---

## 🃏 Quick Reference Card

```
1. Paste Standing Instructions once per conversation.
2. Fill: ROLE → GOAL → CONTEXT (incl. what you tried) → TASK.
3. Add FORMAT + SUCCESS CRITERIA when the shape of the answer matters.
4. Deep tasks: add SELF-CHECK.
5. Bad answer? One steering word, done.
```
