// Strategy DSL: unified execution contract for metrics → triggers → diagnosis → options → recovery/stopLoss
export interface Evidence {
  source: string;
  url?: string;
  date?: string; // ISO 8601
  scope?: string; // applicability scope/limits
}

export type Comparator = '>' | '>=' | '<' | '<=' | '==' | 'trend_down' | 'trend_up';

export interface Trigger {
  metricId: string;
  comparator: Comparator;
  threshold: number | string;
  window: string; // ISO 8601 duration, e.g., "P7D"
}

export interface DiagnosisStep {
  id: string;
  description: string;
  check?: string;
}

export interface StrategyOption {
  id: 'A' | 'B' | 'C';
  steps: string[];
  benefits: string[];
  risks?: string[];
  suitableFor?: string[];
}

export interface RecoveryWindow {
  window: string; // ISO 8601 duration
  reviewMetricIds: string[];
}

export interface StopLoss {
  condition: string;
  action: string;
}

export interface MetricSpec {
  metricId: string; // aligned with S2 nodes[].id
  what: string;
  why: string;
  triggers: Trigger[];
  diagnosis: DiagnosisStep[];
  options: StrategyOption[]; // A/B/C
  recovery: RecoveryWindow;
  stopLoss?: StopLoss; // optional in v1, will be enforced by QA
  evidence?: Evidence[];
  confidence?: number; // 0–1
  applicability?: string;
}

// Re-export the StrategySpec from schemas to maintain consistency
// The actual definition is in schemas.ts as StrategySpecSchema
export type { StrategySpecZod as StrategySpec } from './schemas';

export type POV = 'maximize_gain' | 'minimize_risk' | 'balanced' | 'conservative' | 'aggressive';


