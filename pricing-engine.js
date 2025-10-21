"use strict";

/**
 * MODULAR GOLD PRICING ENGINE
 * Architecture: Candidate Generation → Scoring → Selection
 * 100% deterministic, pure math, fully configurable
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  // Hard constraints
  SAFE_MARGIN_MIN: 2000000, // 2tr per lượng (chênh lệch khi quy đổi ra 950)
  SAFE_MARGIN_MAX: 8000000, // 7tr per lượng
  MIN_SPREAD: 200000, // 400k (giá bán - giá mua nội bộ)
  MAX_SPREAD: 600000, // 600k
  MIN_DISCOUNT_FROM_PUBLIC: 100000, // Giá bán nội bộ phải thấp hơn công khai ít nhất 50k
  MAX_DISCOUNT_FROM_PUBLIC: 200000, // Giá bán nội bộ phải thấp hơn công khai tối đa 150k
  STEP: 50000, // 50k increments
  SEARCH_RANGE: 800000, // Search 800k below public price (tìm kiếm rộng hơn để có giá thấp hơn)

  // Soft optimization targets
  TARGET_MARGIN: 4500000, // 4.5tr target (middle of range)

  // Scoring weights (must sum to 1.0 for normalized scoring)
  SCORE_WEIGHTS: {
    profitTargetProximity: -0.5,
    competitiveness: 0.10, // Tăng weight để ưu tiên giá mua thấp hơn
    spreadUtility: 0.1,
    volatilitySafety: 0.1,
    maReversionSafety: 0.1,
  },

  // Risk parameters
  VOLATILITY_MULTIPLIER: 100, // K × sigma safety buffer
  MA_DEVIATION_THRESHOLD: 1, // 5% above MA = warning

  // Output
  TOP_N_ALTERNATIVES: 20,
};

// ============================================================================
// LAYER 1: CANDIDATE GENERATION
// ============================================================================

/**
 * Generate all valid buy/sell price candidates
 * @param {number} public610BuyPrice - Public market 610 buy price
 * @param {number} gold950BuyPrice - Public market 950 buy price
 * @param {object} config - Configuration object
 * @returns {Array} Array of valid candidates
 */
function generateCandidates(public610BuyPrice, gold950BuyPrice, config) {
  const candidates = [];
  const actualAge610 = 610;
  const targetAge950 = 950;

  // Search space
  const searchStart = Math.floor(public610BuyPrice / config.STEP) * config.STEP;
  const searchEnd = Math.max(searchStart - config.SEARCH_RANGE, 0);

  console.log('[PricingEngine] Generate candidates:', {
    public610BuyPrice,
    gold950BuyPrice,
    searchStart,
    searchEnd,
    config
  });

  let debugCount = 0;
  let failedConstraints = { constraint1: 0, constraint2: 0, constraint3: 0 };

  for (let buyPrice = searchEnd; buyPrice <= searchStart; buyPrice += config.STEP) {
    for (let spread = config.MIN_SPREAD; spread <= config.MAX_SPREAD; spread += config.STEP) {
      const sellPrice = buyPrice + spread;

      // HARD CONSTRAINT 1: Sell price must be lower than public by 50k-150k
      const discountFromPublic = public610BuyPrice - sellPrice;
      if (discountFromPublic < config.MIN_DISCOUNT_FROM_PUBLIC || discountFromPublic > config.MAX_DISCOUNT_FROM_PUBLIC) {
        failedConstraints.constraint1++;
        continue;
      }

      // HARD CONSTRAINT 2: Sell must be higher than buy
      if (sellPrice <= buyPrice) {
        failedConstraints.constraint2++;
        continue;
      }

      // Calculate margin (per lượng = 10 chỉ)
      const weight610 = 10;
      const weight950 = (weight610 * actualAge610) / targetAge950;
      const costAt610 = weight610 * buyPrice;
      const valueAt950 = weight950 * gold950BuyPrice;
      const marginPerLuong = valueAt950 - costAt610;

      // Debug first few attempts
      if (debugCount < 3) {
        console.log(`[Debug ${debugCount}]`, {
          buyPrice,
          sellPrice,
          spread,
          marginPerLuong,
          marginMin: config.SAFE_MARGIN_MIN,
          marginMax: config.SAFE_MARGIN_MAX,
          passed: marginPerLuong >= config.SAFE_MARGIN_MIN && marginPerLuong <= config.SAFE_MARGIN_MAX
        });
        debugCount++;
      }

      // HARD CONSTRAINT 3: Margin must be within safe range
      if (marginPerLuong < config.SAFE_MARGIN_MIN || marginPerLuong > config.SAFE_MARGIN_MAX) {
        failedConstraints.constraint3++;
        continue;
      }

      // Valid candidate
      candidates.push({
        buyPrice,
        sellPrice,
        spread,
        marginPerLuong,
        weight950,
        costAt610,
        valueAt950,
      });
    }
  }

  console.log('[PricingEngine] Candidates generated:', candidates.length);
  console.log('[PricingEngine] Failed constraints:', failedConstraints);

  return candidates;
}

