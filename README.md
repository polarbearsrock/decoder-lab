# Union-Find Decoder Lab

An interactive, self-contained teaching page for quantum error correction.

Open `index.html` in any modern browser. No installation or network access is required.

## Surface-code logical recovery

The default workspace uses a distance-5 unrotated planar CSS surface code: 41 data qubits, 20 X checks, 20 Z stabilizers, and one logical qubit. Qubits lie on edges; Z strings can terminate at the two rough boundaries. The model includes only Z errors and perfect syndrome measurements. It is one recovery round, not a circuit-level noise simulation or logical-error-rate benchmark.

One hundred examples cover exact cancellation, stabilizers, logical strings, disconnected chains, multiple logical strings that cancel or survive, cluster reactivation, forest-dependent logical outcomes, growth that excludes the successful class, disagreements with minimum-weight decoding, full-likelihood crossovers, indistinguishable errors, dense boundary syndromes, nonlocal responses to one-qubit changes, and geometric symmetries. The page computes the actual error E, UF correction C, and residual CE, and solves CE = Zbar^ell times a product of Z stabilizers over GF(2). An independent logical-X intersection parity checks the result. UF receives only the syndrome.

Use the seven diagram views to inspect E, the syndrome, the UF trace, C, CE, its decomposition, and an E/C overlay with explicit cancellation marks. Edit E by clicking qubit edges or using the selector. Multiplying E by a logical operator preserves its syndrome but changes its logical class; multiplying by a stabilizer preserves both. The exact supports and stabilizer witness are expandable.

The **UF mechanics** tab retains the original smaller graph and its detailed data structures.

## Research case catalog

The catalog contains **100 distinct error supports, 89 distinct syndromes, and 22 paired studies**. Cases 1–24 keep their original numbers and stable IDs. The additional cases are organized as follows:

| Cases | Group | Principal questions |
| --- | --- | --- |
| 25–44 | Growth stress tests | When do reactivation, boundary contact, or growth restrictions alter the eventual correction? |
| 45–64 | Likelihood stress tests | When do class minima, multiplicity, and full conditional likelihood disagree? |
| 65–84 | Perturbation studies | How can one changed qubit rewrite 12–20 correction edges or reverse recovery while scalar summaries remain unchanged? |
| 85–100 | Topology and symmetry | What do stabilizer, logical, complement, and boundary-preserving geometric transformations reveal? |

This is a curated regression dataset for inspecting mechanisms, reproducing individual cases, and testing implementation changes. Cases were deliberately selected for their behavior; their frequencies, failure fraction, and apparent difficulty do not estimate a logical error rate or comparative decoder performance. All 100 use the same distance-5, Z-only, perfect-syndrome, single-round model with uniform unit growth costs. The catalog does not introduce measurement faults, circuit-level correlations, repeated rounds, or a larger code distance.

Combine concept, verified-behavior, and BFS-outcome filters with text search. Sort by case number, correction weight, peeling overhead, defect count, closeness to 50% conditional failure, or signed class gap. The table displays 25 cases per page. Table metrics always describe default BFS; the simulator and its individual experiment export follow the selected forest. The table's probability column uses the fixed independent-Z prior p=0.10, separately from the adjustable confidence panel.

Each case record exposes its stable ID, exact error support, selection rationale, provenance, and error/syndrome fingerprints. The fingerprints are bit-mask encodings of the fixed qubit/check ordering, not cryptographic hashes: the error key has 11 hexadecimal digits and the syndrome key has five. Exact input supports are authoritative. Seeded provenance records the sampling construction and any documented transformation; paired records identify controlled one-qubit, stabilizer, logical, complement, or geometric relationships where applicable. Geometry transformations preserve the rough and smooth boundary types.

`catalog-reference.json` is the deterministic full dataset, using schema `decoder-lab.catalog.v1`. It includes the model and indexing conventions, patch geometry, all 100 case records, provenance, pair metadata, BFS corrections and residual witnesses, all three forest results, fully grown edges, global and grown-region class minima with multiplicities, exact class weight spectra, and conditional failure probabilities at p=0.01, 0.05, 0.10, and 0.15. Qubit and stored stabilizer indices are zero-based; a displayed stabilizer S_i uses the stored index plus one. Absolute class parity is intersection with the fixed logical-X cut.

**Export matches · JSON** preserves the matching research records with their model context; **Export matches · CSV** provides a compact analysis table. Both export every matching case across all pages in the current sort order. CSV columns include stable IDs, category/tags, fingerprints, error/syndrome/correction/residual supports, logical outcome, weights, growth and reactivation counts, signed gap, peeling and growth penalties, successful-class feasibility, forest sensitivity, both absolute-class minima and multiplicities, probabilities at the four reference priors, partner ID, and selection method/criterion. Use JSON for the full geometry, provenance, spectra, and per-forest supports. CSV fields are quoted and embedded quotes/newlines are escaped.

