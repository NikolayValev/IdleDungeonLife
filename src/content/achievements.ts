import type { AchievementDef } from "../core/types";

export const ACHIEVEMENT_REGISTRY = new Map<string, AchievementDef>([
  [
    "boss_10",
    {
      id: "boss_10",
      title: "Beast Slayer",
      description: "Defeat 10 bosses",
      category: "milestone",
      triggerType: "bossCount",
      triggerValue: 10,
      reward: { vitalityBoost: 0.01 },
    },
  ],
  [
    "boss_50",
    {
      id: "boss_50",
      title: "Monster Killer",
      description: "Defeat 50 bosses",
      category: "milestone",
      triggerType: "bossCount",
      triggerValue: 50,
      reward: { vitalityBoost: 0.05 },
    },
  ],
  [
    "boss_100",
    {
      id: "boss_100",
      title: "Boss Hunter",
      description: "Defeat 100 bosses",
      category: "milestone",
      triggerType: "bossCount",
      triggerValue: 100,
      reward: { vitalityBoost: 0.1 },
    },
  ],
  [
    "survive_300",
    {
      id: "survive_300",
      title: "Enduring",
      description: "Survive 300 seconds in a single run",
      category: "milestone",
      triggerType: "survivalTime",
      triggerValue: 300,
      reward: { essenceRateBoost: 0.01 },
    },
  ],
  [
    "survive_1000",
    {
      id: "survive_1000",
      title: "Immortal",
      description: "Accumulate 1000 seconds of survival time",
      category: "milestone",
      triggerType: "survivalTime",
      triggerValue: 1000,
      reward: { essenceRateBoost: 0.03 },
    },
  ],
  [
    "depth_10",
    {
      id: "depth_10",
      title: "Delver",
      description: "Reach dungeon depth 10",
      category: "milestone",
      triggerType: "depthReached",
      triggerValue: 10,
      reward: { goldRateBoost: 0.02 },
    },
  ],
  [
    "depth_20",
    {
      id: "depth_20",
      title: "Abyss Walker",
      description: "Reach dungeon depth 20",
      category: "milestone",
      triggerType: "depthReached",
      triggerValue: 20,
      reward: { goldRateBoost: 0.05 },
    },
  ],
  [
    "path_holy",
    {
      id: "path_holy",
      title: "Sanctified",
      description: "Complete the holy legacy path",
      category: "path",
      triggerType: "pathCompleted",
      triggerValue: 1,
      reward: { vitalityBoost: 0.08 },
    },
  ],
  [
    "path_abyss",
    {
      id: "path_abyss",
      title: "Corrupted",
      description: "Complete the abyss legacy path",
      category: "path",
      triggerType: "pathCompleted",
      triggerValue: 1,
      reward: { essenceRateBoost: 0.08 },
    },
  ],
  [
    "path_knowledge",
    {
      id: "path_knowledge",
      title: "Enlightened",
      description: "Complete the knowledge legacy path",
      category: "path",
      triggerType: "pathCompleted",
      triggerValue: 1,
      reward: { discoveryRateBoost: 0.1 },
    },
  ],
]);
