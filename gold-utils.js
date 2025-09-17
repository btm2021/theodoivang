"use strict";

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
  };
}

