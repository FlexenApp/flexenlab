// scripts/seed_data.js
// Example training plan seed data for userId 'flexen'.
// Dates: today (2026-02-18), tomorrow, day after.
// Mix of 'reps' and 'time' mode exercises.
// estimatedKcal formula: MET(5.0) * 3.5 * 83.5kg / 200 * activeMinutes

const TODAY      = '2026-02-18';
const TOMORROW   = '2026-02-19';
const DAY_AFTER  = '2026-02-20';

const plans = [
  // ──────────────────────────────────────────────────────────────
  // PLAN 1: Push Day  (chest · shoulders · triceps)  → TODAY
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Push Day',
    image: 'default.png',
    setupEnabled: true,
    schedule: {
      date: TODAY,
      time: '08:00',
      repeat: { enabled: false, days: [], type: 'none', until: null },
    },
    summary: { estimatedKcal: 220, estimatedActiveSeconds: 1320 },
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        mode: 'reps',
        sets: 4, reps: 8, durationSeconds: null,
        restAfterSeconds: 120,
        bodyPart: 'chest', target: 'pectorals', equipment: 'barbell',
        estimatedKcal: 42.0, estimatedActiveSeconds: 128, completed: false,
      },
      {
        exerciseId: 'incline-dumbbell-press',
        name: 'Incline Dumbbell Press',
        mode: 'reps',
        sets: 3, reps: 10, durationSeconds: null,
        restAfterSeconds: 90,
        bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell',
        estimatedKcal: 29.0, estimatedActiveSeconds: 120, completed: false,
      },
      {
        exerciseId: 'overhead-press',
        name: 'Overhead Press',
        mode: 'reps',
        sets: 4, reps: 8, durationSeconds: null,
        restAfterSeconds: 120,
        bodyPart: 'shoulders', target: 'delts', equipment: 'barbell',
        estimatedKcal: 38.0, estimatedActiveSeconds: 128, completed: false,
      },
      {
        exerciseId: 'lateral-raises',
        name: 'Lateral Raises',
        mode: 'reps',
        sets: 3, reps: 15, durationSeconds: null,
        restAfterSeconds: 60,
        bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell',
        estimatedKcal: 22.0, estimatedActiveSeconds: 180, completed: false,
      },
      {
        exerciseId: 'tricep-pushdown',
        name: 'Tricep Pushdown',
        mode: 'reps',
        sets: 3, reps: 12, durationSeconds: null,
        restAfterSeconds: 60,
        bodyPart: 'upper arms', target: 'triceps', equipment: 'cable',
        estimatedKcal: 21.0, estimatedActiveSeconds: 144, completed: false,
      },
      {
        exerciseId: 'plank',
        name: 'Plank Hold',
        mode: 'time',
        sets: 3, reps: 0, durationSeconds: 60,
        restAfterSeconds: 60,
        bodyPart: 'waist', target: 'abs', equipment: 'body weight',
        estimatedKcal: 18.0, estimatedActiveSeconds: 180, completed: false,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // PLAN 2: Pull Day  (back · biceps)  → TOMORROW
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Pull Day',
    image: 'default.png',
    setupEnabled: true,
    schedule: {
      date: TOMORROW,
      time: '08:00',
      repeat: { enabled: false, days: [], type: 'none', until: null },
    },
    summary: { estimatedKcal: 195, estimatedActiveSeconds: 1260 },
    exercises: [
      {
        exerciseId: 'pull-up',
        name: 'Pull-Ups',
        mode: 'reps',
        sets: 4, reps: 6, durationSeconds: null,
        restAfterSeconds: 120,
        bodyPart: 'back', target: 'lats', equipment: 'body weight',
        estimatedKcal: 29.0, estimatedActiveSeconds: 96, completed: false,
      },
      {
        exerciseId: 'barbell-row',
        name: 'Barbell Bent-Over Row',
        mode: 'reps',
        sets: 4, reps: 8, durationSeconds: null,
        restAfterSeconds: 120,
        bodyPart: 'back', target: 'lats', equipment: 'barbell',
        estimatedKcal: 38.0, estimatedActiveSeconds: 128, completed: false,
      },
      {
        exerciseId: 'lat-pulldown',
        name: 'Lat Pulldown',
        mode: 'reps',
        sets: 3, reps: 12, durationSeconds: null,
        restAfterSeconds: 90,
        bodyPart: 'back', target: 'lats', equipment: 'cable',
        estimatedKcal: 29.0, estimatedActiveSeconds: 144, completed: false,
      },
      {
        exerciseId: 'face-pull',
        name: 'Face Pulls',
        mode: 'reps',
        sets: 3, reps: 15, durationSeconds: null,
        restAfterSeconds: 60,
        bodyPart: 'back', target: 'traps', equipment: 'cable',
        estimatedKcal: 22.0, estimatedActiveSeconds: 180, completed: false,
      },
      {
        exerciseId: 'dumbbell-curl',
        name: 'Dumbbell Bicep Curl',
        mode: 'reps',
        sets: 3, reps: 12, durationSeconds: null,
        restAfterSeconds: 60,
        bodyPart: 'upper arms', target: 'biceps', equipment: 'dumbbell',
        estimatedKcal: 21.0, estimatedActiveSeconds: 144, completed: false,
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // PLAN 3: Leg Day  (quads · hamstrings · glutes)  → DAY_AFTER
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Leg Day',
    image: 'default.png',
    setupEnabled: true,
    schedule: {
      date: DAY_AFTER,
      time: '09:00',
      repeat: { enabled: false, days: [], type: 'none', until: null },
    },
    summary: { estimatedKcal: 310, estimatedActiveSeconds: 1860 },
    exercises: [
      {
        exerciseId: 'barbell-squat',
        name: 'Barbell Back Squat',
        mode: 'reps',
        sets: 4, reps: 8, durationSeconds: null,
        restAfterSeconds: 180,
        bodyPart: 'upper legs', target: 'quads', equipment: 'barbell',
        estimatedKcal: 56.0, estimatedActiveSeconds: 128, completed: false,
      },
      {
        exerciseId: 'romanian-deadlift',
        name: 'Romanian Deadlift',
        mode: 'reps',
        sets: 4, reps: 10, durationSeconds: null,
        restAfterSeconds: 120,
        bodyPart: 'upper legs', target: 'hamstrings', equipment: 'barbell',
        estimatedKcal: 52.0, estimatedActiveSeconds: 160, completed: false,
      },
      {
        exerciseId: 'leg-press',
        name: 'Leg Press',
        mode: 'reps',
        sets: 3, reps: 12, durationSeconds: null,
        restAfterSeconds: 120,
        bodyPart: 'upper legs', target: 'quads', equipment: 'leverage machine',
        estimatedKcal: 43.0, estimatedActiveSeconds: 144, completed: false,
      },
      {
        exerciseId: 'hip-thrust',
        name: 'Hip Thrust',
        mode: 'reps',
        sets: 3, reps: 12, durationSeconds: null,
        restAfterSeconds: 90,
        bodyPart: 'upper legs', target: 'glutes', equipment: 'barbell',
        estimatedKcal: 38.0, estimatedActiveSeconds: 144, completed: false,
      },
      {
        exerciseId: 'leg-curl',
        name: 'Seated Leg Curl',
        mode: 'reps',
        sets: 3, reps: 15, durationSeconds: null,
        restAfterSeconds: 60,
        bodyPart: 'upper legs', target: 'hamstrings', equipment: 'leverage machine',
        estimatedKcal: 33.0, estimatedActiveSeconds: 180, completed: false,
      },
      {
        exerciseId: 'wall-sit',
        name: 'Wall Sit',
        mode: 'time',
        sets: 3, reps: 0, durationSeconds: 45,
        restAfterSeconds: 60,
        bodyPart: 'upper legs', target: 'quads', equipment: 'body weight',
        estimatedKcal: 18.0, estimatedActiveSeconds: 135, completed: false,
      },
    ],
  },
];

// Exercises are now seeded separately via seed_exercises.js (ExerciseDB dataset).

module.exports = { plans };
