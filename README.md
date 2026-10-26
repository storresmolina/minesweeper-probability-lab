# Minesweeper Probability Lab

A playable exploration of conditional probability. Reveal a tile, see an exact
mine-probability heatmap, and inspect the complete-board counts behind each estimate.

**Live demo:** pending GitHub repository creation and Pages activation.
The application works locally; no server, account, database, or telemetry is used.

## Run locally

Use Node.js 22.12 or newer (verified locally on 22.16).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173/).

```sh
npm test          # Solver, gameplay, exhaustive oracle comparison, benchmark
npm run build    # Type-check and build dist/
npm run preview  # Preview the production build locally
npm run benchmark -- --silent=false
```

## Play and inspect

- Reveal mode opens a tile. The first tile is always safe; neighbors are not guaranteed safe.
- Flag mode places or removes your hypothesis. Right-click or press F as a shortcut.
- Inspect mode pins a tile's explanation without revealing it. Press I as a shortcut.
- Arrow keys navigate the board; Enter or Space activates the selected mode.
- Show heatmap and Show percentages work independently and survive a new board.
- Gray cells have no adjacent revealed clue. Their probability is still available in Inspect.
- Flags never affect inference. Victory requires revealing every non-mine tile.
- Losing exposes actual mines but preserves the pre-click probabilities for comparison.

The gradient uses a fixed green → yellow → red scale for 0% → 50% → 100%.
Numeric labels are enabled by default. Exact certainty is labeled SAFE or MINE;
uncertain values never round to those labels. The current UI exposes only 9×9
with ten mines, while game logic accepts dimensions and mine count as data.

## The question

Given revealed clues and a known mine total, what fraction of consistent complete
boards contain a mine at a particular hidden tile?

Let Ω be all complete mine placements consistent with the current observations.
Then for a hidden tile t:

```text
P(mine at t | revealed clues, total mines) = |{b in Ω: t is mined in b}| / |Ω|
```

The random generator samples mine placements using a partial Fisher–Yates shuffle
after the opening choice, excluding only that cell. Under the usual uniform PRNG
assumption, each candidate mine subset has equal probability. Subsequent safe
observations condition that distribution. Flags add no observations. The solver
does not receive mine locations; `observation(game)` projects only public facts.

### Why whole-board weighting matters

This one-row example has two mines in total:

```text
 A  1  B  1  C  X  Y
```

Clues require A+B=1 and B+C=1. B=1 permits the second mine at X or Y (two
completions); B=0 forces A=C=1 (one completion). Therefore P(B)=2/3 and
P(A)=P(C)=P(X)=P(Y)=1/3. Treating the two local patterns as equally likely
would incorrectly assign B a probability of 1/2.

### Counting algorithm

1. Turn each revealed clue into an equation over adjacent hidden cells.
2. Group constraints connected by shared cells.
3. Enumerate each group's valid assignments with branch pruning. Record counts
   by number of mines, and per-cell counts for assignments where that cell is mined.
4. Convolve group counts. If group assignments use k mines and U cells remain
   outside every group, weight them by `choose(U, mineCount - k)`.
5. Repeat the weighted count with each tile constrained to be mined. For a gray
   tile, use `choose(U - 1, mineCount - k - 1)` for its numerator.

Prefix/suffix convolutions reuse counts when evaluating each group. All counts
and combinatorics use BigInt; percentages are converted to floating point for
display. The solver is synchronous, pure TypeScript with no React dependency.

## Validation and performance

`src/solver.test.ts` compares the solver with an independent brute-force full-board
oracle for **every mine placement and every subset of safe reveals on a 2×3 board**.
Additional fixtures cover unequal completion weights, disconnected components,
symmetry, global certainty in gray cells, large integer counts, and invalid inputs.
The exhaustive comparison also checks bounds and the exact conservation identity:

```text
sum(tile mine-board counts) = mineCount × total consistent boards
```

`src/game.test.ts` checks all 81 possible opening cells, generated clues, zero
expansion, flag limits, recovery from wrong flags, and terminal-state freezing.

The reproducible benchmark plays 100 seeded beginner games, choosing from the
lowest-risk cells using only solver outputs. Measured locally on 26 October 2026
with Node 22.16 on Windows:

| Positions | Median   | 95th percentile | Maximum  | Largest total frontier |
| --------- | -------- | --------------- | -------- | ---------------------- |
| 1,545     | 0.056 ms | 0.145 ms        | 1.409 ms | 32 cells               |

These are local sampled timings, not a worst-case or browser/device guarantee.
Run the benchmark to measure your own environment. A worker was unnecessary for
these measurements; large connected frontiers still have exponential worst-case
enumeration cost. Custom board limits require additional benchmarks.

## Repository map

```text
src/board.ts           Configuration, adjacency, coordinates
src/game.ts            Generation, flags, reveals, game states
src/solver.ts          Exact counting and probability labels
src/App.tsx            Board, modes, controls, inspection, methodology
src/styles.css         Responsive presentation and reduced-motion support
src/*.test.ts          Mathematical and game checks, reproducible benchmark
docs/SPEC.md           Agreed scope, assumptions, acceptance, and roadmap
.github/workflows/     CI and GitHub Pages deployment
```

## Publish to GitHub Pages

The local Git repository is initialized on `main`; no GitHub remote is configured.
Create a GitHub repository named `minesweeper-probability-lab`, connect it as
`origin`, and push the project. In repository **Settings → Pages → Source**, select
**GitHub Actions**. The deploy workflow tests and builds before publishing main.
The separate CI workflow checks pushes and pull requests. Remote CI/deployment
have not yet run; successful local builds do not establish a published demo.

Vite uses relative asset paths so the single-page application works under the
repository subpath. There is no client-side routing. See the official
[Vite deployment guide](https://vite.dev/guide/static-deploy#github-pages).

## Deliberate limits and roadmap

The current display uses a red/green gradient. Percentages, text explanations,
visible focus, keyboard controls, and reduced-motion support are present; a
separate color-accessible theme remains a roadmap item. This is not a claim of
a completed accessibility audit. Exact fractions are exposed, while change
explanations report added evidence and numerical changes rather than claiming
to identify a minimal causal proof.

Future work: custom dimensions and mine density after profiling; curated
unavoidable-guess examples; an alternative color palette; chording. No autoplay,
hint system, analytics, or Python notebook is needed for the present scope.

MIT licensed. See [LICENSE](LICENSE).
