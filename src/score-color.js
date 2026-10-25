(function attachScoreColor(global) {
  function colorForScore(score, min, max, direction = "desc") {
    if (max === min) return "transparent";
    const baseRatio = (score - min) / (max - min);
    const ratio = direction === "asc" ? 1 - baseRatio : baseRatio;
    if (ratio >= 2 / 3) {
      const strength = (ratio - 2 / 3) * 3;
      return `rgba(34, 197, 94, ${strength.toFixed(3)})`;
    }
    if (ratio <= 1 / 3) {
      const strength = (1 / 3 - ratio) * 3;
      return `rgba(239, 68, 68, ${strength.toFixed(3)})`;
    }
    return "transparent";
  }

  global.ScoreColor = Object.freeze({ colorForScore });
})(globalThis);
