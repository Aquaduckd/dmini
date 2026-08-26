export interface Mana2Stat {
  Id: string;
  Value: number;
}

export interface Mana2AnalysisJson {
  monogramStats: Mana2Stat[];
  bigramStats: Mana2Stat[];
  skipgramStats: Mana2Stat[];
  trigramStats: Mana2Stat[];
}

export interface Mana2Analysis {
  values: Map<string, number>;
}

export function parseMana2Analysis(raw: string): Mana2Analysis {
  const parsed = JSON.parse(raw) as Mana2AnalysisJson;
  const values = new Map<string, number>();

  for (const group of [
    parsed.monogramStats,
    parsed.bigramStats,
    parsed.skipgramStats,
    parsed.trigramStats,
  ]) {
    for (const stat of group ?? []) {
      values.set(stat.Id, stat.Value);
    }
  }

  return { values };
}

export function getStatValue(
  analysis: Mana2Analysis,
  id: string,
): number | undefined {
  return analysis.values.get(id);
}

export function analysisToRecord(analysis: Mana2Analysis): Record<string, number> {
  return Object.fromEntries(analysis.values);
}

export function analysisFromRecord(
  record: Record<string, number>,
): Mana2Analysis {
  return { values: new Map(Object.entries(record)) };
}
