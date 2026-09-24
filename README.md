# Union-Find Decoder Lab

An interactive, self-contained teaching page for quantum error correction.

Open `index.html` in any modern browser. No installation or network access is required.

## Surface-code logical recovery

The default workspace uses a distance-5 unrotated planar CSS surface code: 41 data qubits, 20 X checks, 20 Z stabilizers, and one logical qubit. Qubits lie on edges; Z strings can terminate at the two rough boundaries. The model includes only Z errors and perfect syndrome measurements. It is one recovery round, not a circuit-level noise simulation or logical-error-rate benchmark.

Twenty-four examples cover exact cancellation, stabilizers, logical strings, disconnected chains, multiple logical strings that cancel or survive, cluster reactivation, forest-dependent logical outcomes, growth that excludes the successful class, disagreements with minimum-weight decoding, full-likelihood crossovers, indistinguishable equal-weight errors, dense boundary syndromes, and one-qubit changes that reverse recovery. The page computes the actual error E, UF correction C, and residual CE, and solves CE = Zbar^ell times a product of Z stabilizers over GF(2). An independent logical-X intersection parity checks the result. UF receives only the syndrome.

Use the seven diagram views to inspect E, the syndrome, the UF trace, C, CE, its decomposition, and an E/C overlay with explicit cancellation marks. Edit E by clicking qubit edges or using the selector. Multiplying E by a logical operator preserves its syndrome but changes its logical class; multiplying by a stabilizer preserves both. The exact supports and stabilizer witness are expandable.

The **UF mechanics** tab retains the original smaller graph and its detailed data structures.

## Research comparisons

The surface-code reference computes an exact minimum correction separately in each logical class. C0 shares the current UF correction's class, and C1 lies in the opposite class. These labels describe equivalence modulo Z stabilizers among corrections with the same syndrome; they are not claims about successful recovery. The simulated E labels success only after decoding. Changing the peeling forest can change which absolute parity is called C0.

The reference uses a row-frontier dynamic program. Its state is the vertical frontier (d−1 bits) and the parity of intersection with the fixed logical-X cut. For each pair of incoming/outgoing frontiers, the vertex check equations determine two possible horizontal rows. Each horizontal edge and outgoing vertical edge contributes its unit cost exactly once. The top and bottom vertical frontiers are empty. Minimum-cost predecessors reconstruct a witness; BigInt counts retain the exact number of minimum-weight qubit supports. The complexity is O(d · 4^(d−1)); this teaching reference is not a production decoder or a speed comparison with UF/Blossom.

Running the same solve with only fully grown edges permitted distinguishes class infeasibility caused by growth from the subsequent correction choice. A missing successful class means no correction confined to that support can recover the displayed E. If both classes remain feasible, compare BFS, reverse BFS, and DFS. Their grown support is identical. The signed gap is w1−w0 between class minima; it is not the difference against the possibly longer actual UF correction and is not a calibrated failure probability. Minimum-weight multiplicities do not include higher-weight representatives and are not full class likelihoods.

The live cluster inspector shows original defect counts, vertex counts, activity, and boundary contact. Jump controls locate the first merge, successive reactivation rounds, and final forest. They follow the same recorded UF trace as the animation.

## Exact conditional confidence

The probability panel counts every compatible error, not only minimum-weight corrections. `surface-confidence.js` uses an exact row-frontier weight-enumerator dynamic program: A[b,k] counts errors with the current syndrome, absolute cut parity b, and weight k. For this distance-5 patch each class has 2^20 distinct supports. The independent-Z class mass is sum_k A[b,k] p^k (1-p)^(41-k); conditioning normalizes the two masses. Counts are exact integers, while floating-point log-sum-exp evaluates probabilities stably. The module supports the canonical distance-3 and distance-5 geometries and rejects larger patches.

C0 and C1 label whole classes in the probability panel. C0 shares the selected UF correction's class; the conditional probability of UF failure is the mass of C1. Changing the assumed p leaves the displayed E, syndrome, correction, and actual logical outcome fixed. At p=0 a nonzero syndrome cannot be conditioned on; at p=0.5 the two classes each have probability 0.5. These statements concern the independent-Z, perfect-syndrome model, not circuit noise, correlated errors, or fixed-weight sampling.

Example 16 has a unique weight-five minimum in UF's class and eight weight-six minima in the opposite class. Counting all higher weights reverses the preferred class near p=0.11052. Example 17 gives identical decoder information but the opposite actual outcome. Examples 23/24 additionally have the same error weight. Their paired-case controls emphasize what the syndrome cannot reveal.

## One-qubit sensitivity

The local scan toggles each of the 41 error qubits and reruns the same forest strategy on its new syndrome. It reports E', C', |C xor C'|, and the logical outcome. The identity (E xor C) xor (E' xor C') = q xor C xor C' verifies every change; this residual difference is closed, and its logical parity identifies outcome flips. Open a neighbor in the cancellation overlay and restore the original case afterward. These 41 controlled counterfactuals are not probability-weighted samples.

Examples 18/19 differ only by adding q16. Default BFS changes five correction edges, reduces correction weight from four to three, and changes failure to success. Examples 20–22 cover a fully defective syndrome, ten rough-boundary contacts, and a cluster that remains inactive through tick two before an odd merger reactivates it at tick three. Worked-example prose describes default BFS; live results follow the selected forest.

## Reproduce an experiment

Generate a single error using independent Bernoulli(p) Z errors or a fixed-weight subset. The latter conditions the weight and is not the same noise model. A 32-bit LCG uses state = (1664525 × state + 1013904223) mod 2^32, with one output per qubit for independent sampling and a descending Fisher–Yates shuffle for fixed-weight sampling. Seed 89 at fixed weight 7 reproduces example 13.

