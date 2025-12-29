module.exports = function (ctx) {
  if (!ctx.gameState) return;

  const state = ctx.gameState.getState();
  const winnerTeam = state.winnerTeam; // 1, 2 or null
  const players = ctx.room.getPlayerList().map(function (p) {
    return { id: p.id, name: p.name, auth: p.auth, team: p.team };
  });

  // Persist stats via bridge if available
  try {
    if (typeof saveStats === 'function') {
      saveStats({ winnerTeam: winnerTeam, players: players });
    }
  } catch (err) {
    if (ctx.logger) ctx.logger.warn('saveStats failed: ' + err.message);
  }

  ctx.gameState.resetGame();
  const nextState = ctx.gameState.getState();
  const size = nextState.gameSize;
  ctx.room.sendAnnouncement('Матч завершен! Следующий размер: ' + size + 'x' + size + '.');

  try {
    if (ctx.auto && typeof ctx.auto.applyWinstayAndStart === 'function') {
      ctx.auto.applyWinstayAndStart(ctx, winnerTeam);
    }
  } catch (e) {
    if (ctx.logger) ctx.logger.warn('applyWinstayAndStart failed: ' + e.message);
  }
};