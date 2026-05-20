---
name: game-audit
description: "Run simulated gameplay sessions and produce comprehensive analysis reports identifying missing content, balance issues, progression bottlenecks, and UX improvements. USE FOR: audit the game, analyze balance, find missing content, identify progression gaps, test gameplay flow, check late-game features, content discovery, validate design changes. Output is an interactive HTML report with visualizations and actionable recommendations grouped by category (balance, content, progression, UX)."
---

# Game Audit Skill

Play the game through simulated runs across multiple strategies, then analyze what's missing, broken, or needs improvement. Produces an interactive HTML report with findings and recommendations.

## Workflow Overview

1. **Run Simulations** - Execute multi-profile smoke tests (baseline, conservative, aggressive)
2. **Analyze Results** - Evaluate metrics, milestones, discovery, and progression
3. **Generate Report** - Create interactive HTML with visualizations and audit findings
4. **Extract Recommendations** - Structured action items grouped by category

## Step-by-Step

### 1. Trigger the Audit

**Quick smoke test** (default, ~2-3 minutes):
```
/game-audit
```

**Custom audit** with parameters:
```
/game-audit --profiles aggressive,long-run --runs 30 --depth-threshold 10
```

### 2. What the Skill Does

The skill:
- Runs 15-30 simulated game sessions per profile (baseline, conservative, aggressive)
- Collects metrics: depth, survival time, discoveries, milestone achievement
- Analyzes progression pacing, content coverage, and balance
- Identifies patterns: bottlenecks, overpowered/underpowered systems, missing content
- Compares expected vs. actual progression curves
- Checks late-game feature usage (talents, exotic items, traits)

### 3. Analysis Categories

Reports are organized by five key audit areas:

#### **Balance**
- Damage/survival curve progression
- Item rarity distribution
- Talent power levels
- Trait effectiveness across playstyles

#### **Content Discovery**
- Percentage of items/traits/jobs unlocked
- Gaps in content (missing paths to discovery)
- Unbalanced discovery rates (some items nearly impossible to find)

#### **Progression**
- Depth advancement rates (fast/slow zones)
- Milestone achievement pacing
- Boss defeat rates and difficulty spikes
- Late-game content accessibility

#### **Gameplay Experience**
- Run duration distribution
- Early exit rates (death/quit patterns)
- Strategy diversity (do all policies perform comparably?)
- Offline rewards functionality

#### **Missing Features**
- Unimplemented content in codebase but not tested
- Content marked experimental/TODO in balance profiles
- Unused achievement types or loot table entries

### 4. Output: Interactive HTML Report

Generated at: `public/balance-dashboard/reports/audit-report-[timestamp].html`

**Report includes:**
- Executive summary (key findings, risk areas)
- Per-profile metric dashboards
- Comparison charts (all strategies vs. baseline)
- Discovery heatmap (which content is accessible?)
- Progression curve analysis
- Milestone achievement breakdown
- Actionable recommendations list (sorted by priority)

**Each recommendation includes:**
- Category (balance / content / progression / UX)
- Issue description
- Affected systems/items
- Suggested fix
- Implementation complexity (low / medium / high)

### 5. Interpretation Guide

**Red flags that indicate missing features:**
- 0% achievement rate for a milestone
- Discovery rate < 10% for a content type
- Flat or unexplained metric curves
- All strategies fail at same depth (progression blocker)

**Balance issues:**
- Survival curve too steep (aggressive profile dies immediately)
- One strategy dominates (>50% win rate vs. others)
- Milestone clustering (all bosses defeated between depth 5-6, then nothing)

**Pacing issues:**
- Run duration < 10 minutes (early game too short)
- Average depth plateaus early (mid-game bottleneck)
- Late-game features never unlock in standard runs

### 6. Workflow Examples

#### Audit after implementing new talent
```
User: Audit the game to see if the new talent is balanced
Agent:
  1. Runs baseline + aggressive profiles (30 runs each)
  2. Analyzes talent pick rates, survival impact, interaction with other systems
  3. Reports if talent is underpowered / balanced / overpowered
  4. Suggests balance adjustments if needed
```

#### Find content gaps
```
User: What content is missing from the game?
Agent:
  1. Runs simulation suite
  2. Extracts items/traits never unlocked across all profiles
  3. Checks codebase for unimplemented or experimental features
  4. Lists content that should exist but isn't accessible
  5. Reports which features are low-priority vs. critical
```

#### Late-game analysis
```
User: Is late-game engaging? What's missing beyond depth 50?
Agent:
  1. Runs long-run profile (4-hour simulations)
  2. Analyzes feature usage past depth 50
  3. Checks milestone achievement at high depths
  4. Identifies unused content or flat progression
  5. Recommends pacing improvements or new late-game systems
```

## Automation Integration

**Smoke test CI/CD** (runs on each commit):
```yaml
# .github/workflows/game-audit.yml
- Run audit with fixed seed for deterministic results
- Compare against baseline (previous commit)
- Flag if any metric regressed significantly
- Post findings as PR comment
```

**Scheduled audit** (weekly):
```
# Runs full analysis on schedule
npm run game-audit -- --full --runs 50 --compare-historical
```

## Key Implementation Details

- **Entry Point**: Call `runGameAudit(options)` from `src/sim/`
- **Data Source**: `balance-runner.ts` simulations + `evaluator.ts` metrics
- **Output Generator**: Enhanced `balance-report.ts` with audit-specific visualizations
- **Report Destination**: `public/balance-dashboard/reports/audit-report-*.html`
- **Seed Control**: Optional `--seed` flag for reproducible audits

## Related Skills

- **game-balancing**: Adjust specific systems based on audit findings
- **content-creation**: Implement features identified as missing
- **progression-tuning**: Fix pacing issues from audit report

## Success Criteria

A well-executed audit produces:
- ✅ Clear identification of balance issues (if any)
- ✅ Discovery of content gaps or bottlenecks
- ✅ Actionable recommendations (not just problems)
- ✅ Reproducible findings (deterministic with seed)
- ✅ <5 minute execution for smoke test
- ✅ Interactive HTML that reveals patterns at a glance

## Edge Cases & Troubleshooting

**"All runs fail early" or "High variance in results"**
- Might indicate progression blocker or RNG issues
- Recommend increasing runs to 50+ for statistical confidence
- Check if policy is actually choosing valid actions

**"No new content discovered beyond depth 10"**
- Content unlock threshold might be too high
- Or content unlock is gated behind difficult-to-achieve milestones
- Audit report flags this in "Content Discovery" section

**"Report shows good metrics but game feels slow"**
- Metrics might be misleading; check player experience category
- Consider run duration vs. engagement (pacing !== fun)
- Recommendation: Add event variety or discovery surprises
