import { neighbors, validateConfig, type Observation } from "./board";

export interface TileProbability {
  mineBoards: bigint;
  totalBoards: bigint;
  probability: number;
  frontier: boolean;
  clueIndices: number[];
}

export interface Analysis {
  tiles: (TileProbability | null)[];
  totalBoards: bigint;
  componentCount: number;
  unconstrainedCount: number;
}

interface Constraint {
  cells: number[];
  mines: number;
  clue: number;
}
interface Component {
  cells: number[];
  clues: number[];
  counts: bigint[];
  mineCounts: Map<number, bigint[]>;
}

export function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let result = 1n;
  for (let i = 1; i <= k; i++)
    result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
}

function convolve(a: bigint[], b: bigint[], max: number): bigint[] {
  const out = Array<bigint>(Math.min(a.length + b.length - 1, max + 1)).fill(
    0n,
  );
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length && i + j < out.length; j++)
      out[i + j] += a[i] * b[j];
  }
  return out;
}

function enumerate(
  cells: number[],
  constraints: Constraint[],
  max: number,
): Component {
  const membership = new Map(
    cells.map((cell) => [
      cell,
      constraints.flatMap((c, i) => (c.cells.includes(cell) ? [i] : [])),
    ]),
  );
  const ordered = [...cells].sort(
    (a, b) => membership.get(b)!.length - membership.get(a)!.length,
  );
  const remaining = constraints.map((c) => c.cells.length);
  const assigned = constraints.map(() => 0);
  const selected: number[] = [];
  const counts = Array<bigint>(Math.min(cells.length, max) + 1).fill(0n);
  const mineCounts = new Map(cells.map((cell) => [cell, counts.map(() => 0n)]));

  function visit(depth: number, mines: number): void {
    if (depth === ordered.length) {
      counts[mines]++;
      for (const cell of selected) mineCounts.get(cell)![mines]++;
      return;
    }
    const cell = ordered[depth];
    const touched = membership.get(cell)!;
    for (const value of [0, 1]) {
      if (mines + value > max) continue;
      let valid = true;
      for (const i of touched) {
        remaining[i]--;
        assigned[i] += value;
        if (
          assigned[i] > constraints[i].mines ||
          assigned[i] + remaining[i] < constraints[i].mines
        )
          valid = false;
      }
      if (valid) {
        if (value) selected.push(cell);
        visit(depth + 1, mines + value);
        if (value) selected.pop();
      }
      for (const i of touched) {
        assigned[i] -= value;
        remaining[i]++;
      }
    }
  }
  visit(0, 0);
  return { cells, clues: constraints.map((c) => c.clue), counts, mineCounts };
}

export function solve(board: Observation): Analysis {
  validateConfig(board);
  const { revealed, mineCount } = board;
  if (revealed.length !== board.rows * board.columns)
    throw new RangeError("Observation size does not match the board.");
  const hidden: number[] = [];
  const constraints: Constraint[] = [];
  for (let i = 0; i < revealed.length; i++) {
    const clue = revealed[i];
    if (clue === null) {
      hidden.push(i);
      continue;
    }
    const adjacent = neighbors(i, board);
    if (!Number.isInteger(clue) || clue < 0 || clue > adjacent.length)
      throw new RangeError("Invalid revealed clue.");
    const cells = adjacent.filter((cell) => revealed[cell] === null);
    if (clue > cells.length || (!cells.length && clue !== 0))
      throw new Error("No mine placements satisfy these observations.");
    if (cells.length) constraints.push({ cells, mines: clue, clue: i });
  }
  if (hidden.length < mineCount)
    throw new Error("More mines than hidden cells.");
  const cellConstraints = new Map<number, number[]>();
  constraints.forEach((c, i) =>
    c.cells.forEach((cell) => {
      const list = cellConstraints.get(cell) ?? [];
      list.push(i);
      cellConstraints.set(cell, list);
    }),
  );
  const visited = new Set<number>();
  const components: Component[] = [];
  for (const start of cellConstraints.keys()) {
    if (visited.has(start)) continue;
    const cells: number[] = [];
    const clueSet = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const cell = stack.pop()!;
      if (visited.has(cell)) continue;
      visited.add(cell);
      cells.push(cell);
      for (const c of cellConstraints.get(cell)!) {
        if (clueSet.has(c)) continue;
        clueSet.add(c);
        stack.push(...constraints[c].cells);
      }
    }
    components.push(
      enumerate(
        cells,
        [...clueSet].map((i) => constraints[i]),
        mineCount,
      ),
    );
  }
  const background = hidden.filter((cell) => !cellConstraints.has(cell));
  const prefix: bigint[][] = [[1n]];
  for (const component of components)
    prefix.push(convolve(prefix.at(-1)!, component.counts, mineCount));
  const suffix: bigint[][] = Array(components.length + 1);
  suffix[components.length] = [1n];
  for (let i = components.length - 1; i >= 0; i--)
    suffix[i] = convolve(components[i].counts, suffix[i + 1], mineCount);
  const all = prefix.at(-1)!;
  const totalBoards = all.reduce(
    (sum, count, k) => sum + count * choose(background.length, mineCount - k),
    0n,
  );
  if (!totalBoards)
    throw new Error("No mine placements satisfy these observations.");
  const tiles: Analysis["tiles"] = revealed.map(() => null);
  function tile(
    mineBoards: bigint,
    frontier: boolean,
    clueIndices: number[],
  ): TileProbability {
    return {
      mineBoards,
      totalBoards,
      frontier,
      clueIndices,
      probability: Number(mineBoards) / Number(totalBoards),
    };
  }
  components.forEach((component, i) => {
    const others = convolve(prefix[i], suffix[i + 1], mineCount);
    const weights = component.counts.map((_, k) =>
      others.reduce(
        (sum, count, j) =>
          sum + count * choose(background.length, mineCount - k - j),
        0n,
      ),
    );
    for (const cell of component.cells) {
      const mineBoards = component.mineCounts
        .get(cell)!
        .reduce((sum, count, k) => sum + count * weights[k], 0n);
      tiles[cell] = tile(mineBoards, true, component.clues);
    }
  });
  if (background.length) {
    const mineBoards = all.reduce(
      (sum, count, k) =>
        sum + count * choose(background.length - 1, mineCount - k - 1),
      0n,
    );
    for (const cell of background) tiles[cell] = tile(mineBoards, false, []);
  }
  return {
    tiles,
    totalBoards,
    componentCount: components.length,
    unconstrainedCount: background.length,
  };
}

export function probabilityLabel(tile: TileProbability): string {
  if (tile.mineBoards === 0n) return "SAFE";
  if (tile.mineBoards === tile.totalBoards) return "MINE";
  if (tile.probability < 0.01) return "<1%";
  if (tile.probability > 0.99) return ">99%";
  return `${Math.round(tile.probability * 100)}%`;
}
