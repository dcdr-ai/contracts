# Execution policy (routing) — reference

This document explains how DCDR plans an ordered list of implementation candidates before retries/fallback happen.

Scope

- Applies to `IntentContract.executionPolicy` and `ImplementationContract` metadata.
- Planning chooses an ordered list of candidates. **RetryPolicy** determines how many attempts are made and when fallbacks are used.

## Terminology

- **Intent**: a stable executable contract (`IntentContract`).
- **Implementation**: a concrete provider+model+endpoint configuration (`ImplementationContract`).
- **Candidate planning**: building an ordered list of implementations that the runtime will attempt.

## Candidate planning pipeline (high level)

The runtime plans candidates in this order:

1. **Forced implementation (debug override)**
   - If `ExecuteIntentRequest.routing.forceImplementationId` is set, candidate planning is bypassed and the runtime will attempt that implementation only.

2. **Eligibility filters**
   - **Execution windows**: implementations outside `implementation.executionWindow` (when enforced) are removed.
   - **Provider denylist**: implementations whose provider appears in `routing.denyProviders` are removed.

3. **Preferred providers (request-level)**
   - If `routing.preferProviders` is provided, candidates are split into:
     - preferred group (providers listed)
     - rest
   - Planning is applied within each group and then concatenated (preferred first).

4. **Execution policy ordering**
   - The selected `executionPolicy.type` determines how candidates are ordered inside each group.

5. **Exploration (optional; Cloud / Cloud Pro)**
   - If `executionPolicy.exploration` is present, exploration may reorder **which candidate is tried first** (only).

Notes

- If all candidates are filtered out, the runtime returns a stable configuration error (see error codes docs).
- This doc describes the runtime’s reference implementation behavior and the fields it reads.

## Availability matrix (where policies can run)

DCDR has different operating modes. The most important distinction for routing is whether the runtime is running from a local `registry.json` (`--registry`) or from a managed cloud control plane.

| Feature / policy                                     | Runtime (self-hosted, `--registry`) | Cloud | Cloud Pro |
| ---------------------------------------------------- | ----------------------------------: | ----: | --------: |
| `WEIGHTED`                                           |                                  ✅ |    ✅ |        ✅ |
| `FALLBACK_CHAIN`                                     |  ❌ (rejected by capability gating) |    ✅ |        ✅ |
| `LOCAL_FIRST`                                        |  ❌ (rejected by capability gating) |    ✅ |        ✅ |
| `CHEAPEST_FIRST` / `FASTEST_FIRST` / `QUALITY_FIRST` |  ❌ (rejected by capability gating) |    ❌ |        ✅ |
| `CONDITION_ON_CONTEXT`                               |  ❌ (rejected by capability gating) |    ❌ |        ✅ |
| `CONDITION_ON_INPUT`                                 |  ❌ (rejected by capability gating) |    ❌ |        ✅ |
| `executionPolicy.exploration`                        |  ❌ (rejected by capability gating) |    ❌ |        ✅ |

Why runtime mode is restricted

- In `--registry` mode the runtime treats the registry as untrusted input and enforces a strict capability allowlist.
- Advanced execution policies are treated as an advanced capability.

(Cloud/Cloud Pro are expected to emit validated registries that include advanced routing features only when allowed.)

## Conditioned routing (context / input)

Conditioned routing is an advanced execution policy intended for Cloud / Cloud Pro registries.

Intent

- Enable explicit routing where an implementation is eligible only when a condition matches.
- Conditions may target:
  - request `context` (Condition on Context)
  - interpolated `vars` (Condition on Input)

Semantics

- Conditions are applied as an eligibility filter (similar to execution windows).
- In conditioned policies, implementations without a condition are not eligible.
- If multiple eligible candidates remain, declared-order tie-breakers are applied:
  - `order` ascending
  - then `weight` descending
  - then `id`
- If no conditions match, the runtime fails explicitly with `NO_ELIGIBLE_IMPLEMENTATION` and includes `error.details.reason="condition_not_matched"`.

Condition contract

- Leaf condition (single check):
  - `path`: dot-path relative to the evaluation scope
  - `op`: `ConditionOp` (e.g. `EQUALS`, `MORE_THAN`, `TRUE`, `VALID_URL`)
  - `value1` / `value2`: optional operator parameters
- Boolean composition (recursive):
  - `op`: `ConditionLogicOp` (`AND` | `OR` | `NOT`)
  - `conditions`: array of child conditions (leaf or nested logical)
  - Arity rules:
    - `NOT` must include exactly **1** child
    - `AND` / `OR` must include **1+** children

Dot-path scoping

