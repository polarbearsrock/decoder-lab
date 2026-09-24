/* Rebuild the research dataset from the exact shared models. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
require('./model.js');require('./surface-model.js');require('./surface-confidence.js');require('./surface-catalog.js');
const M=globalThis.__surfaceModel,C=globalThis.__surfaceCatalog,patch=M.makePatch(5);
const dataset=C.build(patch,M.examples(patch));
fs.writeFileSync(path.join(__dirname,'catalog-reference.json'),JSON.stringify(dataset)+'\n');
console.log(`Built ${dataset.summary.cases} case records; ${dataset.summary.uniqueSyndromes} distinct syndromes.`);
