import { useRef, useState, type KeyboardEvent } from "react";
import { coordinate } from "./board";
import { newGame, observation, reveal, toggleFlag, type Game } from "./game";
import {
  probabilityLabel,
  solve,
  type Analysis,
  type TileProbability,
} from "./solver";

type Mode = "Reveal" | "Flag" | "Inspect";
interface Session {
  game: Game;
  analysis: Analysis | null;
  previous: Analysis | null;
  elapsed: number;
  error: string | null;
}
const fresh = (): Session => ({
  game: newGame(),
  analysis: null,
  previous: null,
  elapsed: 0,
  error: null,
});
const percent = (p: number) => `${(p * 100).toFixed(2)}%`;
const formatCount = (n: bigint) => n.toLocaleString("en-US");

function color(tile: TileProbability): string {
  const p = tile.probability;
  const stops = [
    [145, 195, 140],
    [243, 217, 123],
    [226, 115, 100],
  ];
  const from = p <= 0.5 ? stops[0] : stops[1];
  const to = p <= 0.5 ? stops[1] : stops[2];
  const t = p <= 0.5 ? p * 2 : (p - 0.5) * 2;
  return `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * t)).join(",")})`;
}

export default function App() {
  const [session, setSession] = useState<Session>(fresh);
  const [mode, setMode] = useState<Mode>("Reveal");
  const [heatmap, setHeatmap] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [pinned, setPinned] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const { game, analysis, previous } = session;
  const selected = preview ?? pinned;
  const tile = selected !== null ? analysis?.tiles[selected] : null;
  const oldTile = selected !== null ? previous?.tiles[selected] : null;
  const ended = game.status === "won" || game.status === "lost";
  const safeTiles =
    analysis?.tiles.flatMap((t, i) => (t?.mineBoards === 0n ? [i] : [])) ?? [];
  const allSafeFlagged =
    safeTiles.length > 0 && safeTiles.every((i) => game.flags.has(i));
  const notice = session.error
    ? "The analysis could not be calculated. Restart to try a new board."
    : game.status === "ready"
      ? "Your first reveal is always safe. Pick a tile to begin."
      : game.status === "won"
        ? "All safe tiles revealed. Nicely reasoned — the board is yours."
        : game.status === "lost"
          ? "A mine this time. Explore the final probabilities, or try a fresh board."
          : allSafeFlagged
            ? "A flagged tile is certainly safe. You can reconsider your hypothesis."
            : safeTiles.length === 0
              ? "No move is certainly safe. The probabilities can help you compare risk."
              : "New clues, new possibilities. Take a look and make your next move.";

  function act(index: number) {
    if (mode === "Inspect" || ended || game.revealed[index] !== null) {
      setPinned(index);
      return;
    }
    if (mode === "Flag") {
      flag(index);
      return;
    }
    const next = reveal(game, index);
    if (next === game) return;
    if (next.revealed === game.revealed) {
      setSession({ ...session, game: next });
      if (next.status === "lost") setPinned(index);
      return;
    }
    const start = performance.now();
    try {
      const result = solve(observation(next));
      setSession({
        game: next,
        analysis: result,
        previous: analysis,
        elapsed: performance.now() - start,
        error: null,
      });
    } catch (error) {
      console.error("Inference failed", error);
      setSession({
        game: next,
        analysis: null,
        previous: null,
        elapsed: 0,
        error: String(error),
      });
    }
  }

  function flag(index: number) {
    setSession((current) => ({
      ...current,
      game: toggleFlag(current.game, index),
    }));
  }

  function restart() {
    setSession(fresh());
    setMode("Reveal");
    setPinned(null);
    setPreview(null);
    setFocusIndex(0);
  }

  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const { columns, rows } = game.config;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const directions: Record<string, number> = {
      ArrowLeft: row * columns + Math.max(0, col - 1),
      ArrowRight: row * columns + Math.min(columns - 1, col + 1),
      ArrowUp: Math.max(0, row - 1) * columns + col,
      ArrowDown: Math.min(rows - 1, row + 1) * columns + col,
      Home: row * columns,
      End: row * columns + columns - 1,
    };
    if (event.key in directions) {
      event.preventDefault();
      cells.current[directions[event.key]]?.focus();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      flag(index);
    } else if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      setPinned(index);
      setMode("Inspect");
    }
  }

  return (
    <>
      <nav className="masthead" aria-label="Main navigation">
        <a className="brand" href="#">
          <span className="brand-icon" aria-hidden="true">
            ▦
          </span>{" "}
          PROBABILITY LAB <span className="brand-divider">/</span>
          <span className="brand-sub">MINESWEEPER</span>
        </a>
        <a href="#methodology" className="method-link">
          Behind the numbers <span aria-hidden="true">↗</span>
        </a>
      </nav>
      <main>
        <header className="intro">
          <p className="eyebrow">
            <span className="live-dot" /> AN INTERACTIVE EXPLORATION OF
            UNCERTAINTY
          </p>
          <h1>
            Minesweeper
            <br />
            <span>Probability Lab.</span>
          </h1>
          <p className="description">
            The classic game. A new way to see your odds. Reveal a tile and
            watch the possibilities change — one clue at a time.
          </p>
          <p className="instructions">
            <strong>Make it your own.</strong> Click to reveal, right-click to
            flag, or use Inspect to explore. Flags are your educated guesses;
            try them with or without the heatmap. They don’t change the model’s
            probabilities.
          </p>
        </header>

        <section className="workspace" aria-label="Minesweeper experiment">
          <div className="game-card">
            <div className="game-toolbar">
              <div>
                <span className="eyebrow">THE BOARD</span>
                <p className="board-meta">
                  9 × 9 <span>·</span> 10 mines <span>·</span> Beginner
                </p>
              </div>
              <button className="restart" onClick={restart}>
                <span aria-hidden="true">↻</span> New board
              </button>
            </div>
            <div className="controls-row">
              <div className="modes" role="group" aria-label="Interaction mode">
                {(["Reveal", "Flag", "Inspect"] as Mode[]).map((value) => (
                  <button
                    key={value}
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <span className="flag-count">
                ⚑ <span>Flags</span> {game.flags.size} / {game.config.mineCount}
              </span>
            </div>

            <div className="board-wrap">
              <div className="column-labels" aria-hidden="true">
                {"ABCDEFGHI".split("").map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="board-with-rows">
                <div className="row-labels" aria-hidden="true">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <div
                  className="board"
                  role="group"
                  aria-label={`Minesweeper board. ${mode} mode. Arrow keys navigate; Enter or Space activates; F flags; I inspects.`}
                >
                  {game.revealed.map((clue, i) => {
                    const probability = analysis?.tiles[i];
                    const isMine = ended && game.mines?.has(i);
                    const flagged = game.flags.has(i);
                    const colored =
                      clue === null &&
                      heatmap &&
                      probability?.frontier &&
                      !isMine;
                    const label =
                      clue !== null
                        ? `revealed clue ${clue}`
                        : isMine
                          ? "revealed mine"
                          : probability
                            ? `${probabilityLabel(probability)} mine probability${probability.frontier ? "" : ", no adjacent clue"}`
                            : "hidden";
                    return (
                      <button
                        key={i}
                        ref={(el) => {
                          cells.current[i] = el;
                        }}
                        tabIndex={focusIndex === i ? 0 : -1}
                        className={`cell ${clue !== null ? "revealed" : "hidden"} ${selected === i ? "selected" : ""} ${isMine ? "mine" : ""} ${game.exploded === i ? "exploded" : ""}`}
                        style={
                          colored
                            ? { backgroundColor: color(probability) }
                            : undefined
                        }
                        aria-label={`${coordinate(i, 9)}: ${label}${flagged ? ", flagged" : ""}`}
                        aria-pressed={pinned === i}
                        onClick={() => act(i)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          flag(i);
                        }}
                        onMouseEnter={() => setPreview(i)}
                        onMouseLeave={() => setPreview(null)}
                        onFocus={() => {
                          setFocusIndex(i);
                          setPreview(i);
                        }}
                        onBlur={() => setPreview(null)}
                        onKeyDown={(event) => key(event, i)}
                      >
                        {clue !== null ? (
                          <span className={`clue clue-${clue}`}>
                            {clue || ""}
                          </span>
                        ) : isMine ? (
                          <span className="mine-mark" aria-hidden="true">
                            ✹
                          </span>
                        ) : flagged ? (
                          <>
                            <span className="flag-mark" aria-hidden="true">
                              ⚑
                            </span>
                            {numbers && probability?.frontier && (
                              <span className="flag-probability">
                                {probabilityLabel(probability)}
                              </span>
                            )}
                          </>
                        ) : numbers && probability?.frontier ? (
                          <span className="probability">
                            {probabilityLabel(probability)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="legend">
              <span>
                0% <strong>Safe</strong>
              </span>
              <div className="gradient" aria-hidden="true" />
              <span>
                <strong>Mine</strong> 100%
              </span>
            </div>
            <div className="display-controls">
              <label>
                <input
                  type="checkbox"
                  checked={heatmap}
                  onChange={(e) => setHeatmap(e.target.checked)}
                />{" "}
                Show heatmap
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={numbers}
                  onChange={(e) => setNumbers(e.target.checked)}
                />{" "}
                Show percentages
              </label>
            </div>
            <p className={`notice ${game.status}`} role="status">
              <span aria-hidden="true">
                {game.status === "won" ? "✓" : "↳"}
              </span>
              {notice}
            </p>
          </div>

          <aside className="inspection" aria-label="Tile explanation">
            <div className="inspection-heading">
              <span className="eyebrow">FOLLOW THE EVIDENCE</span>
              <span className="small-tag">EXACT INFERENCE</span>
            </div>
            <h2>
              {selected === null
                ? "Every tile has a story."
                : `Inside tile ${coordinate(selected, 9)}.`}
            </h2>
            {selected === null ? (
              <>
                <div className="empty-diagram" aria-hidden="true">
                  <span />
                  <span>1</span>
                  <span />
                  <span className="demo-tile">?</span>
                  <span>2</span>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p className="panel-intro">
                  A clue narrows the possibilities.
                  <br />
                  The heatmap makes them visible.
                </p>
                <p>
                  Hover over a tile for a closer look. Switch to{" "}
                  <strong>Inspect</strong> and select a tile to keep its
                  explanation here.
                </p>
              </>
            ) : (
              <>
                <p className="selection-kind">
                  {pinned === selected
                    ? "Pinned for inspection"
                    : "Live preview"}
                  {game.flags.has(selected)
                    ? " · Your flag is placed here"
                    : ""}
                </p>
                {tile ? (
                  <>
                    <div className="probability-readout">
                      <span>{percent(tile.probability)}</span>
                      <span>CHANCE OF A MINE</span>
                    </div>
                    <p className="interpretation">
                      {tile.mineBoards === 0n
                        ? "Every consistent board leaves this tile safe."
                        : tile.mineBoards === tile.totalBoards
                          ? "Every consistent board places a mine here."
                          : "Some consistent boards place a mine here; others leave it safe. The risk is real, even when the percentage is small."}
                    </p>
                    {!tile.frontier && (
                      <p className="gray-note">
                        No adjacent revealed clue. This gray tile shares the
                        background pool’s probability, informed by the total
                        mine count and clues elsewhere.
                      </p>
                    )}
                    <div className="fraction">
                      <span>CONSISTENT BOARDS WITH A MINE HERE</span>
                      <strong>{formatCount(tile.mineBoards)}</strong>
                      <hr />
                      <strong>{formatCount(tile.totalBoards)}</strong>
                      <span>ALL CONSISTENT COMPLETE BOARDS</span>
                    </div>
                    <div className="evidence">
                      <h3>Connected clues</h3>
                      <p>
                        {tile.clueIndices.length
                          ? tile.clueIndices
                              .map(
                                (i) =>
                                  `${coordinate(i, 9)} = ${game.revealed[i]}`,
                              )
                              .join(" · ")
                          : "No local clue constraints. Weighted against all frontier components."}
                      </p>
                    </div>
                    <div className="evidence">
                      <h3>What changed?</h3>
                      <p>
                        {game.status === "lost" && game.exploded === selected
                          ? `Before you clicked, this tile had a ${percent(tile.probability)} chance of a mine. A low-risk choice can still lose.`
                          : oldTile
                            ? `Previously ${percent(oldTile.probability)}. ${oldTile.mineBoards * tile.totalBoards === tile.mineBoards * oldTile.totalBoards ? "The last reveal added evidence without changing this tile’s probability." : "The last reveal changed the set of valid complete boards. The model includes that new evidence and the total mine count."}`
                            : "The opening reveal supplied the first clues. Subsequent reveals will let you compare how this estimate changes."}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="revealed-explanation">
                    <span className="revealed-number">
                      {game.revealed[selected] ?? "?"}
                    </span>
                    <p>
                      {game.revealed[selected] !== null
                        ? `This safe tile touches ${game.revealed[selected]} mine${game.revealed[selected] === 1 ? "" : "s"}. Its clue constrains its covered neighbors.`
                        : "Make your first reveal to generate the board and start the analysis. Only that first selected tile is guaranteed safe."}
                    </p>
                  </div>
                )}
                {pinned !== null && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setPinned(null);
                      setPreview(null);
                    }}
                  >
                    Clear pinned tile ↗
                  </button>
                )}
              </>
            )}
            <div className="panel-footnote">
              <span className="live-dot" />
              <p>
                {analysis
                  ? `${analysis.componentCount} connected group${analysis.componentCount === 1 ? "" : "s"} · ${analysis.unconstrainedCount} background tiles`
                  : "Observations in. Possibilities out."}
                <br />
                The model only sees what you see.
              </p>
            </div>
          </aside>
        </section>

        <section className="methodology" id="methodology">
          <div className="method-intro">
            <p className="eyebrow">BEHIND THE NUMBERS</p>
            <h2>Uncertainty, counted.</h2>
            <p>
              No hidden answers. No learned guesses. Each percentage comes from
              counting the complete boards that agree with your revealed clues.
            </p>
          </div>
          <div className="method-steps">
            <article>
              <span className="step-number">01</span>
              <h3>Read the clues</h3>
              <p>
                A revealed number tells you how many of its neighbors contain
                mines. Overlapping clues become a connected system of
                constraints.
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h3>Count the possibilities</h3>
              <p>
                The solver enumerates valid assignments in each connected group,
                then combines them with the untouched cells and the known mine
                total.
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h3>Compare the risk</h3>
              <p>
                A tile’s probability is the fraction of consistent complete
                boards that contain a mine there. 0% is safe; 100% is a mine;
                everything between is uncertainty.
              </p>
            </article>
          </div>
          <details className="worked-example">
            <summary>
              A small example: why local patterns are not equally likely{" "}
              <span aria-hidden="true">+</span>
            </summary>
            <div>
              <p>
                Consider this one-row board with two mines in total. Letters are
                hidden tiles and numbers are revealed clues:
              </p>
              <div
                className="example-board"
                aria-label="A hidden, clue one, B hidden, clue one, C hidden, X hidden, Y hidden"
              >
                {["A", "1", "B", "1", "C", "X", "Y"].map((value, i) => (
                  <span key={i} className={value === "1" ? "example-clue" : ""}>
                    {value}
                  </span>
                ))}
              </div>
              <p>
                The clues require A + B = 1 and B + C = 1. If B is a mine, A and
                C are safe and the second mine can be in X or Y:{" "}
                <strong>two complete boards</strong>. If B is safe, A and C are
                mines: <strong>one complete board</strong>. So B has a 2/3
                chance of a mine, not 1/2. Each of A, C, X, and Y has a 1/3
                chance.
              </p>
            </div>
          </details>
          <details className="assumptions">
            <summary>
              Assumptions, validation, and limits{" "}
              <span aria-hidden="true">+</span>
            </summary>
            <div>
              <p>
                Mines are sampled uniformly after the first click, excluding
                only the clicked cell. Subsequent probabilities condition on the
                revealed clues and fixed total mine count. Flags are your
                hypotheses and do not change the inference. Revealed zeros
                expand automatically.
              </p>
              <p>
                Counts use exact integers. Tiny-board results are compared
                exhaustively with an independent full-board enumeration. Tests
                also cover symmetry, certainty, disconnected clues, and
                conservation of total mine probability.
              </p>
              <p>
                Exact enumeration can become expensive when many clues connect.
                This first version uses a 9 × 9 board; larger custom boards need
                further performance testing. Colors use a fixed green-to-red
                scale; numeric labels, keyboard controls, and text explanations
                provide additional ways to read the board.
              </p>
            </div>
          </details>
        </section>
        <footer>
          <span>
            MINESWEEPER PROBABILITY LAB{" "}
            <span className="footer-separator">/</span> PLAY. OBSERVE. REASON.
          </span>
          <span>No accounts. No tracking. Just possibilities.</span>
        </footer>
      </main>
    </>
  );
}
