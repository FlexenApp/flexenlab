# Track Food Flow Audit

Date: March 11, 2026

Scope:
- [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart)
- [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart)
- [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart)
- [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart)
- [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart)

## Baseline design rules found in code

The repo does not currently expose a dedicated written Flexen design-guidelines document. The practical baseline comes from the shared theme:

- Ubuntu is the app font family: [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L75) and [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L125)
- Nutrition surfaces should use the green nutrition accent: [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L14)
- Core controls are rounded, generally 10px radius: [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L37), [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L46), [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L61)
- Light and dark mode are both expected through `CustomColors` and `CustomTextStyles`: [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L75), [theme.dart](/Users/leonard/code/flexenapp/lib/styles/theme.dart#L125)

This audit uses those shared patterns as the standard for consistency.

## Flow summary

Primary entry point:
- `showFoodTrackingSheet()` opens a bottom-aligned modal route and returns either a `FoodSearchResult`, a `String` for AI chat handoff, or `null`: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L23)

From the track-food sheet the user can:
- Open barcode scan: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L101)
- Open text search: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L109)
- Open camera recognition, gated by daily usage / premium: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L117)
- Select recent / frequent food directly: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L223)
- Use natural-language input, with premium lock behavior: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L304)

Return behavior:
- Search, barcode, camera, and recent/frequent selection all pop back into the sheet, which then immediately pops its own caller with the selected result: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L91), [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L106), [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L114), [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L130)

Parallel but separate flow:
- Grocery scan is a standalone multi-scan page for fridge import, not currently linked from the track-food sheet in these files: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L9)

## Page audit

### 1. Track Food sheet

File:
- [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart)

Current UI structure:
- Custom modal route with bottom slide-up animation and a rounded top edge: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L26)
- Drag handle, title, and a 3-tile quick action row for barcode, search, and photo: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L251), [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L267), [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L270)
- Natural-language input block shown below actions and lockable for non-premium users: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L304)
- Optional "Recently Eaten" and "Most Used" lists, each collapsed to 3 rows with a show-more affordance: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L313), [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L334)
- Recent/frequent rows are dense `ListTile`s with thumbnail, macros, and usage count: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L458)
- Premium upsell uses a second bottom sheet with title, short copy, primary CTA, and cancel: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L143)

Navigation flow:
- Entry from another nutrition screen via `showFoodTrackingSheet()`: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L23)
- `Barcode` pushes [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart): [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L101)
- `Search` pushes [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart): [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L109)
- `Photo` pushes [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart) if quota allows; otherwise opens premium upsell: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L117)
- Recent/frequent selection returns immediately: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L95)
- AI chat can return a `String` instead of food data for a different downstream flow: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L307)

UI/UX improvement needs:
- The sheet is functionally dense but visually flat. It lacks section framing, hierarchy, and enough separation between quick actions, AI entry, and history content. This underuses Flexen’s card/shadow/radius system from the theme.
- The title area is too minimal for a primary intake flow. There is no subtitle explaining the three capture modes or what the AI field does.
- Quick action tiles are small, symmetric, and low-information. Barcode, search, and photo have equal visual weight even though search is likely the fallback and photo is premium-limited.
- The photo quota badge is cryptic. `2/3` communicates system state, but not meaning. It should read as remaining uses with supporting copy before the user taps.
- The premium upsell CTA is a dead end in this implementation. `Get Premium` only closes the sheet: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L186). That breaks expectation and weakens trust.
- History items are useful but not decision-optimized. They show macros and usage count, but not meal context, last eaten time, or a stronger primary action cue.
- The sheet relies on `SingleChildScrollView` for all content, so the interaction can feel long and undifferentiated as more recent/frequent rows appear.
- There is no explicit empty-state guidance if the user has no recent/frequent items and is not premium. The sheet risks feeling sparse and paywalled.

### 2. Food Search page

File:
- [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart)