// ============================================================================
// LAYER 2: SCORING ENGINE
// ============================================================================

/**
 * Score a single candidate across multiple dimensions
 * @param {object} candidate - Candidate to score
 * @param {object} context - Scoring context (public prices, config, historical data)
 * @returns {object} Score breakdown
 */
function scoreCandidate(candidate, context) {
  const { public610BuyPrice, gold950BuyPrice, config, recentGold950Prices, ma950 } = context;

  const scores = {};

  // DIMENSION 1: Profit Target Proximity
  // Closer to TARGET_MARGIN = higher score
  const marginDiff = Math.abs(candidate.marginPerLuong - config.TARGET_MARGIN);
  const maxMarginDiff = config.SAFE_MARGIN_MAX - config.SAFE_MARGIN_MIN;
  scores.profitTargetProximity = Math.max(0, 100 - (marginDiff / maxMarginDiff) * 100);

  // DIMENSION 2: Competitiveness
  // Lower buy price = higher score (more competitive to attract customers)
  const discount = public610BuyPrice - candidate.buyPrice;
  const maxDiscount = config.SEARCH_RANGE;
  // Give bonus for being significantly lower than public
  const discountRatio = discount / maxDiscount;
  scores.competitiveness = Math.min(100, discountRatio * 150); // Amplify to favor lower prices

  // DIMENSION 3: Spread Utility
  // Larger spread = more profit per transaction
  const spreadRange = config.MAX_SPREAD - config.MIN_SPREAD;
  const spreadPosition = candidate.spread - config.MIN_SPREAD;
  scores.spreadUtility = (spreadPosition / spreadRange) * 100;

  // DIMENSION 4: Volatility Safety
  // Ensure margin buffer >= K × sigma
  if (recentGold950Prices && recentGold950Prices.length >= 2) {
    const volatility = calculateVolatility(recentGold950Prices);
    const requiredBuffer = config.VOLATILITY_MULTIPLIER * volatility * candidate.weight950;
    const actualBuffer = candidate.marginPerLuong;
    const safetyRatio = actualBuffer / requiredBuffer;
    scores.volatilitySafety = Math.min(100, safetyRatio * 50); // Cap at 100
  } else {
    scores.volatilitySafety = 50; // Neutral if no data
  }

  // DIMENSION 5: MA Reversion Safety
  // Punish if public price is significantly above MA (avoid buying at tops)
  if (ma950 && ma950 > 0) {
    const deviation = (gold950BuyPrice - ma950) / ma950;
    if (deviation > config.MA_DEVIATION_THRESHOLD) {
      // Price is above MA - reduce score
      const penalty = Math.min(100, (deviation - config.MA_DEVIATION_THRESHOLD) * 1000);
      scores.maReversionSafety = Math.max(0, 100 - penalty);
    } else {
      // Price is at or below MA - safe
      scores.maReversionSafety = 100;
    }
  } else {
    scores.maReversionSafety = 50; // Neutral if no data
  }

  // WEIGHTED TOTAL SCORE
  const totalScore =
    scores.profitTargetProximity * config.SCORE_WEIGHTS.profitTargetProximity +
    scores.competitiveness * config.SCORE_WEIGHTS.competitiveness +
    scores.spreadUtility * config.SCORE_WEIGHTS.spreadUtility +
    scores.volatilitySafety * config.SCORE_WEIGHTS.volatilitySafety +
    scores.maReversionSafety * config.SCORE_WEIGHTS.maReversionSafety;

  return {
    totalScore,
    breakdown: scores,
  };
}

