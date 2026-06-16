import type { MapComponent } from "../components/GameComponents";

interface PathNode {
  r: number;
  c: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class MinHeap<T> {
  private data: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  push(val: T): void {
    this.data.push(val);
    this.up(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.down(0);
    }
    return top;
  }

  size(): number {
    return this.data.length;
  }

  private up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[p]) < 0) {
        this.swap(i, p);
        i = p;
      } else {
        break;
      }
    }
  }

  private down(i: number): void {
    const len = this.data.length;
    while ((i << 1) + 1 < len) {
      let left = (i << 1) + 1;
      let right = left + 1;
      let best = left;
      if (right < len && this.compare(this.data[right], this.data[left]) < 0) {
        best = right;
      }
      if (this.compare(this.data[best], this.data[i]) < 0) {
        this.swap(i, best);
        i = best;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = temp;
  }
}

export function findPath(
  map: MapComponent,
  start: { r: number; c: number },
  end: { r: number; c: number }
): { r: number; c: number }[] | null {
  if (
    start.r < 0 ||
    start.r >= map.height ||
    start.c < 0 ||
    start.c >= map.width ||
    end.r < 0 ||
    end.r >= map.height ||
    end.c < 0 ||
    end.c >= map.width
  ) {
    return null;
  }

  const endWeight = map.weights[end.r]?.[end.c] ?? Infinity;
  const isGoalNonWalkable = endWeight === Infinity;

  // If goal is non-walkable and we are already adjacent, path is just [start]
  if (isGoalNonWalkable && Math.abs(start.c - end.c) + Math.abs(start.r - end.r) === 1) {
    return [start];
  }

  if (start.r === end.r && start.c === end.c) {
    return [start];
  }

  const openSet = new MinHeap<PathNode>((a, b) => a.f - b.f || a.h - b.h);
  const closedSet = new Uint8Array(map.width * map.height);
  const openGValues = new Float32Array(map.width * map.height);
  openGValues.fill(Infinity);

  const startH = Math.abs(start.c - end.c) + Math.abs(start.r - end.r);
  const startNode: PathNode = {
    r: start.r,
    c: start.c,
    g: 0,
    h: startH,
    f: startH,
    parent: null,
  };

  openSet.push(startNode);
  openGValues[start.r * map.width + start.c] = 0;

  const dr = [-1, 1, 0, 0];
  const dc = [0, 0, -1, 1];

  while (openSet.size() > 0) {
    const curr = openSet.pop()!;

    // Check termination
    if (isGoalNonWalkable) {
      // Terminate when adjacent to non-walkable goal
      if (Math.abs(curr.c - end.c) + Math.abs(curr.r - end.r) === 1) {
        const path: { r: number; c: number }[] = [];
        let temp: PathNode | null = curr;
        while (temp !== null) {
          path.push({ r: temp.r, c: temp.c });
          temp = temp.parent;
        }
        return path.reverse();
      }
    } else {
      // Standard target reach
      if (curr.r === end.r && curr.c === end.c) {
        const path: { r: number; c: number }[] = [];
        let temp: PathNode | null = curr;
        while (temp !== null) {
          path.push({ r: temp.r, c: temp.c });
          temp = temp.parent;
        }
        return path.reverse();
      }
    }

    const currIdx = curr.r * map.width + curr.c;
    closedSet[currIdx] = 1;

    for (let i = 0; i < 4; i++) {
      const nr = curr.r + dr[i];
      const nc = curr.c + dc[i];

      if (nr < 0 || nr >= map.height || nc < 0 || nc >= map.width) {
        continue;
      }

      const nIdx = nr * map.width + nc;
      if (closedSet[nIdx] === 1) {
        continue;
      }

      const weight = map.weights[nr][nc];
      // Skip pathing through Infinity weight obstacles
      if (weight === Infinity) {
        continue;
      }

      const gScore = curr.g + weight;
      if (gScore >= openGValues[nIdx]) {
        continue;
      }

      const h = Math.abs(nc - end.c) + Math.abs(nr - end.r);
      const f = gScore + h;

      const neighbor: PathNode = {
        r: nr,
        c: nc,
        g: gScore,
        h: h,
        f: f,
        parent: curr,
      };

      openGValues[nIdx] = gScore;
      openSet.push(neighbor);
    }
  }

  return null;
}
