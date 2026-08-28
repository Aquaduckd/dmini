const X_MIN = 1;
const X_MAX = 100;

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
