export function drawMapPreview(
  canvas: HTMLCanvasElement,
  map: {
    grid: number[][];
    wallColor: string;
    blockColor: string;
    floorColor: string;
  },
): void {
  const ctx = canvas.getContext("2d")!;
  const rows = map.grid.length;
  const cols = map.grid[0].length;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = map.grid[r][c];
      ctx.fillStyle =
        t === 1 ? map.wallColor : t === 2 ? map.blockColor : map.floorColor;
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }
}
