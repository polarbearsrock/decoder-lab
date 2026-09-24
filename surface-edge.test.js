/* Run with: node surface-edge.test.js
 * Mechanism checks for worked examples 16–24 and their one-qubit neighbors.
 * Independent bit masks, check incidence, and cut parity validate the returned
 * witnesses without using the model's xor, syndrome, or decomposition helpers.
 */
'use strict';
const assert = require('node:assert/strict');
require('./model.js');
require('./surface-model.js');
require('./surface-confidence.js');
const M = globalThis.__surfaceModel, F = globalThis.__surfaceConfidence;
const patch = M.makePatch(5);
const bit = q => 1n << BigInt(q);
const mask = ids => ids.reduce((value, q) => value ^ bit(q), 0n);
const weight = value => { let total = 0; for (; value; value &= value - 1n) total++; return total; };
const checkIncidence = patch.nodes.map(v => v.boundary ? 0n : mask(patch.edges.filter(e => e.a === v.id || e.b === v.id).map(e => e.id)));
const syndrome = value => checkIncidence.map(row => weight(value & row) % 2);
const logicalCut = mask(patch.logicalX);
const logical = value => weight(value & logicalCut) % 2;
const L = mask(patch.logicalZ);
const definitions = new Map(M.examples(patch).map(example => [example.id, example]));
const ids = ['likelihood-crossover', 'likelihood-companion', 'perturb-before', 'perturb-after', 'all-checks', 'boundary-fronts', 'delayed-reactivation', 'equal-weight-success', 'equal-weight-failure'];
let decoderChecks = 0, neighborChecks = 0;

function validate(decoded) {
  decoderChecks++;
  const E = mask(decoded.error), C = mask(decoded.correction), R = E ^ C;
  assert.deepEqual(syndrome(E), decoded.observed, 'measured check incidence');
  assert.deepEqual(syndrome(C), decoded.observed, 'correction matches every measured check');
  assert.equal(mask(decoded.residual), R, 'reported residual is E xor C');
  assert.equal(syndrome(R).some(Boolean), false, 'completed residual has zero syndrome');
  assert.equal(decoded.result.logical, logical(R), 'logical outcome matches an independent cut intersection');
  const witness = decoded.result.stabilizers.reduce((support, index) => support ^ mask(patch.faces[index].edges), decoded.result.logical ? L : 0n);
  assert.equal(witness, R, 'reported stabilizer witness reconstructs the exact physical residual');
  for (const frame of decoded.trace.frames.filter(frame => !frame.micro)) {
    assert.deepEqual(syndrome(E ^ mask(frame.correction)), frame.bits, 'partial correction retains the documented syndrome');
  }
  return decoded;
}
function decode(id, strategy = 'bfs') {
  assert.ok(definitions.has(id), `missing worked example ${id}`);
  return validate(M.decode(patch, definitions.get(id).error, strategy));
}
const cases = Object.fromEntries(ids.map(id => [id, decode(id)]));

// The crossover example is a wrong logical recovery even though UF selects
// the unique global minimum. Its paired case has identical observable input.
const crossover = cases['likelihood-crossover'];
assert.equal(mask(crossover.residual), L ^ mask(patch.faces[19].edges), 'CE = Zbar S20');
const reference = M.minimumCorrections(patch, crossover.observed);
const ufClass = logical(mask(crossover.correction));
assert.equal(reference.sectors[ufClass].weight, crossover.correction.length);
assert.equal(reference.sectors[ufClass].count, '1');
assert.equal(reference.sectors[ufClass ^ 1].weight, crossover.correction.length + 1);
assert.equal(reference.sectors[ufClass ^ 1].count, '8');
const spectrum = F.spectrum(patch, crossover.observed);
assert.ok(F.posterior(spectrum, .10, ufClass).ufSuccessProbability > .5);
assert.ok(F.posterior(spectrum, .15, ufClass).ufSuccessProbability < .5);
assert.equal(mask(cases['likelihood-companion'].residual), 0n, 'same-syndrome companion is exact recovery');

