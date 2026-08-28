const X_MIN = 1;
const X_MAX = 100;

const NOTAIL_DENSITY_FRACTION = 0.02;
const KDE_RANGE_SAMPLES = 400;

export interface DistributionRenderOptions {
  statLabel: string;
  layoutName: string;
  layoutValue: number;
  values: number[];
  formatValue: (value: number) => string;
  rangeMin?: number;
  rangeMax?: number;
}

export function valueToPercentile(values: number[], target: number): number {
  if (values.length <= 1) return 50;

  const below = values.filter((value) => value < target).length;
  return X_MIN + (below / (values.length - 1)) * (X_MAX - X_MIN);
}

export function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return 1;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  const q1 = sorted[Math.floor((n - 1) * 0.25)] ?? sorted[0]!;
  const q3 = sorted[Math.floor((n - 1) * 0.75)] ?? sorted[n - 1]!;
  const iqr = q3 - q1;
  const scale = Math.min(std, iqr > 0 ? iqr / 1.34 : std) || std || 1;
  return 1.06 * scale * n ** -0.2;
}

export function gaussianKde(
  values: number[],
  bandwidth: number,
): (x: number) => number {
  const factor = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
  return (x: number) => {
    let sum = 0;
    for (const value of values) {
      const z = (x - value) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    return (sum / values.length) * factor;
  };
}

export function kdeDensityRange(
  values: number[],
  thresholdFraction = NOTAIL_DENSITY_FRACTION,
): { min: number; max: number } {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  if (dataMax <= dataMin) {
    return { min: dataMin, max: dataMin + 1 };
  }

  const kde = gaussianKde(values, silvermanBandwidth(values));
  let maxDensity = 0;
  const samples: Array<{ value: number; density: number }> = [];

  for (let i = 0; i <= KDE_RANGE_SAMPLES; i++) {
    const value = dataMin + ((dataMax - dataMin) * i) / KDE_RANGE_SAMPLES;
    const density = kde(value);
    maxDensity = Math.max(maxDensity, density);
    samples.push({ value, density });
  }

  const threshold = maxDensity * thresholdFraction;
  let min = dataMax;
  let max = dataMin;

  for (const point of samples) {
    if (point.density >= threshold) {
      min = Math.min(min, point.value);
      max = Math.max(max, point.value);
    }
  }

  if (max <= min) {
    return { min: dataMin, max: dataMax };
  }

  return { min, max };
}

export function resolveDistRange(
  values: number[],
  options: { notail?: boolean; min?: number; max?: number },
): { min: number; max: number } {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  let min = options.min;
  let max = options.max;

  if (options.notail) {
    const kdeRange = kdeDensityRange(values);
    min ??= kdeRange.min;
    max ??= kdeRange.max;
  }

  return {
    min: min ?? dataMin,
    max: max ?? dataMax,
  };
}