Verified-behavior tags have explicit selection rules. A prior reversal means the favored class changes among the four reference priors; a weight/likelihood conflict compares the sign of the class-minimum gap with the full class preference at those priors. A confident-failure case is an actual BFS failure with conditional failure probability below 10% at p=0.01. These tags identify selected examples, not the frequency of such events under a noise model. The reactivation count measures merge batches containing an even-to-odd cluster transition; a transition can occur within one tick, without a full paused round.

## Research comparisons

The surface-code reference computes an exact minimum correction separately in each logical class. C0 shares the current UF correction's class, and C1 lies in the opposite class. These labels describe equivalence modulo Z stabilizers among corrections with the same syndrome; they are not claims about successful recovery. The simulated E labels success only after decoding. Changing the peeling forest can change which absolute parity is called C0.

The reference uses a row-frontier dynamic program. Its state is the vertical frontier (d−1 bits) and the parity of intersection with the fixed logical-X cut. For each pair of incoming/outgoing frontiers, the vertex check equations determine two possible horizontal rows. Each horizontal edge and outgoing vertical edge contributes its unit cost exactly once. The top and bottom vertical frontiers are empty. Minimum-cost predecessors reconstruct a witness; BigInt counts retain the exact number of minimum-weight qubit supports. The complexity is O(d · 4^(d−1)); this teaching reference is not a production decoder or a speed comparison with UF/Blossom.

Running the same solve with only fully grown edges permitted distinguishes class infeasibility caused by growth from the subsequent correction choice. A missing successful class means no correction confined to that support can recover the displayed E. If both classes remain feasible, compare BFS, reverse BFS, and DFS. Their grown support is identical. The signed gap is w1−w0 between class minima; it is not the difference against the possibly longer actual UF correction and is not a calibrated failure probability. Minimum-weight multiplicities do not include higher-weight representatives and are not full class likelihoods.

The live cluster inspector shows original defect counts, vertex counts, activity, and boundary contact. Jump controls locate the first merge, successive reactivation batches, and final forest. They follow the same recorded UF trace as the animation.

## Exact conditional confidence

The probability panel counts every compatible error, not only minimum-weight corrections. `surface-confidence.js` uses an exact row-frontier weight-enumerator dynamic program: A[b,k] counts errors with the current syndrome, absolute cut parity b, and weight k. For this distance-5 patch each class has 2^20 distinct supports. The independent-Z class mass is sum_k A[b,k] p^k (1-p)^(41-k); conditioning normalizes the two masses. Counts are exact integers, while floating-point log-sum-exp evaluates probabilities stably. The module supports the canonical distance-3 and distance-5 geometries and rejects larger patches.

C0 and C1 label whole classes in the probability panel. C0 shares the selected UF correction's class; the conditional probability of UF failure is the mass of C1. Changing the assumed p leaves the displayed E, syndrome, correction, and actual logical outcome fixed. At p=0 a nonzero syndrome cannot be conditioned on; at p=0.5 the two classes each have probability 0.5. These statements concern the independent-Z, perfect-syndrome model, not circuit noise, correlated errors, or fixed-weight sampling.

Example 16 has a unique weight-five minimum in UF's class and eight weight-six minima in the opposite class. Counting all higher weights reverses the preferred class near p=0.11052. Example 17 gives identical decoder information but the opposite actual outcome. Examples 23/24 additionally have the same error weight. Their paired-case controls emphasize what the syndrome cannot reveal.

## One-qubit sensitivity

The local scan toggles each of the 41 error qubits and reruns the same forest strategy on its new syndrome. It reports E', C', |C xor C'|, and the logical outcome. The identity (E xor C) xor (E' xor C') = q xor C xor C' verifies every change; this residual difference is closed, and its logical parity identifies outcome flips. Open a neighbor in the cancellation overlay and restore the original case afterward. These 41 controlled counterfactuals are not probability-weighted samples.

Examples 18/19 differ only by adding q16. Default BFS changes five correction edges, reduces correction weight from four to three, and changes failure to success. Examples 20–22 cover a fully defective syndrome, ten rough-boundary contacts, and a cluster that remains inactive through tick two before an odd merger reactivates it at tick three. Worked-example prose describes default BFS; live results follow the selected forest.

Examples 65–84 add ten controlled one-qubit pairs. They include both opening and excluding the successful class in grown support, removing an error that worsens recovery, and adding an error that annihilates two defects yet causes failure. Examples 83/84 change 12 correction-edge selections and reverse all three implemented forests' outcomes while preserving defect count, correction weight, signed gap, growth ticks, reactivation count, and peeling/growth penalties. Equal scalar summaries do not imply equal syndrome geometry or full conditional likelihood.

