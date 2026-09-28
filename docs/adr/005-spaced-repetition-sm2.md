# ADR-005: Spaced Repetition — SM-2 Algorithm

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

The spec requires spaced repetition for weak-spot reviews. Asks for SM-2 or
Leitner, with justification.

## Options Considered

### Option A: SM-2 (SuperMemo 2)
- Well-documented algorithm (1987, refined over decades)
- Used by Anki (the most popular spaced repetition tool)
- Per-item tracking: `ease_factor`, `interval`, `repetitions`, `next_due`
- Adapts interval based on quality of recall (score 0–5)
- Simple to implement (~30 lines of core logic)

### Option B: Leitner System
- Box-based system (box 1–5)
- Simpler but less granular — items move between fixed boxes
- Doesn't adapt interval based on quality, only pass/fail
- Less suitable for our rubric (we have 0–4 scores per dimension)

### Option C: FSRS (Free Spaced Repetition Scheduler)
- Modern, research-backed improvement over SM-2
- More complex, requires parameter tuning
- Overkill for v1 with ~50 topics

## Decision

**SM-2.** It maps naturally to our scoring system (rubric score 0–4 maps to SM-2
quality 0–5), is well-understood, simple to implement, and proven at scale. We
can upgrade to FSRS later if needed.

## Implementation

```
Per review item:
- ease_factor: float (starting 2.5, min 1.3)
- interval: integer (days)
- repetitions: integer
- next_due: datetime
- last_quality: integer (0–5)

After each review:
  if quality < 3:
    repetitions = 0, interval = 1
  else:
    if repetitions == 0: interval = 1
    elif repetitions == 1: interval = 6
    else: interval = round(interval * ease_factor)
    repetitions += 1

  ease_factor = max(1.3, ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  next_due = now + interval days
```

## Mapping Our Rubric to SM-2 Quality

| Our Score (0–4) | SM-2 Quality (0–5) | Meaning |
|-----------------|---------------------|---------|
| 0 | 0 | No attempt / blank |
| 1 | 2 | Major gaps |
| 2 | 3 | Partial, some key points |
| 3 | 4 | Good with minor gaps |
| 4 | 5 | Excellent, complete |

## Consequences

- ✅ Simple, proven, well-understood
- ✅ Natural mapping to our 0–4 rubric
- ✅ ~30 lines of core logic, easy to test
- ✅ Per-item granularity (track individual steps and skills)
- ⚠️ Less sophisticated than FSRS — acceptable for v1
