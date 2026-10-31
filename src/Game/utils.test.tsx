import { getRandomIntInRange, getDistanceToFrom, getNormVecFromDestAndOrigin, getDotProduct2D } from './utils';

describe('getRandomIntInRange', () => {

  test('should have a min of 0 if no "min" param is passed and the min should be inclusive', () => {
    let _min;
    let count = 0;

    while (_min != 0 && count < 400) {
      _min = getRandomIntInRange({ max: 1 });
      count++;
    }
    expect(_min).toBe(0);
  });

  test('should have a max of what is passed as the "max" param and the max should be inclusive', () => {
    let _max;
    let count = 0;

    while (_max != 1 && count < 400) {
      _max = getRandomIntInRange({ min: 0, max: 1 });
      count++;
    }
    expect(_max).toBe(1);
  });

  test('should have a max of 1 if no "max" param is passed and the max should be inclusive', () => {
    let _max;
    let count = 0;

    while (_max != 1 && count < 400) {
      _max = getRandomIntInRange({ min: 0 });
      count++;
    }
    expect(_max).toBe(1);
  });

  test('should have a min of 0 if no "min" param is passed, a max of 1 if no "max" param is passed, and the min/max should be inclusive', () => {
    let _min, _max;
    let count = 0;

    while (!(_min == 0 && _max == 1) && count < 400) {
      _min = getRandomIntInRange({});
      _max = getRandomIntInRange({});

      count++;
    }

    expect(_min).toBe(0);
    expect(_max).toBe(1);
  });
});

describe('getDistanceToFrom', () => {
  test('calculates distance between two distinct points', () => {
    // Distance from (1, 2) to (4, 6) is exactly 5 (3-4-5 triangle)
    expect(getDistanceToFrom({ x: 1, y: 2}, { x: 4, y: 6 })).toBe(5);
  });

  test('returns 0 when both points are identical', () => {
    expect(getDistanceToFrom({ x: 5, y: 5}, { x: 5, y: 5 })).toBe(0);
  });

  test('handles negative coordinates correctly', () => {
    // Distance from (-1, -1) to (2, 3) is 5
    expect(getDistanceToFrom({ x: -1, y: -1}, { x: 2, y: 3 })).toBe(5);
  });

  test('handles floating-point/decimal results accurately', () => {
    // Distance from (0, 0) to (1, 1) is sqrt(2) ≈ 1.414213...
    // toBeCloseTo avoids precision errors (defaults to 2 decimal places)
    expect(getDistanceToFrom({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(1.414);
  });

  test('calculates distance along a purely horizontal line', () => {
    expect(getDistanceToFrom({ x: 10, y: 5 }, {x: 20, y: 5 })).toBe(10);
  });

  test('calculates distance along a purely vertical line', () => {
    expect(getDistanceToFrom({ x: 3, y: -2 }, { x: 3, y: 8 })).toBe(10);
  });

});

describe('getNormVecFromDestAndOrigin', () => {
  
  test('returns a pure horizontal unit vector pointing right', () => {
    const origin = { x: 0, y: 0 };
    const dest = { x: 5, y: 0 }; // Moving purely right along X axis
    
    const result = getNormVecFromDestAndOrigin(dest, origin);
    
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });

  test('returns a pure vertical unit vector pointing down', () => {
    const origin = { x: 2, y: 2 };
    const dest = { x: 2, y: 10 }; // Moving purely down/up along Y axis
    
    const result = getNormVecFromDestAndOrigin(dest, origin);
    
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  test('calculates a perfect 45-degree diagonal normalized vector', () => {
    const origin = { x: 0, y: 0 };
    const dest = { x: 3, y: 3 }; // Equal X and Y movement
    
    const result = getNormVecFromDestAndOrigin(dest, origin);
    
    // 1 / sqrt(2) ≈ 0.7071
    expect(result.x).toBeCloseTo(0.7071, 4);
    expect(result.y).toBeCloseTo(0.7071, 4);
  });

  test('handles negative coordinates correctly', () => {
    const origin = { x: -1, y: -1 };
    const dest = { x: -4, y: -5 }; // Moving into deeper negative space
    
    const result = getNormVecFromDestAndOrigin(dest, origin);
    
    // Total distance is 5. dx = -3, dy = -4. Norm: (-3/5, -4/5)
    expect(result.x).toBeCloseTo(-0.6);
    expect(result.y).toBeCloseTo(-0.8);
  });

  test('handles identical origin and destination points (division by zero)', () => {
    const origin = { x: 4, y: 4 };
    const dest = { x: 4, y: 4 };
    
    const result = getNormVecFromDestAndOrigin(dest, origin);
    
    // Depending on your implementation, this should handle NaN gracefully.
    // Common safe fallbacks are returning { x: 0, y: 0 } or throwing an error.
    expect(result).toEqual({ x: 0, y: 0 }); 
  });

});

describe('getDotProduct2D', () => {

  test('returns a positive value when vectors point in the same general direction (< 90°)', () => {
    const v1 = { x: 3, y: 4 };
    const v2 = { x: 5, y: 2 };
    
    // Math: (3 * 5) + (4 * 2) = 15 + 8 = 23
    expect(getDotProduct2D(v1, v2)).toBe(23);
  });

  test('returns exactly 0 for perpendicular vectors (90°)', () => {
    const v1 = { x: 1, y: 0 };  // Facing purely Right
    const v2 = { x: 0, y: 5 };  // Facing purely Up
    
    // Math: (1 * 0) + (0 * 5) = 0
    expect(getDotProduct2D(v1, v2)).toBe(0);
  });

  test('returns a negative value when vectors point in opposite directions (> 90°)', () => {
    const v1 = { x: 2, y: 3 };
    const v2 = { x: -4, y: -1 };
    
    // Math: (2 * -4) + (3 * -1) = -8 + -3 = -11
    expect(getDotProduct2D(v1, v2)).toBe(-11);
  });

  test('returns 0 if one or both vectors are zero vectors', () => {
    const v1 = { x: 0, y: 0 };
    const v2 = { x: 10, y: -5 };
    
    // Math: (0 * 10) + (0 * -5) = 0
    expect(getDotProduct2D(v1, v2)).toBe(0);
  });

  test('handles floating-point decimal coordinates correctly', () => {
    const v1 = { x: 0.5, y: 1.5 };
    const v2 = { x: 2.0, y: 0.2 };
    
    // Math: (0.5 * 2.0) + (1.5 * 0.2) = 1.0 + 0.3 = 1.3
    // Using toBeCloseTo to safely handle potential JavaScript floating-point errors
    expect(getDotProduct2D(v1, v2)).toBeCloseTo(1.3);
  });

});