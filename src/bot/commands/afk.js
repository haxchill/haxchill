module.exports = {
  name: 'afk',
  trigger: '!afk',
  description: 'Отметиться AFK: кик через 30 минут, если не вернулся',
  handle: function (ctx, player, args) {
    if (!ctx.afkTimers) ctx.afkTimers = {};

    if (ctx.afkTimers[player.id]) {
      clearTimeout(ctx.afkTimers[player.id]);
      delete ctx.afkTimers[player.id];
      if (ctx.gameState && typeof ctx.gameState.setAFK === 'function') {
        ctx.gameState.setAFK(player.id, false);
      }
      if (ctx.captainDraft && ctx.captainDraft.isDraftActive() && typeof ctx.captainDraft.addToAvailable === 'function') {
        const state = ctx.gameState && ctx.gameState.getState();
        const playerMapEntry = state && state.players ? state.players[player.id] : null;
        ctx.captainDraft.addToAvailable(playerMapEntry || { id: player.id, name: player.name, team: player.team, afk: false });
      }
      ctx.room.setPlayerTeam(player.id, 0);
      ctx.room.sendAnnouncement(player.name + ' вернулся из AFK');
      if (ctx.logger) ctx.logger.info('AFK cleared for ' + player.name + ' (id=' + player.id + ')');
      return false;
    }

    const timeoutMs = 30 * 60 * 1000;
    ctx.afkTimers[player.id] = setTimeout(function () {
      if (ctx.afkTimers[player.id]) {
        delete ctx.afkTimers[player.id];
        try {
          ctx.room.kickPlayer(player.id, 'AFK 30 минут', false);
          ctx.room.sendAnnouncement(player.name + ' кикнут за AFK 30 минут', null, 0xFF6600, 'bold', 1);
          if (ctx.logger) ctx.logger.info('AFK kick: ' + player.name + ' (id=' + player.id + ')');
        } catch (e) {
          if (ctx.logger) ctx.logger.warn('AFK kick failed: ' + e.message);
        }
      }
    }, timeoutMs);
    if (ctx.gameState && typeof ctx.gameState.setAFK === 'function') {
      ctx.gameState.setAFK(player.id, true);
    }
    if (ctx.captainDraft && ctx.captainDraft.isDraftActive() && typeof ctx.captainDraft.removeFromAvailable === 'function') {
      ctx.captainDraft.removeFromAvailable(player.id);
    }
    ctx.room.setPlayerTeam(player.id, 0);
    ctx.room.sendAnnouncement(player.name + ' ушел в AFK. Автокик через 30 минут. Повтори !afk чтобы вернуться.');
    if (ctx.logger) ctx.logger.info('AFK set for ' + player.name + ' (id=' + player.id + ')');
    return false;
  }
};
