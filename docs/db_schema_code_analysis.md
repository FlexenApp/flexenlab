# Firestore Schema Code Analysis (FlexenApp)

Generated from code scan in:

- `lib/services/daily_log_service.dart`
- `lib/services/ai_chat_service.dart`
- `lib/services/user_database.dart`
- `lib/services/friend_service.dart`
- `lib/services/sleep_service.dart`
- `lib/services/fridge_service.dart`
- `lib/services/medication_service.dart`
- `lib/services/recipe_service.dart`
- `lib/pages/**/*.dart` (all files with `collection(` hits)

## Notes

- Focus is Firestore only (no SQLite / local SharedPreferences schemas).
- `dailyLogs` is central and contains nested maps/arrays for meals, sleep, workouts, mood, water, steps, journal, medications.
- `meditation` field was **not found** in current Firestore write paths.
- `mood` is stored as `{index,label}` (index 0..4), not 1..10 in current code.

## Users

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| users | {userId} |  | username | string | Username from signup |
| users | {userId} |  | email | string | User email |
| users | {userId} |  | displayName | string | Display name |
| users | {userId} |  | photoUrl | string | Profile photo URL |
| users | {userId} |  | friendCode | string | Invite code like FLEX-XXXX |
| users | {userId} |  | createdAt | timestamp | Account creation timestamp |
| users | {userId} |  | lastLogin | timestamp | Last sign-in timestamp |
| users | {userId} |  | timezone | string | Device timezone name |
| users | {userId} |  | isPremium | boolean | Premium subscription state |
| users | {userId} |  | sex | string | Gender/sex from signup profile |
| users | {userId} |  | birthDate | timestamp | Date of birth |
| users | {userId} |  | heightCm | number | Height in centimeters |
| users | {userId} |  | weightKg | number | Weight in kilograms |
| users | {userId} |  | bodyFatPercent | number | Estimated body fat percentage |
| users | {userId} |  | activityLevel | string | Activity level category |
| users | {userId} |  | dietPreferences | array | Diet preference tags |
| users | {userId} |  | dietRestrictions | array | Diet restrictions / allergies from signup |
| users | {userId} |  | dislikedFoods | array | Foods user dislikes |
| users | {userId} |  | favoriteFoods | array | Favorite foods from signup step |
| users | {userId} |  | connectedDevices | array | Connected health devices |
| users | {userId} |  | selectedTrainingPlan | string | Selected starter plan name |
| users | {userId} |  | fitnessGoal | string | Serialized fitness goals (legacy/string form) |
| users | {userId} |  | fitnessGoals | array | Fitness goals (array form, read in AI context) |
| users | {userId} |  | goalWeightKg | number | Target weight from signup mapper |
| users | {userId} |  | weightGoalKg | number | Alternative target weight field read by AI context |
| users | {userId} |  | goalCalories | number | Daily calorie goal |
| users | {userId} |  | goalCarbs | number | Daily carbs goal |
| users | {userId} |  | goalProtein | number | Daily protein goal |
| users | {userId} |  | goalFat | number | Daily fat goal |
| users | {userId} |  | goalWaterCups | number | Daily water goal in cups/glasses (used in settings/profile) |
| users | {userId} |  | goalWaterGlasses | number | Daily water goal in glasses (used in signup flow) |
| users | {userId} |  | goalSteps | number | Daily step goal (default 10000) |
| users | {userId} |  | friendsCount | number | Friend counter updated on accept/remove |
| users | {userId} |  | shareActivityWithFriends | boolean | Privacy toggle for activity sharing |
| users | {userId} |  | shareStreakWithFriends | boolean | Privacy toggle for streak sharing |
| users | {userId} |  | mealPresets | array | Saved meal presets list from home screen |
| users | {userId} | mealPresets[] | id | string | Preset ID |
| users | {userId} | mealPresets[] | name | string | Preset name |
| users | {userId} | mealPresets[] | kcal | number | Preset calories |
| users | {userId} | mealPresets[] | period | number | MealPeriod enum index |
| users | {userId} | mealPresets[] | deleted | boolean | Soft-delete flag |
| users | {userId} |  | preExistingCondition | string | Optional health condition (read by AI context) |
| users | {userId} |  | medicationDetails | string | Optional medication notes (read by AI context) |

