module.exports = {
  name: 'stats',
  trigger: '!stats',
  description: 'Показать вашу статистику (игры/победы/ничьи/поражения)',
  handle: function (ctx, player, args) {
    if (typeof loadStats !== 'function') {
      ctx.room.sendAnnouncement('Статистика недоступна (нет соединения с БД).');
      return false;
    }

    // Resolve auth: use player's auth if present, otherwise try DB by name
    var authPromise = Promise.resolve(player.auth);
    if (!player.auth && typeof resolveAuthForName === 'function') {
      authPromise = resolveAuthForName(player.name);
    }

    authPromise
      .then(function (resolvedAuth) {
        if (!resolvedAuth) {
          ctx.room.sendAnnouncement('Стата недоступна: требуется вход через Haxball (auth) или запись по имени в БД.');
          return false;
        }
        return loadStats(resolvedAuth);
      })
      .then(function (stat) {
        if (stat === false) return false; // previous step already handled
        if (!stat) {
          ctx.room.sendAnnouncement('Нет записей. Сыграй матч, чтобы появилась статистика.');
          return false;
        }
        const games = stat.games || 0;
        const wins = stat.wins || 0;
        const draws = stat.draws || 0;
        const losses = stat.losses || 0;
        const winrate = games > 0 ? ((wins / games) * 100).toFixed(1) + '%' : '0%';
        ctx.room.sendAnnouncement(
          player.name + ': ' +
          'Игры ' + games + ', ' +
          'Победы ' + wins + ', ' +
          'Ничьи ' + draws + ', ' +
          'Поражения ' + losses + ', ' +
          'Winrate ' + winrate
        );
        return false;
      })
      .catch(function (err) {
        if (ctx.logger) ctx.logger.warn('loadStats error: ' + err.message);
        ctx.room.sendAnnouncement('Ошибка загрузки статистики.');
      });

    return false; // prevent echo
  }
};
