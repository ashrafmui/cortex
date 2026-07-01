# Session UI Approaches

This document captures two concrete approaches to designing the session page, written to preserve the decision record if the UI needs revisiting.

---

## The core mismatch (why we redesigned)

The original chat-bubble UI had four structural problems:

1. **Dead mode selector** — `/api/session/start` accepts only `goal`. The orchestrator (`selectMode`) picks TEACH/QUIZ/SOCRATIC/REVIEW from the learner's knowledge graph. The user's selection was never passed to the API; showing it as a control created a false contract.

2. **Chat metaphor vs. structured protocol** — At every turn there is exactly ONE thing the user should do: answer a `check_question` (TEACH), answer a quiz, respond to a Socratic prompt, or give a recall answer (REVIEW). A generic "Ask anything" composer with left/right bubbles implied open-ended chat, which is architecturally incorrect.

3. **Disconnected quiz input** — The quiz question appeared in the scroll, but the answer textarea floated at the bottom as a separate `QuizInput` bar — physically detached from what it was answering.

4. **Grade as a sibling message** — After answering a quiz, the `GradeCard` appeared as the next message bubble. Grade feedback belongs attached to the quiz exchange it evaluates, not as an independent conversational turn.

---

## Option A — Step Card (one card at a time)

Replace the scrolling feed entirely with a **single focused card** representing the current step.

```
┌──────────────────────────────────────────────────┐
│  ● Pointers in C  ·  Teaching  ·  Foundation     │  ← context strip
├──────────────────────────────────────────────────┤
│                                                  │
│  A pointer stores a memory address, not a        │
│  value. When you declare int *p = &x, you're     │
│  storing the address of x in p.                  │
│                                                  │
│  ─────────────────────────────────────────────   │
│  What happens if you dereference a NULL pointer? │  ← check_question
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Your answer…                              │  │  ← input inline
│  └────────────────────────────────────────────┘  │
│                                    [ Submit → ]  │
└──────────────────────────────────────────────────┘

  [History ▾]  Goal · Teach · Quiz · Socratic       ← collapsed past steps
```

**How it maps to the API:** Each API response = one card. Submit = one API call. Grade appears inline on the quiz card before "Next →" advances to the next step.

**Tradeoff:** Scrolling back to re-read previous steps requires opening a history drawer. Works best when each step is self-contained (it is, by design). Cleanest mental model match — the orchestrator produces one step at a time, and the UI shows one step at a time.

---

## Option B — Annotated Feed (implemented ✓)

Keep a scrolling layout but replace the chat-bubble metaphor with **full-width session blocks**. Each block represents one AI turn: it has a mode badge + concept header, AI content, user response, and (for QUIZ) the grade — all inline.

```
┌─ Teaching · Pointers ───────────────────────────────────────────────────────┐
│  A pointer stores a memory address...                                        │
│  Check: What happens if you dereference a NULL pointer?                      │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Your answer: It causes a segfault because the OS has no memory mapped...    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ Quiz · Pointers ───────────────────────────────────────────────────────────┐
│  What is the difference between * and & in C?                                │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Confidence: [ Low ]  [ Medium ]  [ High ]                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Write your answer…                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

After the quiz is submitted:

```
┌─ Quiz · Pointers ───────────────────────────────────────────────────────────┐
│  What is the difference between * and & in C?                                │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Your answer: & gets the address of a variable, * dereferences...            │
│  ─────────────────────────────────────────────────────────────────────────   │
│  82% — Good — you got & correct but mixed up when to dereference             │
│  Answer: & is the address-of operator; * used in declaration vs expression   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**How it maps to the API:** `blocks[]` array — one block per API response. Each block holds `response`, `userAnswer`, and `grade` so they're always co-located. Mode + concept metadata live on the block.

**Tradeoff:** Familiar scroll-based progression. A full session transcript is always visible. Slightly more implementation complexity (stateful blocks that transition from active → submitted → graded).

---

## Key changes from the original (both options)

- Mode selector removed from empty state (orchestrator decides mode, not the user)
- First-message placeholder changed from "Ask anything" to "Describe what you want to learn…"
- Grade shown inline with its quiz question, not as a sibling message
- Quiz answer input is always co-located with the question it answers

---

## Decision rationale

Option B was chosen because it preserves scroll-based progression (users can review earlier blocks without a separate drawer) and the block-per-turn model maps cleanly to the orchestrator's one-step-at-a-time protocol. Option A remains the better choice if you want a more focused, distraction-free study experience — swap in by replacing the blocks scroll with a single-card view and adding a history collapse.