## Settings

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| users/{userId}/settings | general |  | language | string | App language |
| users/{userId}/settings | general |  | darkMode | boolean | Dark mode setting |
| users/{userId}/settings | general |  | notifications | boolean | Notification setting |
| users/{userId}/settings | general |  | units | string | Unit system: metric/imperial |

## DailyLogs

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| dailyLogs | {userId}_{yyyy-MM-dd} |  | userId | string | Owner UID |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | date | date | Day key YYYY-MM-DD |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | updatedAt | timestamp | Last update timestamp |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | water | map | Hydration block |
| dailyLogs | {userId}_{yyyy-MM-dd} | water | current | number | Current glasses/cups |
| dailyLogs | {userId}_{yyyy-MM-dd} | water | max | number | Daily water target |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | steps | map | Step tracking block |
| dailyLogs | {userId}_{yyyy-MM-dd} | steps | count | number | Current steps |
| dailyLogs | {userId}_{yyyy-MM-dd} | steps | goal | number | Step goal |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | mood | map | Mood block |
| dailyLogs | {userId}_{yyyy-MM-dd} | mood | index | number | Mood index 0..4 |
| dailyLogs | {userId}_{yyyy-MM-dd} | mood | label | string | Mood label great/good/neutral/sad/angry |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | sleep | map | Sleep block |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | bedtime | timestamp | Sleep start |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | wakeTime | timestamp | Wake time |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | durationMinutes | number | Sleep duration in minutes |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | source | string | manual/accelerometer/estimated |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | quality | string | Qualitative sleep rating |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | qualityScore | number | Computed sleep score |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | notes | string | Free-form sleep notes |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep | stages | array | Sleep stages list |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep.stages[] | type | string | Stage type |
| dailyLogs | {userId}_{yyyy-MM-dd} | sleep.stages[] | minutes | number | Stage duration in minutes |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | journal | map | Journal daily aggregate |
| dailyLogs | {userId}_{yyyy-MM-dd} | journal | entryCount | number | Number of journal entries that day |
| dailyLogs | {userId}_{yyyy-MM-dd} | journal | wordCount | number | Word count across entries |
| dailyLogs | {userId}_{yyyy-MM-dd} | journal | journaled | boolean | Whether any entry exists |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | medications | map | Medication adherence block |
| dailyLogs | {userId}_{yyyy-MM-dd} | medications | due | number | Meds due today |
| dailyLogs | {userId}_{yyyy-MM-dd} | medications | taken | number | Meds taken today |
| dailyLogs | {userId}_{yyyy-MM-dd} | medications | adherenceRate | number | taken/due ratio |
| dailyLogs | {userId}_{yyyy-MM-dd} | medications | items | array | Medication item states |
| dailyLogs | {userId}_{yyyy-MM-dd} | medications.items[] | name | string | Medication name |
| dailyLogs | {userId}_{yyyy-MM-dd} | medications.items[] | taken | boolean | Taken state |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | nutrition | map | Nutrition aggregate block |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.calories | total | number | Consumed calories |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.calories | max | number | Calorie goal |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.burned | current | number | Burned calories current |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.burned | max | number | Burned calories goal |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.macros.carbs | current | number | Carbs current |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.macros.carbs | max | number | Carbs goal |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.macros.protein | current | number | Protein current |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.macros.protein | max | number | Protein goal |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.macros.fat | current | number | Fat current |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.macros.fat | max | number | Fat goal |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition | meals | map | Per-period meals map keyed by period index |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{0\|1\|2\|3} | [] | array | Meal entries per period |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | id | string | Meal entry id |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | title | string | Meal title/description |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | kcal | number | Calories |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | createdAt | date | ISO date-time string |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | imageUrl | string | Uploaded meal image URL |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | imageBase64 | string | Base64 image (present in some writes) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | source | number | FoodSource enum index |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | barcode | string | Optional barcode |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | recipeId | string | Optional linked recipe ID |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | servings | number | Serving multiplier |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | nutrition | map | Detailed nutrients |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | kcal | number | Calories |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | carbsG | number | Carbs grams |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | proteinG | number | Protein grams |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | fatG | number | Fat grams |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | fiberG | number | Fiber grams (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | sugarG | number | Sugar grams (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | sodiumMg | number | Sodium mg (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | saturatedFatG | number | Saturated fat grams (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | servingSize | string | Serving size label (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | servingWeight | number | Serving weight (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | vitaminAUg/vitaminCMg/vitaminDUg/vitaminEMg/vitaminKUg | number | Vitamin micronutrients (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | vitaminB1Mg/vitaminB2Mg/vitaminB6Mg/vitaminB12Ug/folateUg | number | B vitamins + folate (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[].nutrition | calciumMg/ironMg/magnesiumMg/zincMg/potassiumMg/phosphorusMg/seleniumUg | number | Minerals (optional) |
| dailyLogs | {userId}_{yyyy-MM-dd} |  | workouts | array | Snapshot of workouts scheduled for the date |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | planId | string | Training plan ID |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | planName | string | Training plan name |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | time | string | Scheduled time HH:mm |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | exercisesTotal | number | Exercise count |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | exercisesDone | number | Completed exercises count |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | completed | boolean | Whether workout completed |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | estimatedKcal | number | Workout kcal estimate |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[] | exercises | array | Exercise snapshots |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | exerciseId | string | Exercise ID |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | name | string | Exercise name |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | mode | string | reps or time |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | sets | number | Sets count |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | reps | number | Reps count |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | durationSeconds | number | Time mode duration |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | completed | boolean | Completion state for date |
| dailyLogs | {userId}_{yyyy-MM-dd} | workouts[].exercises[] | estimatedKcal | number | Exercise kcal estimate |

## Journal

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| journalEntries | {entryId} |  | userId | string | Owner UID |
| journalEntries | {entryId} |  | content | string | Quill Delta JSON string |
| journalEntries | {entryId} |  | date | string | Display date string (dd. MMMM yyyy) |
| journalEntries | {entryId} |  | createdAt | timestamp | Creation timestamp |
| journalEntries | {entryId} |  | isLocked | boolean | Entry lock state |
| journalEntries | {entryId} |  | passwordHash | string | SHA-256 hash when locked |
| journalTemplates | {templateId} |  | userId | string | Owner UID |
| journalTemplates | {templateId} |  | title | string | Template title/prompt |
| journalTemplates | {templateId} |  | bodyDelta | string | Quill Delta JSON string |
| journalTemplates | {templateId} |  | createdAt | timestamp | Template creation timestamp |

## AI Chat

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| aiChats | {chatId} |  | userId | string | Owner UID |
| aiChats | {chatId} |  | title | string | Chat title |
| aiChats | {chatId} |  | lastMessage | string | Last message preview |
| aiChats | {chatId} |  | createdAt | timestamp | Creation timestamp |
| aiChats | {chatId} |  | updatedAt | timestamp | Last update timestamp |
| aiChats/{chatId}/messages | {messageId} |  | role | string | user or ai |
| aiChats/{chatId}/messages | {messageId} |  | text | string | Message text |
| aiChats/{chatId}/messages | {messageId} |  | createdAt | timestamp | Message timestamp |
| aiChats/{chatId}/messages | {messageId} |  | functionResult | string | Function execution summary text |
| aiChats/{chatId}/messages | {messageId} |  | structuredData | map | Rich UI payload for cards |
| aiChats/{chatId}/messages | {messageId} |  | options | array | Choices for ask_user cards |
| aiChats/{chatId}/messages | {messageId} |  | allowOther | boolean | Allow free-text option |
| aiChats/{chatId}/messages | {messageId} |  | optionsAnswered | boolean | Whether options were answered |
| aiChats/{chatId}/messages | {messageId} |  | isPending | boolean | Pending write proposal state |
| aiChats/{chatId}/messages | {messageId} |  | pendingFunctionName | string | Function awaiting confirm/discard |
| aiChats/{chatId}/messages | {messageId} |  | pendingArgs | map | Arguments for pending write |

## Friends

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| friendRequests | {requestId} |  | fromUid | string | Sender UID |
| friendRequests | {requestId} |  | toUid | string | Recipient UID |
| friendRequests | {requestId} |  | fromDisplayName | string | Sender display name snapshot |
| friendRequests | {requestId} |  | toDisplayName | string | Recipient display name snapshot |
| friendRequests | {requestId} |  | status | string | pending/accepted/declined |
| friendRequests | {requestId} |  | createdAt | timestamp | Request creation time |
| friendRequests | {requestId} |  | respondedAt | timestamp | Accept/decline time |
| friendships | {uid1}_{uid2} |  | users | array | Sorted UID pair |
| friendships | {uid1}_{uid2} |  | createdAt | timestamp | Friendship creation time |
| friendships | {uid1}_{uid2} |  | {uid}_nickname | string | Per-user nickname field (dynamic key) |
| nudges | {nudgeId} |  | fromUid | string | Sender UID |
| nudges | {nudgeId} |  | toUid | string | Recipient UID |
| nudges | {nudgeId} |  | fromDisplayName | string | Sender display name snapshot |
| nudges | {nudgeId} |  | createdAt | timestamp | Nudge creation time |
| nudges | {nudgeId} |  | seen | boolean | Read state |
| activitySnapshots | {userId} |  | displayName | string | Display name for social cards |
| activitySnapshots | {userId} |  | photoUrl | string | Profile image URL |
| activitySnapshots | {userId} |  | friendCode | string | Friend code snapshot |
| activitySnapshots | {userId} |  | lastActiveAt | timestamp | Last activity timestamp |
| activitySnapshots | {userId} |  | currentStreak | number | Current streak days |
| activitySnapshots | {userId} |  | todayCalories | number | Today calories snapshot |
| activitySnapshots | {userId} |  | todaySteps | number | Today steps snapshot |
| activitySnapshots | {userId} |  | todayWater | map | Today water snapshot |
| activitySnapshots | {userId} | todayWater | current | number | Current water value |
| activitySnapshots | {userId} | todayWater | max | number | Water goal |

## Training

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| trainingPlans | {planId} |  | userId | string | Owner UID |
| trainingPlans | {planId} |  | name | string | Plan name |
| trainingPlans | {planId} |  | image | string | Optional image URL/path |
| trainingPlans | {planId} |  | colorHex | string | Signup-created plan color |
| trainingPlans | {planId} |  | programName | string | Parent program name for multi-plan creation |
| trainingPlans | {planId} |  | dayPattern | string | Human-readable split/day pattern |
| trainingPlans | {planId} |  | isFromSignup | boolean | Created by signup flow |
| trainingPlans | {planId} |  | setupEnabled | boolean | Quick-workout flag from sport page |
| trainingPlans | {planId} |  | createdAt | timestamp | Plan creation timestamp |
| trainingPlans | {planId} |  | schedule | map | Scheduling block (new schema) |
| trainingPlans | {planId} | schedule | date | date | Anchor date YYYY-MM-DD |
| trainingPlans | {planId} | schedule | time | string | Planned time HH:mm |
| trainingPlans | {planId} | schedule | repeat | map | Repeat config block |
| trainingPlans | {planId} | schedule.repeat | enabled | boolean | Repeat enabled flag |
| trainingPlans | {planId} | schedule.repeat | days | array | Weekday numbers for custom repeat |
| trainingPlans | {planId} | schedule.repeat | type | string | none/daily/custom |
| trainingPlans | {planId} | schedule.repeat | until | date | Optional end date |
| trainingPlans | {planId} | schedule | type | string | Legacy schedule type from signup seed plans |
| trainingPlans | {planId} | schedule | days | array | Legacy weekday list from signup seed plans |
| trainingPlans | {planId} |  | summary | map | Computed summary block |
| trainingPlans | {planId} | summary | estimatedKcal | number | Estimated total kcal |
| trainingPlans | {planId} | summary | estimatedActiveSeconds | number | Estimated active seconds |
| trainingPlans | {planId} | summary | updatedAt | timestamp | Summary update timestamp |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | exerciseId | string | Canonical exercise id |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | name | string | Exercise name |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | mode | string | reps/time |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | sets | number | Set count |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | reps | number | Reps per set |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | durationSeconds | number | Seconds per set in time mode |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | restAfterSeconds | number | Rest after exercise |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | order | number | Ordering index |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | bodyPart | string | Optional body part |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | target | string | Optional target muscle |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | equipment | string | Optional equipment |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | estimatedKcal | number | Estimated kcal |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | estimatedActiveSeconds | number | Estimated active seconds |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | completedDates | array | YYYY-MM-DD dates marked complete |
| trainingPlans/{planId}/exercises | {exerciseRowId} |  | completed | boolean | Legacy completion bool (deleted on updates) |

## Foods

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| users | {userId} |  | mealPresets | array | Meal presets are stored inside user document |
| users | {userId} | mealPresets[] | id | string | Preset ID |
| users | {userId} | mealPresets[] | name | string | Preset name |
| users | {userId} | mealPresets[] | kcal | number | Preset calories |
| users | {userId} | mealPresets[] | period | number | MealPeriod enum index |
| users | {userId} | mealPresets[] | deleted | boolean | Soft delete marker |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | source | number | Food source enum (manual/search/ai/recipe) |
| dailyLogs | {userId}_{yyyy-MM-dd} | nutrition.meals.{period}[] | barcode | string | Optional barcode on meal entry |

## Recipes

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| users/{userId}/recipes | {recipeId} |  | id | string | Recipe id (also document id) |
| users/{userId}/recipes | {recipeId} |  | name | string | Recipe name |
| users/{userId}/recipes | {recipeId} |  | description | string | Recipe description |
| users/{userId}/recipes | {recipeId} |  | imageUrl | string | Uploaded image URL |
| users/{userId}/recipes | {recipeId} |  | instructions | string | Cooking instructions text |
| users/{userId}/recipes | {recipeId} |  | servings | number | Number of servings |
| users/{userId}/recipes | {recipeId} |  | prepTimeMinutes | number | Prep time minutes |
| users/{userId}/recipes | {recipeId} |  | cookTimeMinutes | number | Cook time minutes |
| users/{userId}/recipes | {recipeId} |  | tags | array | Tag strings |
| users/{userId}/recipes | {recipeId} |  | createdAt | date | ISO date-time string |
| users/{userId}/recipes | {recipeId} |  | updatedAt | date | ISO date-time string |
| users/{userId}/recipes | {recipeId} |  | ingredients | array | Ingredient list |
| users/{userId}/recipes | {recipeId} | ingredients[] | id | string | Ingredient id |
| users/{userId}/recipes | {recipeId} | ingredients[] | name | string | Ingredient name |
| users/{userId}/recipes | {recipeId} | ingredients[] | quantity | number | Ingredient amount |
| users/{userId}/recipes | {recipeId} | ingredients[] | unit | string | Ingredient unit |
| users/{userId}/recipes | {recipeId} | ingredients[] | barcode | string | Optional barcode |
| users/{userId}/recipes | {recipeId} | ingredients[] | nutrition | map | Ingredient nutrient block |
| users/{userId}/recipes | {recipeId} | ingredients[].nutrition | kcal/carbsG/proteinG/fatG | number | Macro nutrients |
| users/{userId}/recipes | {recipeId} | ingredients[].nutrition | vitamin* / mineral* | number | Optional micro nutrients |

## FridgeShopping

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| users/{userId}/fridge | {itemId} |  | id | string | Item id (also doc id) |
| users/{userId}/fridge | {itemId} |  | title | string | Item name/title |
| users/{userId}/fridge | {itemId} |  | quantity | number | Current quantity |
| users/{userId}/fridge | {itemId} |  | unit | string | Unit label |
| users/{userId}/fridge | {itemId} |  | category | number | ItemCategory enum index |
| users/{userId}/fridge | {itemId} |  | addedAt | date | ISO date-time string |
| users/{userId}/fridge | {itemId} |  | expiresAt | date | ISO date-time string |
| users/{userId}/fridge | {itemId} |  | barcode | string | Optional barcode |
| users/{userId}/fridge | {itemId} |  | notes | string | Optional notes |
| users/{userId}/fridge | {itemId} |  | shoppingItemId | string | Source shopping item id |
| users/{userId}/fridge | {itemId} |  | nutrition | map | Optional nutrition block |
| users/{userId}/fridge | {itemId} | nutrition | kcal/carbsG/proteinG/fatG | number | Macro nutrients |
| users/{userId}/fridge | {itemId} | nutrition | vitamin* / mineral* | number | Optional micro nutrients |

## Medications

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| users/{userId}/medications | {medId} |  | id | string | Medication id (also doc id) |
| users/{userId}/medications | {medId} |  | name | string | Medication name |
| users/{userId}/medications | {medId} |  | iconCodePoint | number | Icon code point |
| users/{userId}/medications | {medId} |  | iconColor | number | Icon color int |
| users/{userId}/medications | {medId} |  | timeHour | number | Hour in local time |
| users/{userId}/medications | {medId} |  | timeMinute | number | Minute in local time |
| users/{userId}/medications | {medId} |  | schedule | number | MedSchedule enum index |
| users/{userId}/medications | {medId} |  | weekdays | array | Weekdays for weekly schedule |
| users/{userId}/medications | {medId} |  | monthDays | array | Month days for monthly schedule |
| users/{userId}/medications | {medId} |  | intervalDays | number | Interval in days |
| users/{userId}/medications | {medId} |  | intervalStartDate | date | Anchor date YYYY-MM-DD |
| users/{userId}/medications | {medId} |  | takenDates | array | Taken day keys YYYY-MM-DD |
| users/{userId}/medications | {autoId} |  | dosage | string | Initial profile import field |
| users/{userId}/medications | {autoId} |  | frequency | string | Initial profile import field |
| users/{userId}/allergies | {allergyId} |  | name | string | Allergy / diet restriction name |

## UserData (Todos & Shopping)

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| userData | {userId}_{yyyy-MM-dd} |  | todos | array | Todo items for the day |
| userData | {userId}_{yyyy-MM-dd} | todos[] | id | string | Todo item id |
| userData | {userId}_{yyyy-MM-dd} | todos[] | title | string | Todo title |
| userData | {userId}_{yyyy-MM-dd} | todos[] | done | boolean | Completion state |
| userData | {userId}_{yyyy-MM-dd} | todos[] | dueAt | timestamp | Optional due date |
| userData | {userId}_{yyyy-MM-dd} |  | todosUpdatedAt | timestamp | Server timestamp of last todos sync |
| userData | {userId}_{yyyy-MM-dd} |  | shoppingList | array | Shopping list items for the day |
| userData | {userId}_{yyyy-MM-dd} | shoppingList[] | id | string | Shopping item id |
| userData | {userId}_{yyyy-MM-dd} | shoppingList[] | title | string | Item name |
| userData | {userId}_{yyyy-MM-dd} | shoppingList[] | quantity | number | Item quantity |
| userData | {userId}_{yyyy-MM-dd} | shoppingList[] | done | boolean | Purchased state |
| userData | {userId}_{yyyy-MM-dd} | shoppingList[] | category | number | ItemCategory enum index |
| userData | {userId}_{yyyy-MM-dd} | shoppingList[] | notes | string | Optional notes |
| userData | {userId}_{yyyy-MM-dd} |  | shoppingListUpdatedAt | timestamp | Server timestamp of last shopping sync |

## Exercise Metadata

| collection | documentId | map | field | type | description |
|---|---|---|---|---|---|
| exercises_meta | {docId} |  | — | — | Exercise metadata collection (used by exercise search) |
