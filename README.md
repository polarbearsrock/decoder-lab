# Union-Find Decoder Lab

An interactive, self-contained teaching page for quantum error correction.

Open `index.html` in any modern browser. No installation or network access is required.

## Surface-code logical recovery

The default workspace uses a distance-5 unrotated planar CSS surface code: 41 data qubits, 20 X checks, 20 Z stabilizers, and one logical qubit. Qubits lie on edges; Z strings can terminate at the two rough boundaries. The model includes only Z errors and perfect syndrome measurements. It is one recovery round, not a circuit-level noise simulation or logical-error-rate benchmark.

Six examples cover exact cancellation, recovery up to a stabilizer, a wrong-boundary logical failure, a deformed logical string, an undetected logical string, and a boundary stabilizer. The page computes the actual error E, UF correction C, and residual CE, and solves CE = Zbar^ell times a product of Z stabilizers over GF(2). An independent logical-X intersection parity checks the result. UF receives only the syndrome.

Use the six view buttons to inspect E, the syndrome, the UF trace, C, CE, and its decomposition. Edit E by clicking qubit edges or using the selector. Multiplying E by a logical operator preserves its syndrome but changes its logical class; multiplying by a stabilizer preserves both. The exact supports and stabilizer witness are expandable.

The **UF mechanics** tab retains the original smaller graph and its detailed data structures.

## Explore

- Light, dark, and system themes with a saved preference.
- Six experiments, including custom syndromes and allowed boundaries.
- Step, play, rewind, scrub, or jump between decoder phases.
- Half-edge growth, simultaneous fusion queues, Find and Union operations.
- Parent pointers and path compression, separate from graph-based peeling.
- Residual syndrome identity checked throughout the trace.
- Breadth-first, reversed breadth-first, and depth-first forest comparisons.
- Global and grown-region exact minimum corrections for at most 12 defects.
- Pseudocode, node/edge inspection, and a detailed field guide.

Use **Theme** in the header to choose Light, Dark, or System. System follows your device appearance; explicit choices are remembered in this browser. Printing always uses the light palette.

With page focus outside a control, Left/Right changes steps and Space toggles playback.

## Original mechanics model

This is a 7-by-3 unit-cost graph with optional allowed left boundary vertices, uniform growth, union by size, path compression, and deterministic peeling. It illustrates one error type. It does not simulate logical failure probabilities or the full geometry and noise model of a physical code. The animation engine is not a performance benchmark.

The exact reference uses shortest paths and subset dynamic programming, not Blossom.

## Publish with GitHub Pages

Commit `index.html` in the root of the repository. In Settings → Pages, choose **Deploy from a branch**, then **main** and **/(root)**. The page has no server dependencies or build requirements.

## Source

`surface-model.js` constructs the CSS patch and computes the exact logical/stabilizer decomposition. `surface-app.js`, `surface.html`, and `surface.css` provide the surface-code interface. `model.js` contains the shared UF decoder and exact reference. `extras.js` contains the synchronized teaching views. `theme.js` applies the saved appearance before first paint. `site.css` and `details.html` contain the standalone presentation. `source.html` is the original visualization source; `build_site.py` extracts and adapts its interface, writes `app.js`, and assembles the self-contained `index.html`. Rebuild with `python3 build_site.py`.

## Validation

Run `node surface-model.test.js` for the surface-code checks. They verify CSS commutation, matrix ranks, primal/dual distance, logical/stabilizer equivalence, and exact reconstruction. The 1,074 decoder runs include every distance-5 error of weight at most two, all displayed examples and their logical/stabilizer transforms, and seeded larger error patterns. Browser checks cover all six examples and six views, error editing, replay, mode switching, and both themes at widths from 320 to 1440 pixels.

All preset examples and 20 deterministic custom syndromes were checked across all three forest strategies (78 model runs). Checks included correction incidence, per-frame residual identity, acyclic forests, boundary roots, and identical grown support across strategies. Browser checks covered every preset/strategy combination, editing, zero and invalid syndromes, microsteps, comparisons, and responsive layouts.

## Reading

- Austin G. Fowler et al., [Surface codes: Towards practical large-scale quantum computation](https://arxiv.org/abs/1208.0928).

- Nicolas Delfosse and Naomi H. Nickerson, [Almost-linear time decoding algorithm for topological codes](https://arxiv.org/abs/1709.06218).
- TUM, [Edmonds’s Blossom Algorithm](https://algorithms.discrete.ma.tum.de/graph-algorithms/matchings-blossom-algorithm/index_en.html), interaction inspiration.
