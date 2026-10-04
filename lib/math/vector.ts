import type { Point } from "./point";

const TOLERANCE = 0.000001;
const TWO_PI = Math.PI * 2;

export class Vector {
  public readonly x: number;
  public readonly y: number;

  /**
   * Creates a vector from its x and y components.
   */
  public constructor(x: number, y: number);

  /**
   * Creates a vector pointing from `start` to `end`.
   */
  public constructor(start: Point, end: Point);

  public constructor(...args: [number, number] | [Point, Point]) {
    if (typeof args[0] === "number" && typeof args[1] === "number") {
      this.x = args[0];
      this.y = args[1];
      return;
    }

    const [first, second] = args as [Point, Point];

      this.x = second.x - first.x;
      this.y = second.y - first.y;
  }

  /**
   * Returns a copy of this vector.
   */
  public clone(): Vector {
    return new Vector(this.x, this.y);
  }

  /**
   * Returns the direction of this vector in radians in the range [0, 2π).
   *
   * The angle is measured counterclockwise from the positive x-axis.
   */
  public get slope(): number {
    const angle = Math.atan2(this.y, this.x);
    return angle < 0 ? angle + TWO_PI : angle;
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
    return this.length < TOLERANCE;
  }

  /**
   * Returns whether this vector is equal to another vector within the configured tolerance.
   */
  public equalTo(vector: Vector): boolean {
    return equalNumber(this.x, vector.x) && equalNumber(this.y, vector.y);
  }

  /**
   * Returns this vector multiplied by a scalar.
   */
  public multiply(scalar: number): Vector {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  /**
   * Returns the dot product of this vector and another vector.
   */
  public dot(vector: Vector): number {
    return this.x * vector.x + this.y * vector.y;
  }

  /**
   * Returns the 2D cross product of this vector and another vector.
   *
   * The result is a scalar whose sign indicates their relative orientation.
   */
  public cross(vector: Vector): number {
    return this.x * vector.y - this.y * vector.x;
  }

  /**
   * Returns a unit vector with the same direction as this vector.
   *
   * @throws If this vector has zero length.
   */
  public normalize(): Vector {
    const length = this.length;

    if (length < TOLERANCE) {
      throw new Error("Cannot normalize a zero-length vector");
    }

    return new Vector(this.x / length, this.y / length);
  }

  /**
   * Returns this vector rotated counterclockwise by the given angle in radians.
   */
  public rotate(angle: number): Vector {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Vector(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos,
    );
  }

  /**
   * Returns this vector rotated 90 degrees counterclockwise.
   */
  public rotate90CCW(): Vector {
    return new Vector(-this.y, this.x);
  }

  /**
   * Returns this vector rotated 90 degrees clockwise.
   */
  public rotate90CW(): Vector {
    return new Vector(this.y, -this.x);
  }

  /**
   * Returns a vector with the opposite direction and the same length.
   */
  public invert(): Vector {
    return new Vector(-this.x, -this.y);
  }

  /**
   * Returns the sum of this vector and another vector.
   */
  public add(vector: Vector): Vector {
    return new Vector(this.x + vector.x, this.y + vector.y);
  }

  /**
   * Returns another vector subtracted from this vector.
   */
  public subtract(vector: Vector): Vector {
    return new Vector(this.x - vector.x, this.y - vector.y);
  }

  /**
   * Returns the counterclockwise angle from this vector to another vector.
   *
   * The result is in radians in the range [0, 2π).
   *
   * @throws If either vector has zero length.
   */
  public angleTo(vector: Vector): number {
    const first = this.normalize();
    const second = vector.normalize();
    let angle = Math.atan2(first.cross(second), first.dot(second));

    if (angle < 0) {
      angle += TWO_PI;
    }

    return angle;
  }

  /**
   * Returns the projection of this vector onto another vector.
   *
   * @throws If the target vector has zero length.
   */
  public projectionOn(vector: Vector): Vector {
    const normalized = vector.normalize();
    return normalized.multiply(this.dot(normalized));
  }
}

/**
 * Returns whether two numbers are equal within the configured tolerance.
 */
function equalNumber(a: number, b: number): boolean {
  const difference = a - b;
  return difference < TOLERANCE && difference > -TOLERANCE;
}
