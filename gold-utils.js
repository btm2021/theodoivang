
/**
 * Gold Calculation Utilities (pure, UI-agnostic)
 */

// Format currency (VND) with rounding
function formatMoney(amount) {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat("vi-VN").format(n);
}

// Format weight in chỉ (10 chỉ = 1 lượng)
function formatWeight(weightInChi) {
  const w = Number(weightInChi) || 0;
  const luong = Math.floor(w / 10);
  const chi = Math.floor(w % 10);
  const phan = Math.round((w % 1) * 10);

  const parts = [];
  if (luong > 0) parts.push(`${luong} lượng`);
  if (chi > 0) parts.push(`${chi} chỉ`);
  if (phan > 0) parts.push(`${phan} phân`);
  return parts.join(" ") || "0 chỉ";
}

// Convert weight across gold purities
function convertWeight(originalWeight, originalAge, targetAge) {
  const w = Number(originalWeight) || 0;
  const a = Number(originalAge) || 0;
  const t = Number(targetAge) || 1;
  if (t === 0) return 0;
  return (w * a) / t;
}

// Calculate value from weight and price
// unit: 'vnd_chi' (default) or 'vnd_luong'
function calculateValue(weight, price, unit = "vnd_chi") {
  const w = Number(weight) || 0;
  let perChi = Number(price) || 0;
  if (unit === "vnd_luong") perChi = perChi / 10;
  return w * perChi;
}

// Percentage difference
function calculatePercentageDiff(newValue, originalValue) {
  const a = Number(newValue) || 0;
  const b = Number(originalValue) || 0;
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

// Convert an internal price (per chỉ) at a given age to gold 950 equivalent (per chỉ)
function convertInternalPriceToGold950(internalPrice, internalAge, targetAge = 950) {
  const weightChi = 1; // per chỉ basis
  const convertedWeight = convertWeight(weightChi, internalAge, targetAge);
  return calculateValue(convertedWeight, internalPrice);
}

// Decode price from obfuscated attribute (e.g. nb from webgia)
function decodePrice(encodedStr) {
  if (!encodedStr) return 0;
  const clean = String(encodedStr).replace(/[A-Z]/g, "");
  const out = [];
  for (let i = 0; i < clean.length - 1; i += 2) {
    const hexPair = clean.substr(i, 2);
    const code = parseInt(hexPair, 16);
    if (!Number.isNaN(code)) out.push(String.fromCharCode(code));
  }
  const digits = out.join("").replace(/[^\d]/g, "");
  const num = parseFloat(digits);
  return Number.isFinite(num) ? num : 0;
}

// Extract age (tuổi vàng) from a name/label
function extractAge(name) {
  const s = String(name || "");
  if (s.includes("SJC")) return 999;
  if (s.includes("99,9%") || s.includes("99.9%")) return 999;
  if (s.includes("9T85") || s.includes("98,5%") || s.includes("98.5%")) return 985;
  if (s.includes("9T8") || s.includes("98,0%") || s.includes("98.0%")) return 980;
  if (s.includes("95") || s.includes("95,0%") || s.includes("95.0%")) return 950;
  if (s.includes("V75") || s.includes("75,0%") || s.includes("75.0%")) return 750;
  if (s.includes("V68") || s.includes("68,0%") || s.includes("68.0%")) return 680;
  if (s.includes("6T1") || s.includes("61,0%") || s.includes("61.0%")) return 610;
  if (s.includes("14K") || s.includes("58,0%") || s.includes("58.0%")) return 580;
  if (s.includes("10K") || s.includes("41,0%") || s.includes("41.0%")) return 410;
  const m = s.match(/(\d{2,4})/);
  return m ? parseInt(m[1], 10) : 999;
}

// Map displayed ages to actual age used for conversion
function getActualGoldAge(displayAge) {
  const a = Number(displayAge) || 0;
  if (a === 9999) return 950; // business rule from previous logic
  if (a === 980) return 980;
  if (a === 710) return 710;
  if (a === 610) return 610;
  return a;
}

// Rough purity mapping (percentage)
function calculateGoldPurity(age) {
  const a = Number(age) || 0;
  if (a >= 9999) return 99.5;
  if (a >= 999) return 99.5;
  if (a >= 985) return 98.5;
  if (a >= 980) return 98.0;
  if (a >= 950) return 95.0;
  if (a >= 750) return 75.0;
  if (a >= 680) return 68.0;
  if (a >= 610) return 61.0;
  if (a >= 580) return 58.0;
  if (a >= 410) return 41.0;
  return Number((a / 10).toFixed(1));
}

// Current date/time in vi-VN
function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("vi-VN"),
    time: now.toLocaleTimeString("vi-VN"),
  };
}

