import type { Vector } from './vector';

export { Point };

/**
 * Represents a point in two-dimensional space.
 */
class Point {
  public readonly x: number;
  public readonly y: number;

  /**
   * Creates a point with the given x and y coordinates.
   */
  public constructor({ x, y }: { x: number; y: number }) {
    this.x = x;
    this.y = y;
  }

  /**
   * Returns a copy of this point.
   */
  public clone(): Point {
    return new Point({ x: this.x, y: this.y });
  }

  /**
   * Returns whether this point is equal to another point within the configured tolerance.
   */
  public equalTo({ point }: { point: Point }): boolean {
    return (
      equalNumber({ a: this.x, b: point.x }) &&
      equalNumber({ a: this.y, b: point.y })
    );
  }

  /**
   * Returns a new point translated by the given vector.
   */
  public translate({ vector }: { vector: Vector }): Point {
    return new Point({ x: this.x + vector.x, y: this.y + vector.y });
  }
}

const Tolerance = 0.000001;

/**
 * Returns whether two numbers are equal within the configured tolerance.
 */
function equalNumber({ a, b }: { a: number; b: number }): boolean {
  const difference = a - b;
  return difference < Tolerance && difference > -Tolerance;
}
