import { describe, expect, it } from "vitest";
import { neighbors, type Observation } from "./board";
import { choose, probabilityLabel, solve } from "./solver";

// Independent oracle: try every complete board; do not reuse solver counting.
function bruteForce(board: Observation) {
  const size = board.rows * board.columns;
  const counts = Array<bigint>(size).fill(0n);
  let total = 0n;
  for (let mask = 0; mask < 2 ** size; mask++) {
    const mines = Array.from({ length: size }, (_, i) =>
      Boolean(mask & (1 << i)),
    );
    if (mines.filter(Boolean).length !== board.mineCount) continue;
    if (
      !board.revealed.every(
        (clue, i) =>
          clue === null ||
          (!mines[i] &&
            neighbors(i, board).filter((j) => mines[j]).length === clue),
      )
    )
      continue;
    total++;
    mines.forEach((mine, i) => {
      if (mine) counts[i]++;
    });
  }
  return { total, counts };
}

describe("exact conditional probabilities", () => {
  it("matches every mine placement and every subset of safe observations on a 2×3 board", () => {
    for (let mask = 0; mask < 63; mask++) {
      const mines = new Set(
        Array.from({ length: 6 }, (_, i) => i).filter((i) => mask & (1 << i)),
      );
      const safe = Array.from({ length: 6 }, (_, i) => i).filter(
        (i) => !mines.has(i),
      );
      for (let subset = 0; subset < 2 ** safe.length; subset++) {
        const board: Observation = {
          rows: 2,
          columns: 3,
          mineCount: mines.size,
          revealed: Array(6).fill(null),
        };
        board.revealed = board.revealed.map((_, i) => {
          const pos = safe.indexOf(i);
          return pos >= 0 && subset & (1 << pos)
            ? neighbors(i, board).filter((j) => mines.has(j)).length
            : null;
        });
        const expected = bruteForce(board);
        const result = solve(board);
        expect(result.totalBoards).toBe(expected.total);
        let sum = 0n;
        result.tiles.forEach((tile, i) => {
          if (!tile) return;
          expect(tile.mineBoards).toBe(expected.counts[i]);
          expect(tile.probability).toBeGreaterThanOrEqual(0);
          expect(tile.probability).toBeLessThanOrEqual(1);
          sum += tile.mineBoards;
        });
        expect(sum).toBe(BigInt(board.mineCount) * result.totalBoards);
      }
    }
  });

  it("weights local patterns by completions in the gray region", () => {
    const result = solve({
      rows: 1,
      columns: 7,
      mineCount: 2,
      revealed: [null, 1, null, 1, null, null, null],
    });
    expect(result.totalBoards).toBe(3n);
    expect(result.tiles[2]?.mineBoards).toBe(2n);
    for (const i of [0, 4, 5, 6]) expect(result.tiles[i]?.mineBoards).toBe(1n);
    expect(result.tiles[5]?.frontier).toBe(false);
  });

  it("combines disconnected frontiers with the global mine count", () => {
    const board = {
      rows: 1,
      columns: 9,
      mineCount: 3,
      revealed: [null, 1, null, null, null, null, null, 1, null],
    };
    const result = solve(board);
    expect(result.componentCount).toBe(2);
    expect(result.totalBoards).toBe(12n);
    for (const i of [0, 2, 6, 8])
      expect(result.tiles[i]?.probability).toBe(0.5);
    for (const i of [3, 4, 5]) expect(result.tiles[i]?.mineBoards).toBe(4n);
    expect(result.totalBoards).toBe(bruteForce(board).total);
  });

  it("recognizes globally certain gray tiles and exact forced states", () => {
    const result = solve({
      rows: 1,
      columns: 4,
      mineCount: 1,
      revealed: [1, null, null, null],
    });
    expect(probabilityLabel(result.tiles[1]!)).toBe("MINE");
    expect(probabilityLabel(result.tiles[2]!)).toBe("SAFE");
    expect(result.tiles[2]?.frontier).toBe(false);
  });

  it("keeps large counts exact and never rounds uncertainty into certainty", () => {
    expect(choose(80, 10)).toBe(1646492110120n);
    const result = solve({
      rows: 9,
      columns: 9,
      mineCount: 10,
      revealed: Array(81).fill(null),
    });
    expect(result.totalBoards).toBe(choose(81, 10));
    expect(result.tiles[0]?.mineBoards).toBe(choose(80, 9));
    expect(result.tiles[0]?.probability).toBeCloseTo(10 / 81);
    const template = result.tiles[0]!;
    expect(
      probabilityLabel({
        ...template,
        mineBoards: 1n,
        totalBoards: 1000n,
        probability: 0.001,
      }),
    ).toBe("<1%");
    expect(
      probabilityLabel({
        ...template,
        mineBoards: 999n,
        totalBoards: 1000n,
        probability: 0.999,
      }),
    ).toBe(">99%");
  });

  it("rejects malformed or impossible observations", () => {
    expect(() =>
      solve({ rows: 0, columns: 3, mineCount: 1, revealed: [] }),
    ).toThrow();
    expect(() =>
      solve({ rows: 1, columns: 3, mineCount: 1, revealed: [1] }),
    ).toThrow();
    expect(() =>
      solve({ rows: 1, columns: 3, mineCount: 1, revealed: [0, null, 1] }),
    ).toThrow();
    expect(() =>
      solve({ rows: 1, columns: 3, mineCount: 1, revealed: [NaN, null, null] }),
    ).toThrow();
    expect(() =>
      solve({ rows: 1, columns: 3, mineCount: 2, revealed: [0, 0, null] }),
    ).toThrow();
  });
});
