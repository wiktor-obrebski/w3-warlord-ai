import type { Vector } from "./vector";

const TOLERANCE = 0.000001;

/**
 * Represents a point in two-dimensional space.
 */
export class Point {
  public readonly x: number;
  public readonly y: number;

  /**
   * Creates a point with the given x and y coordinates.
   */
  public constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Returns a copy of this point.
   */
  public clone(): Point {
    return new Point(this.x, this.y);
  }

  /**
   * Returns whether this point is equal to another point within the configured tolerance.
   */
  public equalTo(point: Point): boolean {
    return equalNumber(this.x, point.x) && equalNumber(this.y, point.y);
  }

  /**
   * Returns a new point translated by the given vector.
   */
  public translate(vector: Vector): Point {
    return new Point(this.x + vector.x, this.y + vector.y);
  }
}

/**
 * Returns whether two numbers are equal within the configured tolerance.
 */
function equalNumber(a: number, b: number): boolean {
  const difference = a - b;
  return difference < TOLERANCE && difference > -TOLERANCE;
}
