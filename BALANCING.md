# Balancing Mode - Multi-Instance Simulation System

A comprehensive system for running multiple isolated game instances with configurable behaviors, strategies, and metrics collection. Perfect for testing game balance, analyzing progression curves, and validating design decisions.

## Features

- **Multiple Profiles**: Pre-configured game strategies (Baseline, Conservative, Aggressive, Long Run, Speedrun)
- **Isolated Instances**: Each run is completely independent with its own RNG seed
- **Milestone Tracking**: Define and track custom milestones (depth, bosses, legendaries, etc.)
- **Rich Metrics**: Comprehensive data collection (score distribution, survival time, discoveries, etc.)
- **HTML Visualization**: Beautiful interactive reports with Chart.js visualizations
- **Comparison Mode**: Run multiple profiles and compare results side-by-side

## Available Profiles

### Baseline
Standard balanced gameplay with moderate risk/reward. Good for overall balance validation.
- Duration: 2 hours
- Strategy: Balanced job/item/talent/dungeon decisions

### Conservative
Survival-focused strategy that avoids high-risk dungeons.
- Duration: 2 hours
- Strategy: Prioritizes equipment and job income
- Best for: Testing survivability, avoiding death spirals

### Aggressive
High-risk strategy targeting depth and legendary drops.
- Duration: 2 hours
- Strategy: Pushes depth limits, seeks reward dungeons
- Best for: Testing endgame balance, legendary scaling

### Long Run
Extended duration to reach late-game content.
- Duration: 4 hours
- Strategy: Baseline with extra time
- Best for: Testing trait evolution, late-game balance

### Speedrun
Quick runs for early-game balance iteration.
- Duration: 30 minutes
- Strategy: Baseline with shorter window
- Best for: Fast iteration on jobs/early dungeons

## Usage

### Balance Dashboard Endpoint

- Dashboard URL: `/balance-dashboard`
- Reports API: `/api/balance-reports`
- Reports directory: `public/balance-dashboard/reports/`

All generated reports are now centralized in the dashboard reports directory and can be browsed from a single optimization dashboard view.

### Run a Single Profile

```bash
node scripts/run-balance-test.mjs --profile baseline --runs 20
```

Options:
- `--profile NAME` - Profile to run (default: baseline)
- `--runs N` - Number of instances per profile (default: 10)
- `--seed N` - Starting deterministic seed (default: 1000)
- `--carry-meta` - Carry discovered content and meta economy between runs
- `--output FILE` - Output HTML file (default: `public/balance-dashboard/reports`)

### Compare Multiple Profiles

```bash
node scripts/run-balance-test.mjs --compare --runs 15
```

Runs all profiles (baseline, conservative, aggressive, long_run, speedrun) with 15 instances each and generates a comparison report.

### Example Workflow

```bash
# Quick balance check (3 min runtime)
node scripts/run-balance-test.mjs --profile baseline --runs 5

# Deep analysis across strategies (15 min runtime)
node scripts/run-balance-test.mjs --compare --runs 20

# Validate specific profile extensively
node scripts/run-balance-test.mjs --profile aggressive --runs 50

# Progression-aware campaign simulation (recommended for depth pacing)
node scripts/run-balance-test.mjs --compare --runs 120 --carry-meta

# High-intensity "bomb mode" sweep
node scripts/run-balance-test.mjs --compare --runs 300 --carry-meta --seed 80000 --output balance-report-bomb.html
```

### Carry-Meta Mode

When `--carry-meta` is enabled, each run feeds into the next run inside that profile:
- Discovered items and traits persist
- Legacy ash is banked for future unlocks
- Unlock decisions can move to deeper dungeons over time

Use this mode for realistic long-session progression analysis.

## Report Structure

Generated HTML reports include:

### Per-Profile Metrics
- Average depth reached
- Survival time distribution
- Discoveries per run
- Dungeons cleared
- Legacy ash earned
- Score distribution chart

### Milestone Tracking
Track custom milestones like:
- `depth_10`, `depth_15` - Reach specific dungeon depths
- `boss_defeated` - Complete first boss
- `legendary_found` - Acquire legendary item
- `trait_evolved` - Trigger trait evolution

