# Onboarding QA Review

Date: 2026-03-08

Scope: `lib/pages/onboarding/*.dart`

## 1) Summary

| Severity | Count |
| --- | ---: |
| High | 2 |
| Medium | 3 |
| Low | 1 |
| UX-only | 4 |

### Key themes

- Async navigation is wired through `VoidCallback`, which drops `Future`s and makes rapid repeated taps capable of skipping steps.
- The "permissions" step only flips local booleans; it does not request or verify any platform permission, but the UI presents those choices as if they were applied.
- State is concentrated in the controller correctly, but page construction and transition handling are brittle enough to cause regressions once these pages become stateful or start doing real async work.

### Verification note

`flutter analyze lib/pages/onboarding` could not be executed in this sandbox because Flutter attempted to write to its SDK cache outside the writable workspace. Findings below are based on source review.

## 2) Per-file analysis

### `lib/pages/onboarding/onboarding_controller.dart`

#### High

1. `lib/pages/onboarding/onboarding_controller.dart:33`, `lib/pages/onboarding/onboarding_controller.dart:42`, `lib/pages/onboarding/onboarding_controller.dart:52`, `lib/pages/onboarding/onboarding_controller.dart:62`, `lib/pages/onboarding/onboarding_controller.dart:86`, `lib/pages/onboarding/onboarding_controller.dart:91`
   Issue: `_nextStep`, `_previousStep`, and `_completeOnboarding` are `Future<void>` methods, but they are passed into page APIs typed as `VoidCallback`. That turns all async work into fire-and-forget behavior.
   Risk:
   - Exceptions from `animateToPage` or navigation become unhandled.
   - Buttons cannot await completion or disable themselves during transitions.
   - Rapid repeated taps can run overlapping transitions.
   Concrete failure mode:
   - On step 1, tapping "Get started" twice quickly can call `_nextStep()` twice. The first call sets `_currentStep = 1` before animation completes; the second call sees step `1` and advances to step `2`, skipping the permissions screen entirely.
   Suggested fix:
   - Change page action signatures from `VoidCallback` to `Future<void> Function()` where the action is async.
   - Add a controller-level transition guard such as `_isTransitioning`.
   - Disable navigation buttons while a page transition is in progress.

2. `lib/pages/onboarding/onboarding_controller.dart:121-137`
   Issue: `_completeOnboarding()` simulates completion with `Future.delayed`, then navigates to `MyHomePage`, but it never persists completion status or coordinates with any real permission/personalization side effects.
   Risk:
   - The flow looks complete without saving onboarding state.
   - Notification/health choices are lost unless another layer persists them.
   - If onboarding is meant to run once, nothing in this controller prevents it from reappearing.
   Suggested fix:
   - Replace the delay with a real completion pipeline:
     - request platform permissions where applicable,
     - persist onboarding completion and user choices,
     - navigate only after those operations succeed.
   - Surface errors to the user if any step fails.

#### Medium

3. `lib/pages/onboarding/onboarding_controller.dart:31-64`, `lib/pages/onboarding/onboarding_controller.dart:141-187`
   Issue: `_pages` is a getter that rebuilds a fresh widget list on every `setState`.
   Risk:
   - Today the pages are stateless, so the effect is mostly churn.
   - As soon as a page becomes stateful, adds controllers, focus nodes, animation, or local temporary state, that state will be recreated on every parent rebuild.
   Suggested fix:
   - Build the page list once in `initState`, or return pages keyed by stable `PageStorageKey`s.
   - Keep mutable onboarding state in the controller, but avoid reconstructing page objects unnecessarily.

4. `lib/pages/onboarding/onboarding_controller.dart:72-83`
   Issue: `_currentStep` is updated before `animateToPage()` finishes successfully.
   Risk:
   - The progress indicator can report the next step even if the page transition fails or is interrupted.
   - This amplifies the double-tap race described above.
   Suggested fix:
   - Guard transitions with `_isTransitioning`.
   - Update `_currentStep` from `PageView.onPageChanged`, or after a successful navigation/animation completes.

5. `lib/pages/onboarding/onboarding_controller.dart:126-133`
   Issue: Navigation and completion errors are not handled explicitly.
   Risk:
   - If a future onboarding save/permission request fails, the user will just remain on the last screen with no explanation.
   Suggested fix:
   - Add `catch` handling around completion work.
   - Show a `SnackBar`, dialog, or inline error state and keep `isCompleting` consistent.

### `lib/pages/onboarding/permissions_page.dart`

#### High

1. `lib/pages/onboarding/permissions_page.dart:20-25`, `lib/pages/onboarding/permissions_page.dart:33-49`, `lib/pages/onboarding/permissions_page.dart:139-143`
   Issue: This page presents permission choices as immediate toggles, but the switches only mutate in-memory booleans. No OS permission request or current permission-status check happens here.
   Risk:
   - "Notifications" can show as enabled even when the system permission is denied or never requested.
   - "Health permissions" reads like a real permission flow, but the app is only storing a preference.
   Suggested fix:
   - Distinguish "preference" from "permission status" in both data model and UI text.
   - Trigger actual permission requests from the toggle/continue action or route users to the platform permission step.
   - Reflect real platform states such as `granted`, `denied`, `permanentlyDenied`, `notSupported`.

#### Medium

