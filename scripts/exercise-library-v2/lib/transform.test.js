'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildExerciseDoc } = require('./transform');

const RAW = {
  exerciseId: 'edb_x', name: 'dumbbell front raise ',
  bodyParts: ['upper arms'], targetMuscles: ['biceps'], equipments: ['dumbbell'],
  secondaryMuscles: ['forearms'], instructions: ['Step:1 Do it.', 'Step:2 Again.'],
  overview: 'ov', difficulty: 'beginner', exerciseTypes: ['strength'],
  gifUrls: { '720p': 'AAA.gif' }, relatedExerciseIds: ['edb_y'],
};

test('buildExerciseDoc maps singular fields + cleans + adds media/i18n', () => {
  const doc = buildExerciseDoc(RAW, { gifUrl: 'g', thumbUrl: 't' }, { name: 'Frontheben', overview: 'üb', instructions: ['Mach es.'] });
  assert.strictEqual(doc.name, 'dumbbell front raise');
  assert.strictEqual(doc.nameLower, 'dumbbell front raise');
  assert.strictEqual(doc.displayName, 'Dumbbell Front Raise');
  assert.strictEqual(doc.bodyPart, 'upper arms');
  assert.strictEqual(doc.target, 'biceps');
  assert.strictEqual(doc.equipment, 'dumbbell');
  assert.deepStrictEqual(doc.instructions, ['Do it.', 'Again.']);
  assert.strictEqual(doc.gifUrl, 'g');
  assert.strictEqual(doc.thumbUrl, 't');
  assert.deepStrictEqual(doc.i18n.de, { name: 'Frontheben', overview: 'üb', instructions: ['Mach es.'] });
  assert.deepStrictEqual(doc.relatedExerciseIds, ['edb_y']);
});

test('buildExerciseDoc omits i18n when no translation', () => {
  const doc = buildExerciseDoc(RAW, {}, null);
  assert.strictEqual(doc.i18n, undefined);
  assert.strictEqual(doc.gifUrl, '');
});