Shows:
- Percentage of runs reaching milestone
- Average time to reach (in minutes)
- Success rate and progression curve

### Comparison Charts (Multi-Profile)
- Depth progression comparison
- Survival time trends
- Discovery rates
- Score distributions

## Defining Custom Profiles

Add new profiles in `src/sim/balance-profiles.ts`:

```typescript
export const PROFILE_CUSTOM: BalanceProfile = {
  name: "My Custom Profile",
  description: "Testing specific balance changes",
  policy: new MyCustomPolicy(),
  durationSec: 1.5 * 3600,
  stepSec: 10,
  milestones: ["depth_5", "depth_10", "legendary_found"],
};

// Add to BALANCE_PROFILES export
export const BALANCE_PROFILES = {
  // ... existing profiles
  custom: PROFILE_CUSTOM,
};
```

## Creating Custom Policies

Extend `Policy` interface in `src/sim/policies.ts`:

```typescript
export class MyCustomPolicy implements Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction {
    // Return next action: job assignment, dungeon start, talent unlock, or item equip
    // Or null to let game idle
    return null;
  }
}
```

Reference implementations:
- `BaselinePolicy` - Balanced approach
- `ConservativePolicy` - Survival focus
- `AggressivePolicy` - Depth/reward focus

## Understanding Results

### Score Distribution
Shows how runs cluster in score ranges. Good for identifying:
- Whether all runs perform similarly (balanced)
- Outliers (lucky/unlucky RNG streaks)
- Strategy effectiveness

### Milestone Statistics
For milestone `depth_10`:
- **50% Reached**: Half of runs reach depth 10
- **Avg 8 min**: Average time to reach it
- Higher % = easier progression, Lower % = challenging

### Average Metrics
- **Avg Depth**: Overall progression rate
- **Survival Time**: How long runs last
- **Discoveries**: New items/traits found
- **Dungeons**: Scaling of dungeon count over time

In `--carry-meta` reports, `Avg Depth` should rise as unlocks compound.
If depth stays flat near 0, treat it as a balancing or policy regression.

## Performance Tips

- **Small runs**: `--runs 5` for quick validation (< 1 min)
- **Medium runs**: `--runs 20` for reliable data (5-10 min)
- **Large runs**: `--runs 100` for statistical significance (30+ min)
- **Bomb runs**: `--runs 300+ --carry-meta` for high-confidence progression curves

Shorter durations are faster:
- Speedrun: 30 min game / ~0.5s per instance
- Baseline: 2 hour game / ~3s per instance
- Long Run: 4 hour game / ~5s per instance

## Integration with Development

Recommended workflow:

1. **Before feature**: `node scripts/run-balance-test.mjs --compare --runs 20`
2. **Make changes** to game balance (talents, dungeons, items)
3. **After feature**: `node scripts/run-balance-test.mjs --compare --runs 20 --carry-meta`
4. **Compare reports** for regressions or improvements

## Technical Details

### Architecture
- `balance-profiles.ts` - Profile definitions and presets
- `balance-runner.ts` - Simulation engine with metrics collection
- `balance-report.ts` - HTML report generation with visualizations
- `policies.ts` - Strategy implementations

### Data Flow
1. Profile defines policy, duration, milestones
2. `runBalanceTest()` simulates N instances
3. Each instance runs until duration or death
4. Metrics collected per-run and aggregated
5. `generateBalanceReport()` creates HTML visualization

### Metrics Calculated
- Per-run: seed, score, depth, survival time, discoveries, ash, items, traits, milestones
- Aggregated: averages, distributions, min/max, milestone statistics

## Future Enhancements

Potential additions:
- Custom metric collectors
- A/B testing statistical significance
- Regression detection
- Export to JSON/CSV for analysis
- Automated performance regression alerts
- Parameter sweep (test multiple talent values)

---

**Note**: Balancing mode runs isolated simulations without UI. Perfect for batch testing and data analysis. For interactive play, use the normal game mode.