// Syndrome-based decoding must not leak knowledge of the selected actual E.
// Verify complete traces, not only final corrections, across all strategies.
for (const [first, second] of [['likelihood-crossover', 'likelihood-companion'], ['equal-weight-success', 'equal-weight-failure']]) {
  for (const strategy of ['bfs', 'reverse-bfs', 'dfs']) {
    const a = decode(first, strategy), b = decode(second, strategy);
    assert.deepEqual(a.observed, b.observed);
    assert.deepEqual(a.trace, b.trace, `${strategy} must depend only on the syndrome`);
    assert.equal(a.result.logical ^ b.result.logical, 1, 'indistinguishable errors have opposite actual outcomes');
    const difference = mask(a.error) ^ mask(b.error);
    assert.equal(syndrome(difference).some(Boolean), false);
    assert.equal(logical(difference), 1, 'the error pair differs by a nontrivial zero-syndrome operator');
  }
}
const equalSuccess = cases['equal-weight-success'], equalFailure = cases['equal-weight-failure'];
assert.equal(equalSuccess.error.length, equalFailure.error.length);
assert.equal(equalSuccess.observed.filter(Boolean).length, 9);
assert.equal(mask(equalSuccess.residual), mask(patch.faces[11].edges), 'CE = S12');
assert.equal(mask(equalFailure.residual), L ^ mask(patch.faces[9].edges), 'CE = Zbar S10');
assert.equal(decode('equal-weight-success', 'dfs').result.logical, 1);
assert.equal(decode('equal-weight-failure', 'dfs').result.logical, 0);

// One added fault changes a nonlocal correction and improves this selected
// shot. These assertions make no inference about an average error rate.
const before = cases['perturb-before'], after = cases['perturb-after'];
assert.equal(mask(before.error) ^ mask(after.error), bit(16));
assert.equal(logical(mask(before.error)), logical(mask(after.error)), 'q16 does not cross the fixed logical cut');
assert.equal(before.result.logical, 1);
assert.equal(after.result.logical, 0);
assert.equal(before.correction.length - after.correction.length, 1);
assert.equal(weight(mask(before.correction) ^ mask(after.correction)), 5);
assert.equal(mask(after.residual), mask(patch.faces[16].edges), 'improved shot leaves S17');
const beforeGrown = M.minimumCorrections(patch, before.observed, before.trace.fullEdges);
assert.equal(beforeGrown.sectors[logical(mask(before.error))].weight, null, 'old growth excludes every successful correction');

// A maximally dense measured syndrome can grow for fewer ticks than a much
// sparser example. This checks algorithmic growth ticks, not wall-clock time.
const dense = cases['all-checks'];
assert.equal(dense.observed.filter(Boolean).length, checkIncidence.filter(Boolean).length);
assert.equal(Math.max(...dense.trace.frames.map(frame => frame.tick)), 1);
assert.equal(dense.result.logical, 0);
assert.equal(dense.correction.length * 2, dense.observed.filter(Boolean).length, 'correction saturates the two-defects-per-edge lower bound');
const denseReference = M.minimumCorrections(patch, dense.observed);
assert.deepEqual(denseReference.sectors.map(sector => [sector.weight, sector.count]), [[10, '95'], [11, '323']]);

