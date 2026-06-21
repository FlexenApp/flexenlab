'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { fixMojibake, cleanName, toDisplayName, cleanInstructions } = require('./clean');

test('fixMojibake repairs double-encoded degree sign', () => {
  assert.strictEqual(fixMojibake('sled 45Ã‚Â° leg press'), 'sled 45° leg press');
  assert.strictEqual(fixMojibake('45Ã‚Â° side bend'), '45° side bend');
});
test('fixMojibake leaves clean strings untouched', () => {
  assert.strictEqual(fixMojibake('barbell bench press'), 'barbell bench press');
});
test('cleanName trims and strips pov/gender qualifiers', () => {
  assert.strictEqual(cleanName('dumbbell front raise '), 'dumbbell front raise');
  assert.strictEqual(cleanName('half sit-up (male)'), 'half sit-up');
  assert.strictEqual(cleanName('sled 45Ã‚Â° leg press (side pov)'), 'sled 45° leg press');
});
test('cleanName keeps real variation qualifiers', () => {
  assert.strictEqual(cleanName('archer pull up - complex variation'), 'archer pull up - complex variation');
});
test('toDisplayName title-cases with small-words and acronyms', () => {
  assert.strictEqual(toDisplayName('barbell bench press'), 'Barbell Bench Press');
  assert.strictEqual(toDisplayName('cable one arm lateral raise'), 'Cable One Arm Lateral Raise');
  assert.strictEqual(toDisplayName('incline close-grip push-up'), 'Incline Close-Grip Push-Up');
  assert.strictEqual(toDisplayName('ez bar seated close grip concentration curl'), 'EZ Bar Seated Close Grip Concentration Curl');
  assert.strictEqual(toDisplayName('reverse hyper on flat bench'), 'Reverse Hyper on Flat Bench');
});
test('cleanInstructions strips Step:N prefixes and empties', () => {
  assert.deepStrictEqual(
    cleanInstructions(['Step:1 Lie flat.', 'Step:2 Lift hips.', '']),
    ['Lie flat.', 'Lift hips.']
  );
});
