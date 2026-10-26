import {
  BEGINNER,
  neighbors,
  validateConfig,
  type BoardConfig,
  type Observation,
} from "./board";

export interface Game {
  config: BoardConfig;
  mines: ReadonlySet<number> | null;
  revealed: readonly (number | null)[];
  flags: ReadonlySet<number>;
  status: "ready" | "playing" | "won" | "lost";
  exploded: number | null;
}

export function newGame(config: BoardConfig = BEGINNER): Game {
  validateConfig(config);
  return {
    config: { ...config },
    mines: null,
    revealed: Array(config.rows * config.columns).fill(null),
    flags: new Set(),
    status: "ready",
    exploded: null,
  };
}

function validateIndex(game: Game, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= game.revealed.length) {
    throw new RangeError("Tile is outside the board.");
  }
}

export function toggleFlag(game: Game, index: number): Game {
  validateIndex(game, index);
  if (
    game.status === "won" ||
    game.status === "lost" ||
    game.revealed[index] !== null
  )
    return game;
  const flags = new Set(game.flags);
  if (flags.has(index)) flags.delete(index);
  else if (flags.size < game.config.mineCount) flags.add(index);
  else return game;
  return { ...game, flags };
}

export function reveal(
  game: Game,
  index: number,
  random: () => number = Math.random,
): Game {
  validateIndex(game, index);
  if (
    game.status === "won" ||
    game.status === "lost" ||
    game.flags.has(index) ||
    game.revealed[index] !== null
  )
    return game;
  let mines = game.mines;
  if (!mines) {
    const candidates = game.revealed
      .map((_, i) => i)
      .filter((i) => i !== index);
    const placed = new Set<number>();
    for (let i = 0; i < game.config.mineCount; i++) {
      const value = random();
      if (value < 0 || value >= 1 || !Number.isFinite(value))
        throw new RangeError("Random source must return [0, 1).");
      const pick = i + Math.floor(value * (candidates.length - i));
      [candidates[i], candidates[pick]] = [candidates[pick], candidates[i]];
      placed.add(candidates[i]);
    }
    mines = placed;
  }
  if (mines.has(index))
    return { ...game, mines, status: "lost", exploded: index };
  const revealed = [...game.revealed];
  const queue = [index];
  while (queue.length) {
    const cell = queue.pop()!;
    if (revealed[cell] !== null || game.flags.has(cell) || mines.has(cell))
      continue;
    const adjacent = neighbors(cell, game.config);
    const clue = adjacent.filter((i) => mines.has(i)).length;
    revealed[cell] = clue;
    if (clue === 0) queue.push(...adjacent);
  }
  const won =
    revealed.filter((value) => value !== null).length ===
    revealed.length - game.config.mineCount;
  return { ...game, mines, revealed, status: won ? "won" : "playing" };
}

export function observation(game: Game): Observation {
  return { ...game.config, revealed: game.revealed };
}
