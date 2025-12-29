module.exports = function (ctx, player) {
  if (ctx.logger) ctx.logger.info('onPlayerJoin: ' + player.name + ' (id=' + player.id + ', auth=' + player.auth + ')');
  
  if (!ctx.gameState) {
    if (ctx.logger) ctx.logger.warn('gameState not available');
    return;
  }
  
  let playerRole = 'player';
  if (ctx.adminList) {
    let match = null;
    if (player.auth) {
      match = ctx.adminList.find(function(admin) { return admin.auth === player.auth; });
    }
    if (!match) {
      match = ctx.adminList.find(function(admin) { return (admin.name || '').toLowerCase() === (player.name || '').toLowerCase(); });
    }
    if (match) {
      playerRole = match.role || 'player';
      const roleLabel = match.role === 'host' ? 'Хост' : 'Админ';
      ctx.room.setPlayerAdmin(player.id, true);
      ctx.room.sendAnnouncement(roleLabel + ' ' + player.name + ' вошел в комнату', null, 0xFF0000, 'bold', 1);
      if (ctx.logger) ctx.logger.info(roleLabel + ' rights granted to ' + player.name + ' (auth=' + (player.auth || 'none') + ')');
    }
  }
  
  ctx.gameState.addPlayer(player.id, player.name);
  const state = ctx.gameState.getState();
  const size = state.gameSize;
  const totalPlayers = ctx.gameState.getTotalPlayers();

  if (player.auth && typeof registerPlayer === 'function') {
    registerPlayer(player.auth, player.name, playerRole).catch(function (err) {
      if (ctx.logger) ctx.logger.warn('registerPlayer failed: ' + err.message);
    });
  }
  
  const scores = ctx.room.getScores();
  if (scores) {
    ctx.room.sendAnnouncement('Привет, ' + player.name + '! Игра уже идет. Ждите следующего раунда.');
    try {
      if (ctx.auto && typeof ctx.auto.balanceTeams === 'function') ctx.auto.balanceTeams(ctx);
    } catch {}
    return;
  }
  
  ctx.room.sendAnnouncement('Привет, ' + player.name + '! Текущий размер матча: ' + size + 'x' + size + '. Игроков: ' + totalPlayers);
  
  if (ctx.logger) ctx.logger.info('Player ' + player.name + ' assigned to game size ' + size + 'x' + size);

  if (player.auth && typeof getAlias === 'function') {
    getAlias(player.auth)
      .then(function (row) {
        if (row && row.alias) {
          ctx.room.sendAnnouncement('Деанон: ' + player.name + ' => ' + row.alias);
        }
      })
      .catch(function (err) {
        if (ctx.logger) ctx.logger.warn('getAlias on join failed: ' + err.message);
      });
  }
  
  const requiredPlayers = size * 2;
  if (totalPlayers >= requiredPlayers && totalPlayers >= 2) {
    ctx.room.sendAnnouncement('Достаточно игроков (' + totalPlayers + '/' + requiredPlayers + '). Игра начинается через 3 секунды...');
    setTimeout(function() {
      try {
        const currentScores = ctx.room.getScores();
        if (!currentScores) {
          ctx.room.startGame();
          if (ctx.logger) ctx.logger.info('Game auto-started with ' + totalPlayers + ' players');
        }
      } catch (e) {
        ctx.room.sendAnnouncement('Ошибка запуска: ' + e.message + '. Используйте !start');
      }
    }, 3000);
  } else {
    ctx.room.sendAnnouncement('Ожидаем еще ' + (requiredPlayers - totalPlayers) + ' игрока(ов). Или используйте !start для старта.');
  }

  try {
    if (ctx.auto && typeof ctx.auto.balanceTeams === 'function') ctx.auto.balanceTeams(ctx);
  } catch {}
};