'use strict';
const { cleanName, toDisplayName, cleanInstructions, fixMojibake } = require('./clean');

function buildExerciseDoc(raw, media = {}, de = null) {
  const nameClean = cleanName(raw.name);
  const doc = {
    name: nameClean,
    nameLower: nameClean.toLowerCase(),
    displayName: toDisplayName(raw.name),
    bodyPart: (raw.bodyParts || [])[0] || '',
    target: (raw.targetMuscles || [])[0] || '',
    equipment: (raw.equipments || [])[0] || '',
    secondaryMuscles: raw.secondaryMuscles || [],
    instructions: cleanInstructions(raw.instructions).map(fixMojibake),
    overview: fixMojibake(raw.overview || ''),
    difficulty: raw.difficulty || '',
    exerciseTypes: raw.exerciseTypes || [],
    relatedExerciseIds: raw.relatedExerciseIds || [],
    gifUrl: media.gifUrl || '',
    thumbUrl: media.thumbUrl || '',
  };
  if (de && de.name) {
    doc.i18n = { de: { name: de.name, overview: de.overview || '', instructions: Array.isArray(de.instructions) ? de.instructions : [] } };
  }
  return doc;
}
module.exports = { buildExerciseDoc };
