export interface BoardConfig {
  rows: number;
  columns: number;
  mineCount: number;
}

export interface Observation extends BoardConfig {
  revealed: readonly (number | null)[];
}

export const BEGINNER: BoardConfig = { rows: 9, columns: 9, mineCount: 10 };

export function validateConfig(config: BoardConfig): void {
  const { rows, columns, mineCount } = config;
  if (
    !Number.isSafeInteger(rows) ||
    rows < 1 ||
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    !Number.isSafeInteger(rows * columns) ||
    !Number.isSafeInteger(mineCount) ||
    mineCount < 0 ||
    mineCount >= rows * columns
  ) {
    throw new RangeError(
      "A board needs positive dimensions and fewer mines than cells.",
    );
  }
}

export function neighbors(
  index: number,
  { rows, columns }: BoardConfig,
): number[] {
  const result: number[] = [];
  const row = Math.floor(index / columns);
  const col = index % columns;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (
        (dr !== 0 || dc !== 0) &&
        row + dr >= 0 &&
        row + dr < rows &&
        col + dc >= 0 &&
        col + dc < columns
      ) {
        result.push((row + dr) * columns + col + dc);
      }
    }
  }
  return result;
}

export function coordinate(index: number, columns: number): string {
  return `${String.fromCharCode(65 + (index % columns))}${Math.floor(index / columns) + 1}`;
}