// Build comparison dataset between internal prices and public gold 950
function calculateComparisons(internalData, publicData) {
  if (!Array.isArray(internalData) || !Array.isArray(publicData) || internalData.length === 0 || publicData.length === 0) {
    return { error: "Chưa đủ dữ liệu để so sánh", comparisons: [] };
  }

  const gold950 = publicData.find((x) => x && Number(x.age) === 950 && Number(x.buyPrice) > 0);
  if (!gold950) {
    return { error: "Không tìm thấy giá vàng 950 để so sánh", comparisons: [] };
  }

  const gold950BuyPrice = Number(gold950.buyPrice) || 0;
  const comparisons = [];

  internalData.forEach((internal) => {
    if (!internal) return;
    const displayAge = internal.code ?? internal.age ?? internal.tuoi_vang;
    const actualAge = getActualGoldAge(displayAge);
    const internalBuy = (Number(internal.buyingPrice ?? internal.buyPrice ?? internal.gia_mua) || 0) * 1000;
    const internalSell = (Number(internal.sellingPrice ?? internal.sellPrice ?? internal.gia_ban) || 0) * 1000;
    const internalName = internal.hienthiBangKe || internal.name || internal.loai_vang || "N/A";

    if (internalBuy > 0 || internalSell > 0) {
      const convertedBuy = internalBuy > 0 ? convertInternalPriceToGold950(internalBuy, actualAge, 950) : 0;
      const convertedSell = internalSell > 0 ? convertInternalPriceToGold950(internalSell, actualAge, 950) : 0;

      const buyDiff = convertedBuy - gold950BuyPrice;
      const sellDiff = convertedSell - gold950BuyPrice;
      const buyPercent = calculatePercentageDiff(convertedBuy, gold950BuyPrice);
      const sellPercent = calculatePercentageDiff(convertedSell, gold950BuyPrice);

      comparisons.push({
        name: internalName,
        age: displayAge,
        actualAge,
        originalBuy: internalBuy,
        originalSell: internalSell,
        convertedBuy: convertedBuy,
        convertedSell: convertedSell,
        buyDiff,
        sellDiff,
        buyPercent,
        sellPercent,
        gold950Price: gold950BuyPrice,
      });
    }
  });

  return { error: null, comparisons };
}

// Round to nearest 50k (50,000 VND)
function roundTo50k(value) {
  return Math.round(value / 50000) * 50000;
}

