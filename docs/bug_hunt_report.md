# Flexen App Bug Hunt Report

Scanned directories:

- `lib/pages/main/`
- `lib/pages/menu/`
- `lib/pages/training/`
- `lib/services/`
- `lib/widgets/`

Focus areas:

1. `setState()` after `dispose`
2. `TextEditingController` not disposed
3. `jsonDecode` without `try-catch`
4. async gap without `mounted` guard
5. null check missing on nullable values
6. `LateInitializationError` potential

## Summary

Confirmed issues found: 8

- `setState()` after dispose: 2
- `TextEditingController` not disposed: 3
- async gap without mounted guard: 2
- null check missing on nullable value: 1
- unhandled `jsonDecode`: 0 confirmed
- `LateInitializationError` potential: 0 confirmed

## Findings By File

### `lib/pages/menu/friends_page.dart`

1. `setState()` after dispose risk in `_loadData()`
   - Lines: 38-66
   - After `await Future.wait(...)`, the success path calls `setState(() => _loading = false);` on line 60 with no `mounted` check.
   - The `catch` path also calls `setState(...)` on lines 62-65 with no `mounted` check.
   - If the page is popped while the async work is in flight, this can throw `setState() called after dispose`.

2. `TextEditingController` leak in `_showAddFriendSheet(...)`
   - Lines: 686-780
   - `codeController` is created on line 687 and never disposed.
   - Because this controller is owned by the sheet helper, it should be disposed when the sheet closes.

3. `setState()` after dispose risk inside add-friend sheet
   - Lines: 754-780
   - The button handler awaits `FriendService.sendRequest(code)` on line 763.
   - After the await it calls `setSheetState(...)` on lines 778-780.
   - If the bottom sheet was dismissed before the request completed, `setSheetState` targets a disposed `StatefulBuilder` and can throw.

4. `TextEditingController` leak in `_showFriendDetailSheet(...)` / `_showNicknameDialog(...)`
   - Lines: 838-996 and 1036-1075
   - `nicknameController` is created on line 838 and passed into the dialog, but never disposed.

5. Sheet-local `setState()` after dispose risk in nudge action
   - Lines: 912-925
   - After `await FriendService.sendNudge(...)`, the callback calls `setSheetState(() {})` on line 920.
   - If the sheet has already been dismissed, this can trigger `setState() called after dispose`.

### `lib/pages/menu/settings.dart`

1. async gap without mounted guard in goal save callbacks
   - Lines: 191-197, 212-218, 233-239, 254-260, 276-282, 297-301, 331-335
   - Each `onSave` callback awaits a write (`g.setCaloriesMax`, `g.setMacros`, `g.setWater`, `g.setStepGoal`, `g.setUserWeight`) and then calls `setState(...)` without checking `mounted`.
   - If the page is closed while the save is running, those callbacks can update disposed state.

2. `TextEditingController` leak in `_showGoalSheet(...)`
   - Lines: 818-899
   - `controller` is created on line 821 and never disposed.

3. async gap without mounted guard in `_showGoalSheet(...)`
   - Lines: 891-898
   - The save button awaits `onSave(controller.text.trim())` on line 894, then immediately calls `nav.pop()` and `messenger.showSnackBar(...)`.
   - There is no check that the page and sheet contexts are still valid after the await.

### `lib/pages/main/mind.dart`

1. Nullable theme extension dereferenced with `!`
   - Lines: 105-108
   - `final color = Theme.of(context).extension<CustomColors>();` is nullable.
   - The expression `color?.mindDark ?? color!.secondaryColor` on line 107 still force-unwraps `color`.
   - If the extension is missing from the active theme, this will throw at runtime.

## No Confirmed Findings In Other Categories

- `jsonDecode`:
  - I found multiple `jsonDecode(...)` uses across the scanned directories.
  - In the confirmed cases I reviewed, decoding was already wrapped by a local `try/catch` or a broader function-level `try/catch`, so I did not mark any as an unhandled decode bug.

- `LateInitializationError`:
  - I reviewed the `late` fields surfaced by the scan and did not find a confirmed use-before-initialization path in this pass.

## Notes

- This report is a targeted static review for the six requested bug classes. It does not cover broader logic bugs, race conditions outside widget lifecycle handling, or architectural issues.
