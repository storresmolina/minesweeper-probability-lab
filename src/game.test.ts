import { expect, it } from "vitest";
import { newGame, observation, reveal, toggleFlag } from "./game";
import { neighbors } from "./board";
import { solve } from "./solver";

it("makes every possible first click safe and places exactly the configured mines", () => {
  for (let i = 0; i < 81; i++) {
    const game = reveal(newGame(), i, () => 0.5);
    expect(game.mines?.size).toBe(10);
    expect(game.mines?.has(i)).toBe(false);
    expect(game.revealed[i]).not.toBeNull();
  }
});

it("limits flags to mineCount and ignores flags as solver evidence", () => {
  const initial = newGame({ rows: 2, columns: 3, mineCount: 2 });
  const flagged = toggleFlag(toggleFlag(initial, 0), 1);
  expect(toggleFlag(flagged, 2)).toBe(flagged);
  expect(reveal(flagged, 0)).toBe(flagged);
  expect(observation(flagged)).toEqual(observation(initial));
  expect(solve(observation(flagged))).toEqual(solve(observation(initial)));
  expect(toggleFlag(flagged, 0).flags.size).toBe(1);
});

it("expands a zero region and wins by revealing safe cells, without flags", () => {
  const config = { rows: 3, columns: 3, mineCount: 1 };
  const game = {
    ...newGame(config),
    mines: new Set([0]),
    status: "playing" as const,
  };
  const won = reveal(game, 8);
  expect(won.status).toBe("won");
  expect(won.revealed.filter((n) => n !== null)).toHaveLength(8);
  expect(won.flags.size).toBe(0);
  expect(won.revealed[0]).toBeNull();
  expect(toggleFlag(won, 0)).toBe(won);
  expect(reveal(won, 0)).toBe(won);
});

it("preserves flags during zero expansion and permits recovery from a wrong hypothesis", () => {
  const game = {
    ...newGame({ rows: 3, columns: 3, mineCount: 1 }),
    mines: new Set([0]),
    status: "playing" as const,
  };
  const expanded = reveal(toggleFlag(game, 8), 7);
  expect(expanded.revealed[8]).toBeNull();
  expect(expanded.status).toBe("playing");
  expect(reveal(toggleFlag(expanded, 8), 8).status).toBe("won");
});

it("freezes a loss without leaking the clicked mine into the observation", () => {
  const started = reveal(newGame(), 40, () => 0.5);
  const mine = [...started.mines!][0];
  const lost = reveal(started, mine);
  expect(lost.status).toBe("lost");
  expect(lost.exploded).toBe(mine);
  expect(observation(lost)).toEqual(observation(started));
  expect(Object.keys(observation(lost)).sort()).toEqual([
    "columns",
    "mineCount",
    "revealed",
    "rows",
  ]);
  expect(reveal(lost, 0)).toBe(lost);
  expect(toggleFlag(lost, mine)).toBe(lost);
});

it("produces correct clues and rejects out-of-range actions and invalid inputs", () => {
  const game = reveal(newGame(), 0, () => 0.25);
  for (let i = 0; i < 81; i++) {
    if (game.revealed[i] !== null)
      expect(game.revealed[i]).toBe(
        neighbors(i, game.config).filter((n) => game.mines!.has(n)).length,
      );
  }
  expect(() => newGame({ rows: 2, columns: 2, mineCount: 4 })).toThrow();
  expect(() => reveal(newGame(), -1)).toThrow();
  expect(() => toggleFlag(newGame(), 81)).toThrow();
  expect(() => reveal(newGame(), 0, () => 1)).toThrow();
});