Current UI structure:
- Standard `Scaffold` with green nutrition `AppBar`: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L57)
- Top search field with autofocus and 500ms debounce: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L65), [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L31)
- Animated content area with 3 states:
- Loading spinner plus helper text: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L82)
- Empty state with either "Search for food..." or "No results found.": [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L99)
- Result list with simple `ListTile`s: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L110)
- Each result row shows name, macro summary, optional brand, and a serving-size label: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L126)

Navigation flow:
- Opened from the track-food sheet: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L109)
- Typing triggers debounced API search via `NutritionSearchService.search()`: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L38)
- Tapping a result pops the page with the selected `FoodSearchResult`: [food_search_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_search_page.dart#L141)

UI/UX improvement needs:
- This page is structurally clean but visually generic. It reads like a utility screen rather than a branded Flexen nutrition flow.
- The app bar uses the nutrition color, but the rest of the page does not carry the nutrition identity through cards, chips, or accents.
- Search results are too compressed for food selection. They omit imagery, source confidence, stronger portion framing, and a clear tap target hierarchy.
- Empty and no-results states are underdesigned. They provide no recovery actions such as "scan barcode" or "try a more general term."
- The search field does not expose clear state controls like inline clear, search suggestions, recent queries, or category shortcuts.
- There is no visible indication that results come from OpenFoodFacts or may require verification, which matters for trust when selecting nutrition data.
- Because search starts only after two characters and 500ms, the page can feel inert on entry. A stronger initial state would guide the user immediately.

### 3. Barcode Scanner page

File:
- [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart)

Current UI structure:
- `Scaffold` with green nutrition `AppBar`: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L72)
- Main state toggles between full-screen scanner and product-result view: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L78)
- Scanner view is a `Stack`:
- `MobileScanner` live camera layer: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L86)
- Center loading card while lookup is in progress: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L90)
- Bottom error card if product lookup fails: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L106)
- Instruction pill near the bottom: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L119)
- Result view is a plain text-first details screen with nutrition rows and `Scan Again` / `Add` buttons: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L144)

Navigation flow:
- Opened from the track-food sheet: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L101)
- Scanner reads barcode, checks local cache first, otherwise calls lookup service: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L30)
- Successful lookup swaps from scan state to result state on the same page: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L54)
- `Add` pops the page with the selected result: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L192)
- `Scan Again` resets the state and returns to live camera scanning: [barcode_scanner_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/barcode_scanner_page.dart#L178)

UI/UX improvement needs:
- The scanner lacks a framing reticle or barcode target box, so the instruction overlay is not enough to guide alignment.
- There are no visible camera controls such as torch, manual entry fallback, or permission-recovery UI.
- The loading and error cards are functional but feel unstyled relative to the rest of the nutrition flow.
- The result view drops visual continuity with the scanner. It becomes a plain column instead of a branded confirmation card or bottom sheet.
- Product image is not shown even though `FoodSearchResult` supports imagery elsewhere. That weakens recognition confidence before adding.
- Nutrition data is presented as a flat label/value list, which is readable but not optimized for fast confirmation.
- The app bar is green, but the page body does not apply the broader Flexen spacing, typography, and card language consistently.
- Not-found handling is weak. The user gets an error message but no next-best path such as manual search.

### 4. Food Camera page

File:
- [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart)

Current UI structure:
- `Scaffold` with a neutral app bar rather than the green nutrition header: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L98)
- Auto-launches device camera after first frame: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L25)
- Body is an `AnimatedSwitcher` with 3 states:
- Analyzing view with centered spinner and two lines of copy: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L105), [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L116)
- Result view with captured image, success icon, food name, estimated nutrition card, and `New Photo` / `Add` actions: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L149)
- Error view with icon, message, and retry button: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L264)