- `path` is always relative to the scope chosen by the policy type.
  - `CONDITION_ON_CONTEXT` evaluates against `ExecuteIntentRequest.context`.
  - `CONDITION_ON_INPUT` evaluates against effective interpolated vars.
- Do not prefix `path` with `context.` or `vars.`.

Availability

- Cloud / Cloud Pro: supported.
- Runtime (self-hosted, `--registry`): rejected by capability gating (advanced execution policies are not allowed in freeware runtime mode).

## Policy types and tie-breakers

This section documents how each policy orders candidates and which fields are used.

Common fields

- `implementation.order` (number, optional)
- `implementation.weight` (number, optional; default weight = 1)
- `implementation.local` (boolean, optional)
- `implementation.costScore` / `latencyScore` / `qualityScore` (number, optional)
- `executionPolicy.implementationOrder` (string[], optional)
- `executionPolicy.preferredProviders` (IntentProvider[], optional)
- `executionPolicy.fallbackMode` (WEIGHTED | DECLARED_ORDER | ERROR)

### `WEIGHTED`

Purpose

- Choose a first candidate using weights; keep a stable, sensible order for the remaining candidates.

How the first candidate is chosen

- If `routing.preferProviders` is present and yields at least one candidate, selection happens within that preferred pool.
- Otherwise selection happens within the full filtered candidate list.
- Weight semantics:
  - weight defaults to **1** when missing or invalid
  - weight <= 0 is treated as **0**
  - if total weight is 0, selection falls back to declared order (see below)

How remaining candidates are ordered

- Remaining candidates are ordered as:
  1. remaining preferred group (if any)
  2. remaining rest group
- Inside each group:
  - weight descending
  - then `order` ascending
  - then `id` lexicographic

### `FALLBACK_CHAIN`

Purpose

- Use a fixed explicit implementation order.

Ordering

- If `executionPolicy.implementationOrder` is present:
  - candidates are ordered by that list (only IDs that exist and are eligible are used)
  - any remaining eligible candidates are appended in declared order
- If `executionPolicy.implementationOrder` is missing or empty:
  - candidates are ordered by declared order

Declared order tie-breakers

- `order` ascending
- then `weight` descending
- then `id`

### `LOCAL_FIRST`

Purpose

- Prefer on-prem/local implementations first.

Ordering

- Split candidates into:
  - local (`implementation.local === true`)
  - non-local
- Within each group, apply provider affinity (optional) and tie-breakers:
  - if `executionPolicy.preferredProviders` is provided, providers are ranked by that list order
  - tie-breakers:
    1. provider rank (preferred first)
    2. `order` ascending
    3. `weight` descending
    4. `id`

### `CHEAPEST_FIRST`, `FASTEST_FIRST`, `QUALITY_FIRST`

Purpose

- Order candidates by a numeric score.

Score fields

- `CHEAPEST_FIRST` uses `implementation.costScore` (ascending)
- `FASTEST_FIRST` uses `implementation.latencyScore` (ascending)
- `QUALITY_FIRST` uses `implementation.qualityScore` (descending)

Missing score behavior

- If any eligible candidate is missing the required score (or it is non-finite), behavior depends on `executionPolicy.fallbackMode`:
  - `ERROR`: runtime fails with a stable config error
  - `DECLARED_ORDER`: uses declared order
  - `WEIGHTED` (default): uses weighted selection (same semantics as `WEIGHTED`)

Tie-breakers (when scores are present)

- If scores are equal:
  1. `weight` descending
  2. `order` ascending
  3. `id`

## Exploration (Cloud / Cloud Pro)

Exploration is an explicit opt-in feature that may change **only which candidate is tried first**.

- Supported mode: `EPSILON_GREEDY_TOP_K`
  - With probability `epsilon` (0..1), pick a random candidate among the top `topK` candidates and move it to index 0.
  - Otherwise keep the deterministic top candidate.
- V1 rule: exploration is **not supported** with `executionPolicy.type = WEIGHTED`.

## Operational guidance

- Prefer deterministic policies (`FALLBACK_CHAIN`, score-based policies) when you need reproducibility.
- Use `WEIGHTED` when you want simple distribution between two or more known-good options.
- Use `routing.forceImplementationId` only for debugging (it bypasses windows, filters, and policy ordering).

## Related docs

- Contracts reference: [CONTRACTS.md](CONTRACTS.md)
- Feature/tier overview: [TIERS_FEATURE_MATRIX.md](TIERS_FEATURE_MATRIX.md)
- Execution error codes: [EXECUTION_ERROR_CODES.md](EXECUTION_ERROR_CODES.md)