**Create case link** encodes the exact error support, forest, diagram view, and assumed confidence prior in the URL. **Export JSON** writes schema `decoder-lab.surface-code.v3` with the full qubit/check geometry, error, syndrome, correction, residual, stabilizer witness, both logical-class minima and counts, grown support, all forest outcomes, full class weight spectra, assumed prior and posterior, any current sensitivity scan, and sampling parameters when applicable. Older case links without a prior remain supported and use p=0.1. Editing E clears stale generation metadata. All calculations remain in the browser. Curated cases and individual generated shots cannot establish comparative logical error rates.

## Explore

- Light, dark, and system themes with a saved preference.
- Twenty-four surface-code cases, plus six original mechanics experiments.
- Step, play, rewind, scrub, or jump between decoder phases.
- Half-edge growth, simultaneous fusion queues, Find and Union operations.
- Parent pointers and path compression, separate from graph-based peeling.
- Residual syndrome identity checked throughout the trace.
- Breadth-first, reversed breadth-first, and depth-first forest comparisons.
- Exact minima in both surface-code logical classes, globally and within grown support, for any displayed syndrome.
- The original mechanics reference handles up to 12 defects.
- Exact conditional likelihood curves and expandable all-weight spectra.
- Exhaustive one-qubit sensitivity scans with reversible neighbor exploration.
- Paired indistinguishable errors and direct E/C cancellation overlays.
- Seeded single-shot generation, shareable case links, and full JSON experiment exports.
- Pseudocode, node/edge inspection, and a detailed field guide.

Use **Theme** in the header to choose Light, Dark, or System. System follows your device appearance; explicit choices are remembered in this browser. Printing always uses the light palette.

With page focus outside a control, Left/Right changes steps and Space toggles playback.

## Original mechanics model

This is a 7-by-3 unit-cost graph with optional allowed left boundary vertices, uniform growth, union by size, path compression, and deterministic peeling. It illustrates one error type. It does not simulate logical failure probabilities or the full geometry and noise model of a physical code. The animation engine is not a performance benchmark.

The exact reference uses shortest paths and subset dynamic programming, not Blossom.

## Publish with GitHub Pages

Commit `index.html` in the root of the repository. In Settings → Pages, choose **Deploy from a branch**, then **main** and **/(root)**. The page has no server dependencies or build requirements.

## Source

`surface-model.js` constructs the CSS patch and computes the exact logical/stabilizer decomposition. `surface-confidence.js` computes the all-weight class spectra and iid posteriors. `surface-app.js`, `surface.html`, and `surface.css` provide the surface-code interface. `model.js` contains the shared UF decoder and exact reference. `extras.js` contains the synchronized teaching views. `theme.js` applies the saved appearance before first paint. `site.css` and `details.html` contain the standalone presentation. `source.html` is the original visualization source; `build_site.py` extracts and adapts its interface, writes `app.js`, and assembles the self-contained `index.html`. Rebuild with `python3 build_site.py`.

## Validation

Run `node surface-model.test.js` for the surface-code checks. They verify CSS commutation, matrix ranks, primal/dual distance, logical/stabilizer equivalence, and exact reconstruction. The 1,470 decoder runs include every distance-5 error of weight at most two, all displayed examples and their logical/stabilizer transforms, and seeded larger error patterns.

Run `node surface-reference.test.js` for independent reference checks: all 64 syndromes on distance 3 under three edge-support restrictions (192 exact problems), plus all 4,194,304 representatives in the two logical cosets of two distance-5 cases. Exhaustive enumeration verifies both the global and grown-region minima and their counts. Tests also check the mechanism advertised by each advanced case, all three forests, deterministic sampling, and reference witnesses through distance 9.

The original mechanics presets and 20 deterministic custom syndromes were checked across all three forest strategies (78 model runs). Checks included correction incidence, per-frame residual identity, acyclic forests, boundary roots, and identical grown support across strategies. Browser checks covered every preset/strategy combination, editing, zero and invalid syndromes, microsteps, comparisons, and responsive layouts.

Run `node surface-confidence.test.js` for independent exhaustive confidence checks: all 8,192 distance-3 physical errors and all 64 syndromes; distance-5 minimum weights and multiplicities for every example; all 2,097,152 representatives of the likelihood-crossover syndrome; direct probability sums, p endpoints, numerical underflow, JSON safety, and invalid inputs.

Run `node surface-edge.test.js` for the nine new mechanisms, identical paired traces across three forests, 35 decoder/witness checks, and 410 one-qubit neighbors verified independently through check incidence, support bit masks, and logical-cut intersections.

Browser verification covers all 24 cases × 3 forest strategies × 7 views, cluster jumps, reference diagrams, editing and equivalence transforms, sampling, JSON exports, shared/invalid URLs, the existing mechanics view, and both themes at 320–1440px. Additional flows verify the likelihood crossover, same-syndrome posterior invariance, endpoint behavior, q16 neighbor/restore, cancellation marks, delayed reactivation, v3 exports, and prior-preserving/legacy/invalid links.

## Reading

- Austin G. Fowler et al., [Surface codes: Towards practical large-scale quantum computation](https://arxiv.org/abs/1208.0928).

- Nicolas Delfosse and Naomi H. Nickerson, [Almost-linear time decoding algorithm for topological codes](https://arxiv.org/abs/1709.06218).
- Sergey Bravyi, Martin Suchara, and Alexander Vargo, [Efficient algorithms for maximum likelihood decoding in the surface code](https://arxiv.org/abs/1405.4883). Background on class likelihoods; the page implements its own small-patch frontier enumeration.
- TUM, [Edmonds’s Blossom Algorithm](https://algorithms.discrete.ma.tum.de/graph-algorithms/matchings-blossom-algorithm/index_en.html), interaction inspiration.