// Optimize internal prices for gold 610
// Returns suggested buy and sell prices based on public 610 and 950 prices
function optimizeGold610Prices(public610BuyPrice, gold950BuyPrice) {
  const MIN_SPREAD = 400000; // 400k minimum spread
  const MAX_SPREAD = 600000; // 600k maximum spread
  const MIN_SAFE_MARGIN = 3000000; // 3tr minimum safe margin when converted to 950
  const MAX_SAFE_MARGIN = 5000000; // 5tr maximum safe margin when converted to 950
  const TARGET_MARGIN = 4000000; // 4tr target margin (middle of range)

  const actualAge610 = 610;
  const targetAge950 = 950;

  // Logic: 
  // - We BUY from customers at internal buy price (lower than public)
  // - We SELL to public market by converting to 950
  // - Margin = (converted value at 950) - (what we paid at 610)

  let bestBuyPrice = 0;
  let bestSellPrice = 0;
  let bestScore = -Infinity;

  // Search space: We want to buy BELOW public price
  // Start from public price and search downward
  const searchStart = Math.floor(public610BuyPrice / 50000) * 50000;
  const searchEnd = Math.max(searchStart - 3000000, 0); // Search down to 3tr below

  for (let internalBuy = searchEnd; internalBuy <= searchStart; internalBuy += 50000) {
    // For each buy price, try different spreads
    for (let spread = MIN_SPREAD; spread <= MAX_SPREAD; spread += 50000) {
      const internalSell = internalBuy + spread;

      // Constraint 1: Sell must be higher than buy
      if (internalSell <= internalBuy) continue;

      // Constraint 2: Our sell price should not exceed public buy price
      // (customers won't buy from us if we're more expensive than public)
      if (internalSell > public610BuyPrice) continue;

      // Calculate margin when we convert and sell at 950
      // We buy at internalBuy, convert to 950, sell at gold950BuyPrice
      const weight610 = 10; // 1 lượng = 10 chỉ
      const costAt610 = weight610 * internalBuy; // What we pay

      // Convert weight from 610 to 950
      const weight950 = convertWeight(weight610, actualAge610, targetAge950);
      const valueAt950 = weight950 * gold950BuyPrice; // What we get

      const marginPerLuong = valueAt950 - costAt610;

      // Check if margin is within safe range (per lượng)
      if (marginPerLuong < MIN_SAFE_MARGIN || marginPerLuong > MAX_SAFE_MARGIN) continue;

      // Scoring function (multi-objective optimization)
      // 1. Prefer margins closer to target (4tr per lượng)
      const marginScore = -Math.abs(marginPerLuong - TARGET_MARGIN) / 100000;

      // 2. Prefer larger spreads (more profit from internal transactions)
      const spreadScore = spread / 50000;

      // 3. Prefer buy prices closer to public (more competitive, attract more customers)
      const diffFromPublic = public610BuyPrice - internalBuy;
      const competitiveScore = -diffFromPublic / 100000;

      // 4. Balance: not too far from public (lose customers) but not too close (less margin)
      const balanceScore = diffFromPublic >= 200000 && diffFromPublic <= 1000000 ? 10 : 0;

      // Weighted score
      const score = marginScore * 10 + spreadScore * 5 + competitiveScore * 2 + balanceScore;

      if (score > bestScore) {
        bestScore = score;
        bestBuyPrice = internalBuy;
        bestSellPrice = internalSell;
      }
    }
  }

  // If no solution found, use fallback heuristic
  if (bestBuyPrice === 0) {
    // Work backwards from target margin
    // We want: (weight950 * gold950BuyPrice) - (weight610 * buyPrice) = TARGET_MARGIN
    // Solve for buyPrice
    const weight610 = 10;
    const weight950 = convertWeight(weight610, actualAge610, targetAge950);
    const targetCost = (weight950 * gold950BuyPrice) - TARGET_MARGIN;
    const targetBuyPrice = targetCost / weight610;

    bestBuyPrice = roundTo50k(targetBuyPrice);
    bestSellPrice = roundTo50k(bestBuyPrice + 500000); // Use middle spread (500k)

    // Ensure constraints
    if (bestSellPrice > public610BuyPrice) {
      bestSellPrice = roundTo50k(public610BuyPrice - 50000);
      bestBuyPrice = roundTo50k(bestSellPrice - 500000);
    }
  }

  // Round to 50k
  bestBuyPrice = roundTo50k(bestBuyPrice);
  bestSellPrice = roundTo50k(bestSellPrice);

  // Calculate final metrics
  const weight610 = 10;
  const weight950 = convertWeight(weight610, actualAge610, targetAge950);

  const costAtBuy = weight610 * bestBuyPrice;
  const valueAt950FromBuy = weight950 * gold950BuyPrice;
  const buyMarginPerLuong = valueAt950FromBuy - costAtBuy;

  const costAtSell = weight610 * bestSellPrice;
  const valueAt950FromSell = weight950 * gold950BuyPrice;
  const sellMarginPerLuong = valueAt950FromSell - costAtSell;

  const finalSpread = bestSellPrice - bestBuyPrice;
  const profitPerLuong = finalSpread * 10;

  // Competitiveness: how much lower than public price (positive = good)
  const diffFromPublic = public610BuyPrice - bestBuyPrice;
  const competitivenessPercent = (diffFromPublic / public610BuyPrice * 100).toFixed(2);

  return {
    suggestedBuyPrice: bestBuyPrice,
    suggestedSellPrice: bestSellPrice,
    spread: finalSpread,
    buyMargin: buyMarginPerLuong,
    sellMargin: sellMarginPerLuong,
    profitPerLuong: profitPerLuong,
    public610Price: public610BuyPrice,
    gold950Price: gold950BuyPrice,
    isOptimal: bestScore > -Infinity,
    competitiveness: competitivenessPercent,
    diffFromPublic: diffFromPublic
  };
}

// Exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatMoney,
    formatWeight,
    convertWeight,
    calculateValue,
    calculatePercentageDiff,
    convertInternalPriceToGold950,
    decodePrice,
    extractAge,
    getActualGoldAge,
    calculateGoldPurity,
    getCurrentDateTime,
    calculateComparisons,
    roundTo50k,
    optimizeGold610Prices,
  };
} else {
  window.GoldUtils = {
    formatMoney,
    formatWeight,
    convertWeight,
    calculateValue,
    calculatePercentageDiff,
    convertInternalPriceToGold950,
    decodePrice,
    extractAge,
    getActualGoldAge,
    calculateGoldPurity,
    getCurrentDateTime,
    calculateComparisons,
    roundTo50k,
    optimizeGold610Prices,
  };
}

