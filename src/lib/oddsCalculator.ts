/**
 * Hybrid Liquidity-Bootstrapped AMM with Diversity Factor
 *
 * Uses "virtual liquidity" (imaginary credits) that decays exponentially as betting
 * volume increases. The decay rate adapts based on user diversity - high diversity
 * causes faster decay and more responsive markets, while low diversity causes slow
 * decay and keeps markets stable (manipulation resistant).
 */

// Algorithm Parameters
export const ODDS_CONFIG = {
  MAX_VIRTUAL_LIQUIDITY: 5000,    // Starting virtual credits
  BASE_DECAY_RATE: 15,            // Base number of bets to halve virtual liquidity
  DIVERSITY_THRESHOLD: 20,        // Users needed for "full diversity"
  DIVERSITY_DECAY_BONUS: 10,      // Additional decay at full diversity
  MIN_PROBABILITY: 0.05,          // 5% minimum probability
  MAX_PROBABILITY: 0.95,          // 95% maximum probability
} as const

export interface OddsCalculationInput {
  currentProbability: number      // Current odds for the outcome (0-1)
  betAmount: number               // Credits being bet
  outcomePool: number             // Total credits already bet on this specific outcome
  totalPool: number               // Total credits bet across ALL outcomes in the market
  totalBetsOnMarket: number       // Total number of bets placed on this market
  uniqueBettors: number           // Number of distinct users who have bet on this market
}

export interface OddsCalculationResult {
  newProbability: number          // New probability after the bet
  virtualLiquidity: number        // Current virtual liquidity
  diversityFactor: number         // Current diversity factor (0-1)
  effectiveDecayRate: number      // Current effective decay rate
  impliedOdds: number             // Decimal odds (1/probability)
}

/**
 * Clamps a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculates the new probability after a bet using the hybrid AMM algorithm
 */
export function calculateNewProbability(input: OddsCalculationInput): OddsCalculationResult {
  const {
    currentProbability,
    betAmount,
    outcomePool,
    totalPool,
    totalBetsOnMarket,
    uniqueBettors,
  } = input

  // Step 1: Calculate diversity factor (0 to 1)
  const diversityFactor = Math.min(uniqueBettors / ODDS_CONFIG.DIVERSITY_THRESHOLD, 1.0)

  // Step 2: Calculate effective decay rate
  const effectiveDecayRate = ODDS_CONFIG.BASE_DECAY_RATE +
    (ODDS_CONFIG.DIVERSITY_DECAY_BONUS * diversityFactor)

  // Step 3: Calculate virtual liquidity (exponential decay)
  const virtualLiquidity = ODDS_CONFIG.MAX_VIRTUAL_LIQUIDITY *
    Math.exp(-totalBetsOnMarket / effectiveDecayRate)

  // Step 4: Calculate virtual pools based on current probability
  const virtualOutcomePool = virtualLiquidity * currentProbability
  const virtualOtherPool = virtualLiquidity * (1 - currentProbability)

  // Step 5: Calculate total pools (real + virtual)
  const totalOutcomePool = outcomePool + virtualOutcomePool
  const totalOtherPool = (totalPool - outcomePool) + virtualOtherPool

  // Step 6: Calculate new pools after bet
  const newOutcomePool = totalOutcomePool + betAmount
  const newTotalPool = totalOutcomePool + totalOtherPool + betAmount

  // Step 7: Calculate new probability
  let newProbability = newOutcomePool / newTotalPool

  // Step 8: Clamp to bounds
  newProbability = clamp(newProbability, ODDS_CONFIG.MIN_PROBABILITY, ODDS_CONFIG.MAX_PROBABILITY)

  // Calculate implied decimal odds
  const impliedOdds = 1 / newProbability

  return {
    newProbability,
    virtualLiquidity,
    diversityFactor,
    effectiveDecayRate,
    impliedOdds,
  }
}

/**
 * Calculates the potential payout for a bet at given odds
 */
export function calculatePotentialPayout(betAmount: number, probability: number): number {
  // Payout = bet amount * (1 / probability)
  // For example: 100 credits at 0.5 probability = 100 * 2 = 200 credits payout
  const decimalOdds = 1 / probability
  return Math.floor(betAmount * decimalOdds)
}

/**
 * Converts probability to decimal odds (e.g., 0.5 -> 2.0)
 */
export function probabilityToDecimalOdds(probability: number): number {
  return 1 / probability
}

/**
 * Converts decimal odds to probability (e.g., 2.0 -> 0.5)
 */
export function decimalOddsToProbability(odds: number): number {
  return 1 / odds
}

/**
 * Formats probability as a percentage string
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}

/**
 * Formats decimal odds for display (e.g., 2.0x)
 */
export function formatDecimalOdds(odds: number): string {
  return `${odds.toFixed(2)}x`
}

/**
 * Calculates all outcome probabilities after a bet on one outcome
 * Ensures probabilities sum to 1 (or close to it after clamping)
 */
export function recalculateAllProbabilities(
  outcomes: Array<{
    id: string
    currentProbability: number
    pool: number
  }>,
  bettingOnId: string,
  betAmount: number,
  totalBetsOnMarket: number,
  uniqueBettors: number
): Array<{ id: string; newProbability: number }> {
  const totalPool = outcomes.reduce((sum, o) => sum + o.pool, 0)
  const bettingOutcome = outcomes.find(o => o.id === bettingOnId)

  if (!bettingOutcome) {
    throw new Error('Outcome not found')
  }

  // Calculate new probability for the outcome being bet on
  const result = calculateNewProbability({
    currentProbability: bettingOutcome.currentProbability,
    betAmount,
    outcomePool: bettingOutcome.pool,
    totalPool,
    totalBetsOnMarket,
    uniqueBettors,
  })

  // The remaining probability is distributed proportionally among other outcomes
  const remainingProbability = 1 - result.newProbability
  const otherOutcomes = outcomes.filter(o => o.id !== bettingOnId)
  const totalOtherProbability = otherOutcomes.reduce((sum, o) => sum + o.currentProbability, 0)

  return outcomes.map(outcome => {
    if (outcome.id === bettingOnId) {
      return { id: outcome.id, newProbability: result.newProbability }
    } else {
      // Distribute remaining probability proportionally
      const proportion = totalOtherProbability > 0
        ? outcome.currentProbability / totalOtherProbability
        : 1 / otherOutcomes.length
      const newProb = remainingProbability * proportion
      return {
        id: outcome.id,
        newProbability: clamp(newProb, ODDS_CONFIG.MIN_PROBABILITY, ODDS_CONFIG.MAX_PROBABILITY)
      }
    }
  })
}

/**
 * Validates that initial probabilities sum to approximately 1
 */
export function validateProbabilities(probabilities: number[]): boolean {
  const sum = probabilities.reduce((a, b) => a + b, 0)
  return Math.abs(sum - 1) < 0.01 // Allow 1% tolerance
}

/**
 * Normalizes probabilities to sum to exactly 1
 */
export function normalizeProbabilities(probabilities: number[]): number[] {
  const sum = probabilities.reduce((a, b) => a + b, 0)
  if (sum === 0) {
    // Equal distribution if all are 0
    return probabilities.map(() => 1 / probabilities.length)
  }
  return probabilities.map(p => p / sum)
}
