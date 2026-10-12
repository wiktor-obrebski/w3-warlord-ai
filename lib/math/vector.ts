import type { Point } from './point';

export { Vector };

class Vector {
  public readonly x: number;
  public readonly y: number;

  /**
   * Creates a vector from its x and y components.
   */
  public constructor({ x, y }: { x: number; y: number });

  /**
   * Creates a vector pointing from `start` to `end`.
   */
  public constructor({ start, end }: { start: Point; end: Point });

  public constructor(
    args: { x: number; y: number } | { start: Point; end: Point }
  ) {
    if ('start' in args) {
      this.x = args.end.x - args.start.x;
      this.y = args.end.y - args.start.y;
      return;
    }

    this.x = args.x;
    this.y = args.y;
  }

  /**
   * Returns a copy of this vector.
   */
  public clone(): Vector {
    return new Vector({ x: this.x, y: this.y });
  }

  /**
   * Returns the direction of this vector in radians in the range [0, 2π).
   *
   * The angle is measured counterclockwise from the positive x-axis.
   */
  public get slope(): number {
    const angle = Math.atan2(this.y, this.x);
    return angle < 0 ? angle + TwoPi : angle;
  }

  /**
   * Returns the Euclidean length of this vector.
   */
  public get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Returns whether this vector has effectively zero length.
   */
  public isZeroLength(): boolean {
    return this.length < Tolerance;
  }

  /**
   * Returns whether this vector is equal to another vector within the configured tolerance.
   */
  public equalTo({ vector }: { vector: Vector }): boolean {
    return (
      equalNumber({ a: this.x, b: vector.x }) &&
      equalNumber({ a: this.y, b: vector.y })
    );
  }

  /**
   * Returns this vector multiplied by a scalar.
   */
  public multiply({ scalar }: { scalar: number }): Vector {
    return new Vector({ x: this.x * scalar, y: this.y * scalar });
  }

  /**
   * Returns the dot product of this vector and another vector.
   */
  public dot({ vector }: { vector: Vector }): number {
    return this.x * vector.x + this.y * vector.y;
  }

  /**
   * Returns the 2D cross product of this vector and another vector.
   *
   * The result is a scalar whose sign indicates their relative orientation.
   */
  public cross({ vector }: { vector: Vector }): number {
    return this.x * vector.y - this.y * vector.x;
  }

  /**
   * Returns a unit vector with the same direction as this vector.
   *
   * @throws If this vector has zero length.
   */
  public normalize(): Vector {
    const length = this.length;

    if (length < Tolerance) {
      throw new Error('Cannot normalize a zero-length vector');
    }

    return new Vector({ x: this.x / length, y: this.y / length });
  }

  /**
   * Returns this vector rotated counterclockwise by the given angle in radians.
   */
  public rotate({ angle }: { angle: number }): Vector {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Vector({
      x: this.x * cos - this.y * sin,
      y: this.x * sin + this.y * cos,
    });
  }

  /**
   * Returns this vector rotated 90 degrees counterclockwise.
   */
  public rotate90Ccw(): Vector {
    return new Vector({ x: -this.y, y: this.x });
  }

  /**
   * Returns this vector rotated 90 degrees clockwise.
   */
  public rotate90Cw(): Vector {
    return new Vector({ x: this.y, y: -this.x });
  }

  /**
   * Returns a vector with the opposite direction and the same length.
   */
  public invert(): Vector {
    return new Vector({ x: -this.x, y: -this.y });
  }

  /**
   * Returns the sum of this vector and another vector.
   */
  public add({ vector }: { vector: Vector }): Vector {
    return new Vector({ x: this.x + vector.x, y: this.y + vector.y });
  }

  /**
   * Returns another vector subtracted from this vector.
   */
  public subtract({ vector }: { vector: Vector }): Vector {
    return new Vector({ x: this.x - vector.x, y: this.y - vector.y });
  }

  /**
   * Returns the counterclockwise angle from this vector to another vector.
   *
   * The result is in radians in the range [0, 2π).
   *
   * @throws If either vector has zero length.
   */
  public angleTo({ vector }: { vector: Vector }): number {
    const first = this.normalize();
    const second = vector.normalize();
    let angle = Math.atan2(
      first.cross({ vector: second }),
      first.dot({ vector: second })
    );

    if (angle < 0) {
      angle += TwoPi;
    }

    return angle;
  }

  /**
   * Returns the projection of this vector onto another vector.
   *
   * @throws If the target vector has zero length.
   */
  public projectionOn({ vector }: { vector: Vector }): Vector {
    const normalized = vector.normalize();
    return normalized.multiply({ scalar: this.dot({ vector: normalized }) });
  }
}

const Tolerance = 0.000001;
const TwoPi = Math.PI * 2;

/**
 * Returns whether two numbers are equal within the configured tolerance.
 */
function equalNumber({ a, b }: { a: number; b: number }): boolean {
  const difference = a - b;
  return difference < Tolerance && difference > -Tolerance;
}
