(function attachTeamRankModel(global) {
  function orderByTbaRanking(teams, rankingRankForTeam, rankingSortValueForTeam) {
    return [...(Array.isArray(teams) ? teams : [])].sort((left, right) => {
      const leftRank = rankingRankForTeam(left);
      const rightRank = rankingRankForTeam(right);
      if (leftRank !== rightRank) {
        const normalizedLeftRank = leftRank ?? Number.POSITIVE_INFINITY;
        const normalizedRightRank = rightRank ?? Number.POSITIVE_INFINITY;
        if (normalizedLeftRank !== normalizedRightRank) return normalizedLeftRank - normalizedRightRank;
      }

      const leftSortValue = rankingSortValueForTeam(left, 0);
      const rightSortValue = rankingSortValueForTeam(right, 0);
      const normalizedLeftSortValue = Number.isFinite(leftSortValue) ? leftSortValue : Number.NEGATIVE_INFINITY;
      const normalizedRightSortValue = Number.isFinite(rightSortValue) ? rightSortValue : Number.NEGATIVE_INFINITY;
      return normalizedRightSortValue - normalizedLeftSortValue || left.number - right.number;
    });
  }

  global.teamRankModel = Object.freeze({ orderByTbaRanking });
})(globalThis);