## Reproduce an experiment

Generate a single error using independent Bernoulli(p) Z errors or a fixed-weight subset. The latter conditions the weight and is not the same noise model. A 32-bit LCG uses state = (1664525 × state + 1013904223) mod 2^32, with one output per qubit for independent sampling and a descending Fisher–Yates shuffle for fixed-weight sampling. Seed 89 at fixed weight 7 reproduces example 13.

**Create case link** encodes the exact error support, forest, diagram view, and assumed confidence prior in the URL. **Export JSON** writes schema `decoder-lab.surface-code.v3` with the full qubit/check geometry, error, syndrome, correction, residual, stabilizer witness, both logical-class minima and counts, grown support, all forest outcomes, full class weight spectra, assumed prior and posterior, any current sensitivity scan, and sampling parameters when applicable. Older case links without a prior remain supported and use p=0.1. Editing E clears stale generation metadata. All calculations remain in the browser. Curated cases and individual generated shots cannot establish comparative logical error rates.

## Interface reliability

The research navigation remains available while scrolling and indicates the current section. Search the 100-case catalog by mechanism, number, or stable ID and combine concept, behavior, and outcome filters. Pagination keeps the table manageable; matching-case exports include every page. Empty searches explain how to recover. Result tables are named, keyboard-focusable scroll regions.

In the error editor, the lattice is an interactive group with one keyboard entry point. Arrow keys move through qubit IDs, Home/End reach the first/last qubit, and Enter/Space toggles the focused error. The native qubit selector reports whether that qubit currently carries Z. Focus survives a toggle or width change; opening a paired case, catalog case, or neighbor moves focus to its destination. Shortcut handling leaves form controls, links, and expandable explanations alone. The mechanics tabs use a single tab stop with arrow-key navigation.

The confidence plot caches its fixed-syndrome probability curve. Changing p updates one posterior, the marker, and weight contributions while retaining the curve and table nodes. Width-only redraws preserve focus; changing a section’s height does not redraw the lattice. These are UI optimizations and do not change decoder results or imply production-decoder latency.

Case links invalidate whenever their encoded state changes. Copying offers a manual selection fallback if clipboard access is unavailable; ambiguous or invalid URLs show a visible notice. JavaScript-disabled browsers receive an explanatory notice. The page requires a modern browser and remains self-contained and usable offline. It has no analytics, external font dependencies, or server-side computation. Only the theme preference is saved automatically.

## Explore

- Light, dark, and system themes with a saved preference.
- One hundred surface-code cases, including 22 paired studies, plus six original mechanics experiments.
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
- Searchable and sortable case records, verified mechanism filters, and matching-case CSV/JSON exports.
- Pseudocode, node/edge inspection, and a detailed field guide.

Use **Theme** in the header to choose Light, Dark, or System. System follows your device appearance; explicit choices are remembered in this browser. Printing always uses the light palette.

With page focus outside an interactive control or expandable explanation, Left/Right changes steps and Space toggles playback. Reduced-motion preferences disable animated scrolling and cosmetic transitions; trace playback starts only when requested.

## Original mechanics model

This is a 7-by-3 unit-cost graph with optional allowed left boundary vertices, uniform growth, union by size, path compression, and deterministic peeling. It illustrates one error type. It does not simulate logical failure probabilities or the full geometry and noise model of a physical code. The animation engine is not a performance benchmark.

The exact reference uses shortest paths and subset dynamic programming, not Blossom.

## Publish with GitHub Pages

Commit the generated `index.html` in the root of the repository, along with the source files and `catalog-reference.json` needed to reproduce it. In Settings → Pages, choose **Deploy from a branch**, then **main** and **/(root)**. GitHub Pages serves the already-built files; it requires no application server or build step. Rebuilding locally requires Python and Node.js as described below.

## Source

`surface-model.js` constructs the CSS patch and computes the exact logical/stabilizer decomposition. `surface-cases.json` holds the 76 additional worked cases, expected regression values, and selection provenance; the original 24 remain in `surface-model.js`. `surface-confidence.js` computes the all-weight class spectra and iid posteriors. `surface-catalog.js` derives research records from those shared models and serializes the compact CSV format; `build_catalog.js` writes the deterministic `catalog-reference.json` artifact. The build embeds both the case definitions and computed reference records into the standalone page, so catalog browsing and exports also work offline.

`surface-app.js`, `surface.html`, and `surface.css` provide the surface-code interface. `model.js` contains the shared UF decoder and exact reference. `extras.js` contains the synchronized teaching views. `theme.js` applies the saved appearance before first paint. `site.css` and `details.html` contain the standalone presentation. `source.html` is the original visualization source; `build_site.py` extracts and adapts its interface, writes `app.js`, and assembles the self-contained `index.html`.