// The same boundary-root set permits different peeling costs. Each forest
// tree has at most one unconstrained boundary root, independently checked by
// traversing its physical edges; the grown regions touch different sides.
const boundaryBfs = cases['boundary-fronts'], boundaryDfs = decode('boundary-fronts', 'dfs');
assert.deepEqual(boundaryBfs.trace.fullEdges, boundaryDfs.trace.fullEdges);
assert.equal(boundaryBfs.correction.length, 10);
assert.equal(boundaryDfs.correction.length, 6);
assert.equal(boundaryBfs.result.logical, 0);
assert.equal(boundaryDfs.result.logical, 0);
const forestFrame = decoded => decoded.trace.frames.find(frame => frame.phase === 'forest');
assert.deepEqual(forestFrame(boundaryBfs).peelRoots, forestFrame(boundaryDfs).peelRoots);
assert.equal(forestFrame(boundaryBfs).peelRoots.length, 10);
for (const decoded of [boundaryBfs, boundaryDfs]) {
  const adjacency = patch.nodes.map(() => []);
  for (const id of decoded.trace.forest) { const edge = patch.edges[id]; adjacency[edge.a].push(edge.b); adjacency[edge.b].push(edge.a); }
  const seen = new Set();
  for (const node of patch.nodes) {
    if (seen.has(node.id)) continue;
    const queue = [node.id]; seen.add(node.id);
    for (let i = 0; i < queue.length; i++) for (const next of adjacency[queue[i]]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    assert.ok(queue.filter(id => patch.nodes[id].boundary).length <= 1, 'a selected tree must not connect two unconstrained roots');
  }
}
const boundaryGroups = forestFrame(boundaryBfs).groups;
assert.equal(boundaryGroups.length, 2);
assert.deepEqual(boundaryGroups.map(group => [...new Set(group.members.filter(id => patch.nodes[id].boundary).map(id => patch.nodes[id].col))]).sort((a,b) => a[0] - b[0]), [[0], [patch.d]]);

// Test an actual inactive interval, not just the trace's `reactivated` flag.
// BD is even after tick1, contributes no endpoint growth during tick2, then
// absorbs A at tick3 and contributes new growth on tick4.
const delayed = cases['delayed-reactivation'];
const frameAt = (tick, action) => delayed.trace.frames.find(frame => !frame.micro && frame.tick === tick && frame.action === action);
const merge1 = frameAt(1, 'merge'), grow2 = frameAt(2, 'growth'), merge2 = frameAt(2, 'merge'), merge3 = frameAt(3, 'merge'), grow4 = frameAt(4, 'growth');
const bd = merge1.groups.find(group => group.label === 'BD');
assert.ok(bd && bd.count === 2 && !bd.boundary && !bd.active, 'BD is a non-boundary even cluster after tick1');
const bd2 = merge2.groups.find(group => group.members.includes(bd.members[0]));
assert.deepEqual(bd2.members, bd.members, 'BD remains unchanged through tick2');
assert.equal(bd2.active, false);
for (const edge of patch.edges) for (const [side, endpoint] of [[0, edge.a], [1, edge.b]]) {
  if (bd.members.includes(endpoint)) assert.equal(grow2.support[edge.id][side], merge1.support[edge.id][side], 'inactive BD supplies no tick2 growth');
}
const abd = merge3.groups.find(group => bd.members.every(id => group.members.includes(id)));
assert.ok(abd && abd.label === 'ABD' && abd.count === 3 && abd.active && !abd.boundary);
assert.ok(patch.edges.some(edge => [[0, edge.a], [1, edge.b]].some(([side, endpoint]) => abd.members.includes(endpoint) && grow4.support[edge.id][side] > merge3.support[edge.id][side])), 'reactivated ABD supplies tick4 growth');
assert.equal(Math.max(...delayed.trace.frames.map(frame => frame.tick)), 4);
assert.equal(delayed.result.logical, 0);
assert.equal(decode('delayed-reactivation', 'dfs').result.logical, 1);
assert.equal(delayed.correction.length, 11);
assert.deepEqual(M.minimumCorrections(patch, delayed.observed).sectors.map(sector => sector.weight), [7,7]);

// Probe every one-qubit toggle around five selected mechanisms with two
// forest strategies. Reconstruct the counterfactual relation independently:
// R' xor R = q xor C' xor C. Its cut parity must equal the outcome change.
for (const id of ['likelihood-crossover', 'perturb-before', 'all-checks', 'delayed-reactivation', 'equal-weight-success']) {
  for (const strategy of ['bfs', 'dfs']) {
    const base = decode(id, strategy), neighbors = M.neighbors(patch, base, strategy);
    assert.equal(neighbors.length, patch.n);
    assert.equal(new Set(neighbors.map(neighbor => neighbor.qubit)).size, patch.n);
    for (const neighbor of neighbors) {
      neighborChecks++;
      const E = mask(neighbor.error), C = mask(neighbor.correction), change = C ^ mask(base.correction), R = E ^ C;
      assert.equal(E ^ mask(base.error), bit(neighbor.qubit), 'exactly one error qubit toggled');
      assert.equal(neighbor.operation, base.error.includes(neighbor.qubit) ? 'remove' : 'add');
      assert.deepEqual(syndrome(C), syndrome(E));
      assert.equal(neighbor.defects, syndrome(E).filter(Boolean).length);
      assert.equal(mask(neighbor.changedCorrection), change);
      assert.equal(mask(neighbor.residual), R);
      assert.equal(mask(neighbor.residualChange), bit(neighbor.qubit) ^ change);
      assert.equal(mask(neighbor.residualChange), R ^ mask(base.residual));
      assert.equal(syndrome(mask(neighbor.residualChange)).some(Boolean), false);
      assert.equal(neighbor.logical, logical(R));
      assert.equal(neighbor.outcomeChanged, logical(mask(neighbor.residualChange)) === 1);
    }
    if (id === 'perturb-before' && strategy === 'bfs') {
      const added = neighbors.find(neighbor => neighbor.qubit === 16);
      assert.equal(mask(added.error), mask(after.error));
      assert.equal(mask(added.correction), mask(after.correction));
    }
  }
}
console.log(`Passed: all nine new mechanisms; indistinguishable error pairs across three forests; q16 nonlocal correction change; dense/boundary cases; true tick3 reactivation; ${decoderChecks} decoder/witness checks and ${neighborChecks} independently checked one-qubit neighbors.`);
