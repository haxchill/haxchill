module.exports = {
  name: 'status',
  trigger: '!status',
  description: 'Показать состояние комнаты (админ)',
  handle: function (ctx, player, args) {
    // Admin check
    var isAdmin = ctx.room.getPlayerList().some(function(p){ return p.id === player.id && p.admin === true; });
    if (!isAdmin) {
      ctx.room.sendAnnouncement('Команда доступна только админам', player.id);
      return false;
    }

    var state = ctx.gameState ? ctx.gameState.getState() : null;
    var players = ctx.room.getPlayerList() || [];
    var totalPlayers = players.length;
    var gameSize = state ? state.gameSize : '?';
    var inProgress = state ? (state.gameInProgress ? 'да' : 'нет') : 'нет';
    var draftActive = ctx.captainDraft && ctx.captainDraft.isDraftActive ? (ctx.captainDraft.isDraftActive() ? 'да' : 'нет') : 'нет';
    var afkCount = 0;
    if (state && state.players) {
      afkCount = Object.values(state.players).filter(function(p){ return p.afk === true; }).length;
    }

    var dbStats = (typeof loadStats === 'function') ? 'ok' : 'нет';
    var dbAliases = (typeof getAlias === 'function') ? 'ok' : 'нет';

    var msg = [
      'Игроков: ' + totalPlayers,
      'Размер: ' + gameSize + 'x' + gameSize,
      'Игра идет: ' + inProgress,
      'Драфт: ' + draftActive,
      'AFK: ' + afkCount,
      'БД: stats=' + dbStats + ', alias=' + dbAliases
    ].join(' | ');

    ctx.room.sendAnnouncement(msg, player.id, 0x00FF00, 'normal', 0);
    return false;
  }
};
