import type { Vector } from "./vector";

export { Point };

const TOLERANCE = 0.000001;

class Point {
  public readonly x: number;
  public readonly y: number;

  public constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public clone(): Point {
    return new Point(this.x, this.y);
  }

  public equalTo(point: Point): boolean {
    return equalNumber(this.x, point.x) && equalNumber(this.y, point.y);
  }

  public translate(vector: Vector): Point {
    return new Point(this.x + vector.x, this.y + vector.y);
  }
}

function equalNumber(a: number, b: number): boolean {
  const difference = a - b;
  return difference < TOLERANCE && difference > -TOLERANCE;
}
