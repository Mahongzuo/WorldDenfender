export type DefenseElement = "force" | "thermal" | "light" | "electric" | "sound";

export type DefenseFunctionTag =
  | "singleTarget"
  | "areaAttack"
  | "paralysis"
  | "healing"
  | "damageOverTime";

export type DefenseStatusId =
  | "slow"
  | "stun"
  | "paralysis"
  | "electromagneticInterference"
  | "thermalEffect"
  | "damageOverTime";

export type DefenseResistanceProfile = Partial<Record<DefenseElement, number>>;

export interface DefenseEffectSpec {
  statusId: DefenseStatusId;
  duration: number;
  magnitude?: number;
  tickDamage?: number;
  element?: DefenseElement;
}

export interface DefenseRuntimeStatus {
  id: DefenseStatusId;
  until: number;
  magnitude?: number;
  tickDamage?: number;
  element?: DefenseElement;
  nextTickAt?: number;
}

export interface DefenseDamageSource {
  label?: string;
  element?: DefenseElement;
  functionTags?: DefenseFunctionTag[];
}

export interface DefenseConsumableSpec {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  cleanseStatuses: DefenseStatusId[];
  maxCopies?: number;
  cooldown?: number;
}
