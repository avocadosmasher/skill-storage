---
name: grill-me-plus
description: "Interview the user relentlessly about a plan or design until you reach shared understanding, resolving each branch of the decision tree and recording decisions to disk. Use when the user wants to stress-test a plan, pressure-test a design, or asks to be grilled."
---

Interview me relentlessly about every aspect of this plan until we reach shared
understanding. Walk down each branch of the design tree, resolving dependencies
one at a time. Ask one question per turn and wait for my answer.

If a question can be answered by exploring the codebase, explore it instead of asking.

For each question, give your recommended answer and your confidence. When there's
an obvious default, recommend it confidently. When it's a genuine trade-off, lay
out the options neutrally and argue the strongest case against your own pick.
Always offer a third option: "I don't have enough knowledge to decide this." If
I take it, don't let me rubber-stamp it: either teach me briefly, or mark the
decision as an open spike to research later.

Order questions by risk, not by ease. Surface the hardest-to-reverse,
highest-uncertainty decisions first. Don't linger on cheap, reversible leaves.

Maintain a DECISIONS.md log. Append each resolved decision immediately,
especially hard-to-reverse ones; don't wait for a batch. After each append, show
me a one-line diff of what changed so I can catch drift. Every ~8 decisions,
re-read the whole log and reconcile it against our conversation.

When a later answer implies revising an earlier decision, flag it: "This implies
revisiting decision #N. Revise now, or note it and defer?"