Navigation flow:
- Opened from the track-food sheet after premium/quota validation: [food_tracking_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_tracking_page.dart#L117)
- Page immediately opens the system camera picker: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L27)
- If the camera is canceled before a result exists, the page pops itself: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L48)
- If recognition succeeds, the page stays in-place for review and `Add` pops the `FoodSearchResult`: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L60), [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L254)
- `New Photo` repeats the camera capture process in-place: [food_camera_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/food_camera_page.dart#L243)

UI/UX improvement needs:
- The page identity is inconsistent with the nutrition section. The app bar switches to the neutral primary color instead of the nutrition color used by search and barcode.
- Auto-opening the camera removes the chance to set expectations. There is no pre-capture guidance about lighting, framing, mixed meals, or AI estimation limits.
- The analyzing state is too sparse for a premium AI feature. It should feel more intentional and trustworthy, especially if the backend takes time.
- The result card is better than the barcode result view, but it still lacks confidence, portion-editing, and correction affordances before add.
- Estimated nutrition is presented as final-looking data even though this is inference-based. The UX should distinguish estimate vs verified values more clearly.
- Error handling only offers retry. There is no route to text search or barcode if the image fails.
- The action labels are generic. For this flow, the primary CTA should likely communicate confirmation, not just `Add`.

### 5. Grocery Scan page

File:
- [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart)

Current UI structure:
- `Scaffold` with green nutrition `AppBar`: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L96)
- Optional top-right `Done (n)` action once at least one product has been scanned: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L101)
- Fixed-height scanner area at the top with instruction pill, progress card, and error card overlays: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L115)
- Lower section is either:
- Empty state with icon and short instruction: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L185)
- List of scanned products with numbered avatar, food name, macro summary, and remove button: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L208), [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L243)
- Bottom CTA bar duplicates the save action when items exist: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L218)

Navigation flow:
- This page is standalone in the inspected files. It is not linked from the track-food sheet here.
- Live scanner adds unique barcodes to an in-memory list: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L32)
- `Done` or the bottom CTA saves each scanned item into `FridgeService` and pops with the count: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L67)
- Individual scanned items can be removed before save: [grocery_scan_page.dart](/Users/leonard/code/flexenapp/lib/pages/nutrition/grocery_scan_page.dart#L60)

UI/UX improvement needs:
- This is useful operationally, but it feels closer to an internal tool than a user-facing branded experience.
- It duplicates save affordances in both the app bar and bottom bar. That adds noise without meaningfully improving completion.
- The fixed 250px scanner region is small for a continuous scan task and gives little visual guidance.
- The scanned list lacks product images, brands, quantities, and any editable fridge metadata before import.
- Macro summaries are not the most relevant information for a fridge-import workflow. Brand, package type, and expiration-relevant metadata would matter more.
- Save feedback is limited to a snackbar. There is no richer confirmation state or error recovery if one item fails during the looped save process.
- Like the barcode page, not-found handling does not offer manual resolution or skip-with-note behavior.

## Cross-flow issues

- The track-food ecosystem mixes three visual styles: custom modal sheet, green utility pages, and a neutral AI camera page. The flow should feel like one product surface.
- Result confirmation patterns are inconsistent. Search selects instantly, barcode requires a confirmation page, camera requires a confirmation page, and history taps return immediately.
- Secondary states are underdeveloped across the flow: empty, no-results, permission issues, not-found, premium-locked, and AI-failure states all need clearer recovery options.
- Trust cues are thin. Barcode/search are database-driven, camera is estimated, and cached history is user-derived, but the UX does not communicate those distinctions.
- Accessibility and ergonomics likely need work because several critical controls are small or text-light, especially the action tiles and scanner overlays.

## Recommended improvement priorities

1. Unify the visual system across all nutrition intake pages.
2. Redesign the track-food sheet to better explain choices and reduce cognitive load.
3. Add stronger recovery actions for not found, no results, and AI failure states.
4. Improve scanner usability with framing, torch/fallback controls, and clearer confirmation UI.
5. Make AI estimation states feel premium and transparent about uncertainty.
6. Rework grocery scan around fridge-import needs rather than nutrition-macro presentation.