/**
 * Calculate standard deviation (volatility) of price series
 * @param {number[]} prices - Array of historical prices
 * @returns {number} Standard deviation
 */
function calculateVolatility(prices) {
  if (!prices || prices.length < 2) return 0;

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const squaredDiffs = prices.map((p) => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
  return Math.sqrt(variance);
}

/**
 * Calculate moving average
 * @param {number[]} prices - Array of historical prices
 * @returns {number} Moving average
 */
function calculateMA(prices) {
  if (!prices || prices.length === 0) return 0;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

// ============================================================================
// LAYER 3: SELECTION
// ============================================================================

/**
 * Select optimal candidate and top alternatives
 * @param {Array} candidates - Array of candidates with scores
 * @param {object} config - Configuration
 * @returns {object} Selection result
 */
function selectOptimal(candidates, config) {
  if (!candidates || candidates.length === 0) {
    return {
      optimal: null,
      alternatives: [],
      meta: {
        candidateCount: 0,
        status: "NO_VALID_CANDIDATES",
      },
    };
  }

  // Sort by total score descending
  const sorted = candidates.sort((a, b) => b.score.totalScore - a.score.totalScore);

  // Extract optimal
  const optimal = sorted[0];

  // Extract top N alternatives
  const alternatives = sorted.slice(1, config.TOP_N_ALTERNATIVES + 1);

  return {
    optimal: {
      buyPrice: optimal.buyPrice,
      sellPrice: optimal.sellPrice,
      spread: optimal.spread,
      marginPerLuong: optimal.marginPerLuong,
      totalScore: optimal.score.totalScore,
      scoreBreakdown: optimal.score.breakdown,
    },
    alternatives: alternatives.map((c) => ({
      buyPrice: c.buyPrice,
      sellPrice: c.sellPrice,
      spread: c.spread,
      marginPerLuong: c.marginPerLuong,
      totalScore: c.score.totalScore,
      scoreBreakdown: c.score.breakdown,
    })),
    meta: {
      candidateCount: candidates.length,
      status: "SUCCESS",
    },
  };
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

/**
 * Main pricing engine entry point
 * @param {object} input - Input parameters
 * @param {number} input.public610BuyPrice - Public 610 buy price
 * @param {number} input.gold950BuyPrice - Public 950 buy price
 * @param {number[]} input.recentGold950Prices - Recent 950 prices for volatility (optional)
 * @param {object} input.config - Configuration overrides (optional)
 * @returns {object} Pricing recommendation
 */
function optimizeGold610PricesV2(input) {
  const startTime = Date.now();

  // Merge config
  const config = { ...DEFAULT_CONFIG, ...(input.config || {}) };

  // Calculate MA if historical data provided
  const ma950 = input.recentGold950Prices ? calculateMA(input.recentGold950Prices) : null;

  // LAYER 1: Generate candidates
  const candidates = generateCandidates(input.public610BuyPrice, input.gold950BuyPrice, config);

  if (candidates.length === 0) {
    return {
      optimal: null,
      alternatives: [],
      meta: {
        candidateCount: 0,
        volatilityUsed: input.recentGold950Prices ? calculateVolatility(input.recentGold950Prices) : null,
        maUsed: ma950,
        safetyStatus: "NO_VALID_CANDIDATES",
        executionTimestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // LAYER 2: Score all candidates
  const context = {
    public610BuyPrice: input.public610BuyPrice,
    gold950BuyPrice: input.gold950BuyPrice,
    config,
    recentGold950Prices: input.recentGold950Prices,
    ma950,
  };

  const scoredCandidates = candidates.map((candidate) => ({
    ...candidate,
    score: scoreCandidate(candidate, context),
  }));

  // LAYER 3: Select optimal
  const result = selectOptimal(scoredCandidates, config);

  // Add metadata
  const volatility = input.recentGold950Prices ? calculateVolatility(input.recentGold950Prices) : null;
  const safetyStatus = determineSafetyStatus(result.optimal, volatility, ma950, config);

  return {
    ...result,
    meta: {
      ...result.meta,
      volatilityUsed: volatility,
      maUsed: ma950,
      safetyStatus,
      executionTimestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      configUsed: config,
    },
  };
}

/**
 * Determine overall safety status
 * @param {object} optimal - Optimal candidate
 * @param {number} volatility - Market volatility
 * @param {number} ma950 - Moving average
 * @param {object} config - Configuration
 * @returns {string} Safety status
 */
function determineSafetyStatus(optimal, volatility, ma950, config) {
  if (!optimal) return "NO_SOLUTION";

  const warnings = [];

  // Check margin safety
  if (optimal.marginPerLuong < config.SAFE_MARGIN_MIN + 500000) {
    warnings.push("MARGIN_LOW");
  }

  // Check volatility
  if (volatility && optimal.scoreBreakdown.volatilitySafety < 50) {
    warnings.push("HIGH_VOLATILITY");
  }

  // Check MA reversion
  if (ma950 && optimal.scoreBreakdown.maReversionSafety < 50) {
    warnings.push("PRICE_ABOVE_MA");
  }

  if (warnings.length === 0) return "SAFE";
  if (warnings.length === 1) return "CAUTION";
  return "WARNING";
}

// ============================================================================
// META-OPTIMIZATION: AUTO-TUNE SCORE WEIGHTS
// ============================================================================

/**
 * Objective function to evaluate a weight configuration
 * Lower score = better (we want to minimize)
 */
function evaluateWeightConfig(weights, testCases) {
  let totalPenalty = 0;

  testCases.forEach(testCase => {
    const config = {
      ...DEFAULT_CONFIG,
      SCORE_WEIGHTS: weights
    };

    const result = optimizeGold610PricesV2({
      public610BuyPrice: testCase.public610,
      gold950BuyPrice: testCase.gold950,
      config
    });

    if (!result.optimal) {
      totalPenalty += 10000; // Heavy penalty for no solution
      return;
    }

    // Evaluate against desired criteria
    const buyPrice = result.optimal.buyPrice;
    const sellPrice = result.optimal.sellPrice;
    const margin = result.optimal.marginPerLuong;

    // Penalty 1: Buy price should be competitive (lower is better)
    const buyDiscount = testCase.public610 - buyPrice;
    const buyPenalty = buyDiscount < 200000 ? (200000 - buyDiscount) / 10000 : 0;

    // Penalty 2: Sell price should be close to public (within 50-150k)
    const sellDiscount = testCase.public610 - sellPrice;
    const sellPenalty = Math.abs(sellDiscount - 100000) / 10000; // Target 100k discount

    // Penalty 3: Margin should be in sweet spot (3-5tr)
    const targetMargin = 4000000;
    const marginPenalty = Math.abs(margin - targetMargin) / 100000;

    // Penalty 4: Spread should be reasonable (450-550k)
    const spread = sellPrice - buyPrice;
    const targetSpread = 500000;
    const spreadPenalty = Math.abs(spread - targetSpread) / 10000;

    totalPenalty += buyPenalty + sellPenalty + marginPenalty + spreadPenalty;
  });

  return totalPenalty / testCases.length; // Average penalty
}

/**
 * Generate random weight configuration that sums to 1.0
 */
function generateRandomWeights() {
  const keys = ['profitTargetProximity', 'competitiveness', 'spreadUtility', 'volatilitySafety', 'maReversionSafety'];
  const raw = keys.map(() => Math.random());
  const sum = raw.reduce((a, b) => a + b, 0);
  const normalized = raw.map(v => v / sum);

  const weights = {};
  keys.forEach((key, i) => {
    weights[key] = normalized[i];
  });

  return weights;
}

/**
 * Auto-tune score weights using random search
 * @param {Array} testCases - Array of {public610, gold950} test cases
 * @param {number} iterations - Number of random configurations to try
 * @returns {object} Best weight configuration found
 */
function autoTuneWeights(testCases, iterations = 100) {
  console.log(`[AutoTune] Starting with ${iterations} iterations on ${testCases.length} test cases`);

  let bestWeights = DEFAULT_CONFIG.SCORE_WEIGHTS;
  let bestScore = evaluateWeightConfig(bestWeights, testCases);

  console.log('[AutoTune] Baseline score:', bestScore.toFixed(2));

  for (let i = 0; i < iterations; i++) {
    const candidateWeights = generateRandomWeights();
    const score = evaluateWeightConfig(candidateWeights, testCases);

    if (score < bestScore) {
      bestScore = score;
      bestWeights = candidateWeights;
      console.log(`[AutoTune] Iteration ${i}: New best score ${score.toFixed(2)}`, candidateWeights);
    }

    // Progress indicator
    if ((i + 1) % 20 === 0) {
      console.log(`[AutoTune] Progress: ${i + 1}/${iterations}, Best: ${bestScore.toFixed(2)}`);
    }
  }

  console.log('[AutoTune] Final best weights:', bestWeights);
  console.log('[AutoTune] Final best score:', bestScore.toFixed(2));

  return {
    weights: bestWeights,
    score: bestScore,
    improvement: ((evaluateWeightConfig(DEFAULT_CONFIG.SCORE_WEIGHTS, testCases) - bestScore) / evaluateWeightConfig(DEFAULT_CONFIG.SCORE_WEIGHTS, testCases) * 100).toFixed(2) + '%'
  };
}

/**
 * Simulated Annealing for better optimization
 */
function autoTuneWeightsAdvanced(testCases, iterations = 200) {
  console.log(`[AutoTune SA] Starting Simulated Annealing with ${iterations} iterations`);

  let currentWeights = DEFAULT_CONFIG.SCORE_WEIGHTS;
  let currentScore = evaluateWeightConfig(currentWeights, testCases);
  let bestWeights = { ...currentWeights };
  let bestScore = currentScore;

  let temperature = 1.0;
  const coolingRate = 0.995;

  for (let i = 0; i < iterations; i++) {
    // Generate neighbor by perturbing current weights
    const neighborWeights = {};
    const keys = Object.keys(currentWeights);
    const perturbAmount = 0.1 * temperature;

    keys.forEach(key => {
      neighborWeights[key] = Math.max(0.01, currentWeights[key] + (Math.random() - 0.5) * perturbAmount);
    });

    // Normalize to sum to 1.0
    const sum = Object.values(neighborWeights).reduce((a, b) => a + b, 0);
    keys.forEach(key => {
      neighborWeights[key] /= sum;
    });

    const neighborScore = evaluateWeightConfig(neighborWeights, testCases);

    // Accept or reject
    const delta = neighborScore - currentScore;
    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
      currentWeights = neighborWeights;
      currentScore = neighborScore;

      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestWeights = { ...currentWeights };
        console.log(`[AutoTune SA] Iteration ${i}: New best ${bestScore.toFixed(2)}`, bestWeights);
      }
    }

    temperature *= coolingRate;

    if ((i + 1) % 50 === 0) {
      console.log(`[AutoTune SA] Progress: ${i + 1}/${iterations}, Best: ${bestScore.toFixed(2)}, Temp: ${temperature.toFixed(4)}`);
    }
  }

  console.log('[AutoTune SA] Final best weights:', bestWeights);
  console.log('[AutoTune SA] Final best score:', bestScore.toFixed(2));

  return {
    weights: bestWeights,
    score: bestScore,
    improvement: ((evaluateWeightConfig(DEFAULT_CONFIG.SCORE_WEIGHTS, testCases) - bestScore) / evaluateWeightConfig(DEFAULT_CONFIG.SCORE_WEIGHTS, testCases) * 100).toFixed(2) + '%'
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    optimizeGold610PricesV2,
    DEFAULT_CONFIG,
    generateCandidates,
    scoreCandidate,
    selectOptimal,
    calculateVolatility,
    calculateMA,
    autoTuneWeights,
    autoTuneWeightsAdvanced,
    evaluateWeightConfig,
  };
} else {
  window.PricingEngine = {
    optimizeGold610PricesV2,
    DEFAULT_CONFIG,
    generateCandidates,
    scoreCandidate,
    selectOptimal,
    calculateVolatility,
    calculateMA,
    autoTuneWeights,
    autoTuneWeightsAdvanced,
    evaluateWeightConfig,
  };
}