Rebuild with `python3 build_site.py`. This invokes Node.js to regenerate `catalog-reference.json` before assembling the page. To regenerate only the research dataset, use `node build_catalog.js`. Building and verification require Python 3.10+ and Node.js, with no third-party packages or network access. Opening the generated page requires only a modern browser.

## Validation

Run `python3 verify.py` before publishing (Python 3.10+ and Node.js required). It checks JavaScript syntax, runs all five mathematical test suites below, validates static HTML ID/label/ARIA/fragment references, and rebuilds in a temporary directory to compare the generated research dataset, `app.js`, and `index.html` byte for byte. It uses no network and does not rewrite the working copy. If generated files are stale, run `python3 build_site.py` and review the outputs first. Browser/visual and assistive-technology checks are separate from this gate.


Run `node surface-model.test.js` for the surface-code checks. They verify CSS commutation, matrix ranks, primal/dual distance, logical/stabilizer equivalence, and exact reconstruction. The 3,142 decoder runs include every distance-5 error of weight at most two, all 100 displayed examples and their logical/stabilizer transforms, and seeded larger error patterns.

Run `node surface-reference.test.js` for independent reference checks: all 64 syndromes on distance 3 under three edge-support restrictions (192 exact problems), plus all 4,194,304 representatives in the two logical cosets of two distance-5 cases. Exhaustive enumeration verifies both the global and grown-region minima and their counts. Tests also check the first 15 cases' mechanisms, all three forests, deterministic sampling, and reference witnesses through distance 9. The separate catalog suite validates the expanded cases and their documented constructions.

The original mechanics presets and 20 deterministic custom syndromes were checked across all three forest strategies (78 model runs). Checks included correction incidence, per-frame residual identity, acyclic forests, boundary roots, and identical grown support across strategies. Browser checks covered every preset/strategy combination, editing, zero and invalid syndromes, microsteps, comparisons, and responsive layouts.

Run `node surface-confidence.test.js` for independent exhaustive confidence checks: all 8,192 distance-3 physical errors and all 64 syndromes; distance-5 minimum weights and multiplicities for every example; all 2,097,152 representatives of the likelihood-crossover syndrome; direct probability sums, p endpoints, numerical underflow, JSON safety, and invalid inputs.

Run `node surface-edge.test.js` for the nine mechanisms added in cases 16–24, identical paired traces across three forests, 35 decoder/witness checks, and 410 one-qubit neighbors verified independently through check incidence, support bit masks, and logical-cut intersections.

Run `node surface-catalog.test.js` for the 100-case research corpus. It checks stable IDs/order, unique error supports, the 76 additions' expected fields and independently reconstructed seeded inputs, and all 22 paired studies. Its 300 case/forest checks independently form check incidence, logical-cut parity, and stabilizer witnesses. It also verifies global and grown-support references, exact spectrum totals and minimum multiplicities, direct conditional-probability sums, fingerprint encodings, deterministic dataset rebuilding, and all 100 CSV records including quoted-field round trips. Paired checks cover one-qubit differences, logical/stabilizer invariance, complements, and boundary-preserving symmetries.

The browser release checklist covers all 100 cases across three forest strategies and seven views, cluster jumps, reference diagrams, editing and equivalence transforms, sampling, individual and catalog exports, shared/invalid URLs, the existing mechanics view, and both themes at 320–1440px. Additional flows cover the likelihood crossover, same-syndrome posterior invariance, endpoint behavior, q16 neighbor/restore, cancellation marks, delayed reactivation, v3 experiment exports, and prior-preserving/legacy/invalid links. Catalog checks include combined filters, sorting, pagination, exports spanning multiple pages, and opening a selected case. Production-readiness checks cover keyboard details and tabs, lattice and forest focus, search/filter empty states, copy fallback, invalid-link notices, no-JavaScript behavior, reduced motion, and sticky section navigation.

## Reading

- Austin G. Fowler et al., [Surface codes: Towards practical large-scale quantum computation](https://arxiv.org/abs/1208.0928).

- Nicolas Delfosse and Naomi H. Nickerson, [Almost-linear time decoding algorithm for topological codes](https://arxiv.org/abs/1709.06218).
- Sergey Bravyi, Martin Suchara, and Alexander Vargo, [Efficient algorithms for maximum likelihood decoding in the surface code](https://arxiv.org/abs/1405.4883). Background on class likelihoods; the page implements its own small-patch frontier enumeration.
- TUM, [Edmonds’s Blossom Algorithm](https://algorithms.discrete.ma.tum.de/graph-algorithms/matchings-blossom-algorithm/index_en.html), interaction inspiration.
