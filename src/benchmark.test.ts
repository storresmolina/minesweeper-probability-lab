import { expect, it } from "vitest";
import { newGame, observation, reveal } from "./game";
import { solve } from "./solver";

it("benchmarks exact inference over reproducible beginner games", () => {
  const timings: number[] = [];
  let largestFrontier = 0;
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    let game = reveal(newGame(), Math.floor(random() * 81), random);
    while (game.status === "playing") {
      const start = performance.now();
      const analysis = solve(observation(game));
      timings.push(performance.now() - start);
      largestFrontier = Math.max(
        largestFrontier,
        analysis.tiles.filter((t) => t?.frontier).length,
      );
      // Choose among equally lowest-risk cells, using only the solver's public evidence.
      const hidden = analysis.tiles.flatMap((tile, i) =>
        tile ? [{ tile, i }] : [],
      );
      const min = Math.min(...hidden.map(({ tile }) => tile.probability));
      const choices = hidden.filter(({ tile }) => tile.probability === min);
      const selected = choices[Math.floor(random() * choices.length)].i;
      game = reveal(game, selected, random);
    }
  }
  timings.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      games: 100,
      positions: timings.length,
      totalFrontierMax: largestFrontier,
      medianMs: timings[Math.floor(timings.length * 0.5)],
      p95Ms: timings[Math.floor(timings.length * 0.95)],
      maxMs: timings.at(-1),
    }),
  );
  expect(timings.length).toBeGreaterThan(100);
  expect(timings.every(Number.isFinite)).toBe(true);
}, 30000);