2. `lib/pages/onboarding/permissions_page.dart:63`, `lib/pages/onboarding/permissions_page.dart:71`
   Issue: `onBack` and `onNext` are exposed as `VoidCallback` even though the controller methods passed in are async.
   Risk:
   - Same dropped-future/race behavior as the controller finding above.
   Suggested fix:
   - Change these callbacks to async function types and await them in the button handlers.

#### UX-only

3. `lib/pages/onboarding/permissions_page.dart:109-143`
   Issue: The tile uses a single horizontal `Row` with icon, text block, and `Switch`.
   Risk:
   - Large accessibility text sizes can compress the description badly or cause layout overflow.
   Suggested fix:
   - Use a responsive layout for large text scales, such as moving the switch below the description or switching to a `Column` at higher `MediaQuery.textScaler` values.

4. `lib/pages/onboarding/permissions_page.dart:35-45`
   Issue: Copy is ambiguous about what happens now versus later. "Allow health metrics later" conflicts with the presence of a live switch.
   Suggested fix:
   - Rename the setting to something like "Ask me later about Health access" if it is only a preference.

### `lib/pages/onboarding/personalize_page.dart`

#### Medium

1. `lib/pages/onboarding/personalize_page.dart:14-15`, `lib/pages/onboarding/personalize_page.dart:69`, `lib/pages/onboarding/personalize_page.dart:77`
   Issue: Navigation callbacks are `VoidCallback`, but the actual controller actions are async.
   Risk:
   - Same dropped-future behavior and repeat-tap race as other onboarding pages.
   Suggested fix:
   - Change `onBack` and `onNext` to `Future<void> Function()`.
   - Disable the buttons while a transition is running.

#### Low

2. `lib/pages/onboarding/personalize_page.dart:36-55`
   Issue: All options are hardcoded strings with no enum/value-object backing.
   Risk:
   - Typos or copy changes can silently break downstream matching if these values are later persisted or used in API payloads.
   Suggested fix:
   - Back the UI with enums or sealed value objects and derive display labels from them.

#### UX-only

3. `lib/pages/onboarding/personalize_page.dart:37-55`
   Issue: The flow always starts with preselected defaults, so users can continue without actively choosing anything.
   Risk:
   - Completion metrics may overstate user intent.
   - Users may not realize personalization has already been applied.
   Suggested fix:
   - Either leave selections unset until chosen, or explicitly label them as recommended defaults.

### `lib/pages/onboarding/onboarding_complete_page.dart`

#### High

1. `lib/pages/onboarding/onboarding_complete_page.dart:22-29`, `lib/pages/onboarding/onboarding_complete_page.dart:52-66`
   Issue: The summary presents notification and health states as if setup has been completed, but those values only reflect local onboarding toggles.
   Risk:
   - The final screen can falsely confirm that permissions are enabled when the system has not granted them.
   Suggested fix:
   - Bind summary rows to real permission status rather than onboarding preference flags.
   - Use wording such as "Will ask later" or "Preference saved" until the platform grant is confirmed.

#### UX-only

2. `lib/pages/onboarding/onboarding_complete_page.dart:88-95`
   Issue: The loading button swaps text for a bare `CircularProgressIndicator` with no semantics label.
   Risk:
   - Screen-reader users get a weaker completion signal.
   Suggested fix:
   - Wrap the spinner in `Semantics(label: 'Finishing onboarding')` or keep a text label alongside the indicator.

### `lib/pages/onboarding/welcome_page.dart`

#### Medium

1. `lib/pages/onboarding/welcome_page.dart:16-17`, `lib/pages/onboarding/welcome_page.dart:82`, `lib/pages/onboarding/welcome_page.dart:87`
   Issue: `onNext` and `onSkip` are declared as `VoidCallback`, but the controller passes async methods.
   Risk:
   - Same dropped-future issue as the other pages.
   - Rapid tapping on "Get started" or "Skip for now" can fire overlapping transitions/navigation.
   Suggested fix:
   - Use async callback types and disable actions while the future is pending.

#### UX-only

2. `lib/pages/onboarding/welcome_page.dart:86-89`
   Issue: "Skip for now" immediately exits to the app with no confirmation and no explanation of what was skipped.
   Risk:
   - Users can leave the flow accidentally.
   - The app may then feel under-configured without telling them how to revisit onboarding.
   Suggested fix:
   - Add a confirmation step or secondary explanatory text such as "You can finish setup later in Settings."

### `lib/pages/onboarding/onboarding_step.dart`

No functional defects found in this shared layout.

Observations:

- The structure is simple and null-safe.
- The fallback theme handling is reasonable.
- Keep an eye on very small screens plus large text scaling because actions are fixed outside the scrollable content, but current content size does not make this a direct bug yet.

## 3) UX issues

1. The permission step behaves like a settings-preference page, not a real permission flow. The labels and summary screen should stop implying that OS permissions were actually granted.

2. Default-on notification and health toggles create misleading consent. For permission-sensitive features, the safer default is "off / ask me later" until the platform grant exists.

3. The skip path exits onboarding immediately without telling users where they can complete setup later.

4. The permissions layout is likely to degrade under large accessibility text sizes because the switch competes for horizontal space with multi-line copy.

## Recommended priority order

1. Fix async callback typing and add a transition lock to prevent step skipping and dropped errors.
2. Redesign the permissions model so UI state, persisted preference, and real OS permission status are separate concepts.
3. Persist onboarding completion and choices before navigating away.
4. Harden the layout and copy for accessibility and expectation-setting.
