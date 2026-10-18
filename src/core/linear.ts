/**
 * Solves the dense linear system `a · x = b` by Gaussian elimination with partial pivoting.
 *
 * `a` is an n × n matrix stored row by row. Neither argument is modified. Kit-sized circuits have
 * well under 100 nodes, where a dense solve is simpler than and as fast as a sparse one.
 */
export function solveLinearSystem(a: Float64Array, b: Float64Array): Float64Array {
  const n = b.length;
  if (a.length !== n * n) {
    throw new RangeError(`Matrix has ${a.length} entries; expected ${n * n}`);
  }
  const m = Float64Array.from(a);
  const x = Float64Array.from(b);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row * n + col]!) > Math.abs(m[pivot * n + col]!)) {
        pivot = row;
      }
    }
    const pivotValue = m[pivot * n + col]!;
    if (pivotValue === 0 || !Number.isFinite(pivotValue)) {
      throw new RangeError('Matrix is singular');
    }
    if (pivot !== col) {
      swapRows(m, n, pivot, col);
      const t = x[pivot]!;
      x[pivot] = x[col]!;
      x[col] = t;
    }
    for (let row = col + 1; row < n; row++) {
      const factor = m[row * n + col]! / pivotValue;
      if (factor === 0) {
        continue;
      }
      for (let k = col; k < n; k++) {
        m[row * n + k] = m[row * n + k]! - factor * m[col * n + k]!;
      }
      x[row] = x[row]! - factor * x[col]!;
    }
  }

  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row]!;
    for (let k = row + 1; k < n; k++) {
      sum -= m[row * n + k]! * x[k]!;
    }
    x[row] = sum / m[row * n + row]!;
  }
  return x;
}

function swapRows(m: Float64Array, n: number, i: number, j: number): void {
  for (let k = 0; k < n; k++) {
    const t = m[i * n + k]!;
    m[i * n + k] = m[j * n + k]!;
    m[j * n + k] = t;
  }
}
