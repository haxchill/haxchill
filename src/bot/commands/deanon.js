module.exports = {
  name: 'deanon',
  trigger: '!deanon',
  description: 'Показать или задать деанон по auth',
  handle: function (ctx, player, args) {
    if (!args || args.length === 0) {
      ctx.room.sendAnnouncement('Использование: !deanon <@имя|id> [alias]\nПодсказка: используйте @ и выберите игрока из списка. Alias может задавать только админ.');
      return false;
    }

    // Find target player
    let query = args[0] || '';
    query = query.replace(/^[@#]+/, '').trim(); // поддержка @упоминаний и #ID
    const playerList = ctx.room.getPlayerList();
    const target = playerList.find(function (p) {
      return p.name.toLowerCase() === query.toLowerCase() || p.id === parseInt(query, 10);
    });

    if (!target) {
      ctx.room.sendAnnouncement('Игрок не найден: ' + query);
      return false;
    }

    // Resolve target auth: use target.auth if present, else try DB by their name
    var targetAuth = target.auth;
    if (!targetAuth && typeof resolveAuthForName === 'function') {
      // Note: resolve by the target's name
      // If not found, we will still proceed to show message
      // but setting alias requires a resolvable auth
      // and will be blocked if not found
      targetAuth = null;
    }

    const isAdmin = player.admin === true;

    // Admin can set alias with second argument
    if (args.length >= 2) {
      if (!isAdmin) {
        ctx.room.sendAnnouncement('Только админ может задавать alias.');
        return false;
      }
      const alias = args.slice(1).join(' ');
      if (!alias || alias.length < 2) {
        ctx.room.sendAnnouncement('Alias слишком короткий.');
        return false;
      }
      if (!targetAuth && typeof resolveAuthForName === 'function') {
        // Try resolve now for setting alias
        // This is synchronous path; we cannot await here, so show info and return
        ctx.room.sendAnnouncement('Невозможно задать alias: нет auth у цели. Войдите через Haxball или добавьте запись в БД.');
        return false;
      }
      if (typeof setAlias !== 'function') {
        ctx.room.sendAnnouncement('Хранилище alias недоступно.');
        return false;
      }
      setAlias(targetAuth || target.auth, alias)
        .then(function () {
          ctx.room.sendAnnouncement('Alias сохранен: ' + target.name + ' -> ' + alias);
        })
        .catch(function (err) {
          if (ctx.logger) ctx.logger.warn('setAlias error: ' + err.message);
          ctx.room.sendAnnouncement('Ошибка сохранения alias.');
        });
      return false;
    }

    // Otherwise just show alias if exists
    if (typeof getAlias !== 'function') {
      ctx.room.sendAnnouncement('Хранилище alias недоступно.');
      return false;
    }

    var authPromise = Promise.resolve(targetAuth || target.auth);
    if (!targetAuth && typeof resolveAuthForName === 'function') {
      authPromise = resolveAuthForName(target.name);
    }

    authPromise
      .then(function (resolvedAuth) {
        if (!resolvedAuth) {
          ctx.room.sendAnnouncement('Деанон недоступен: у игрока нет auth и запись по имени в БД не найдена.');
          return false;
        }
        return getAlias(resolvedAuth);
      })
      .then(function (row) {
        if (row && row.alias) {
          ctx.room.sendAnnouncement('Деанон: ' + target.name + ' => ' + row.alias);
        } else {
          ctx.room.sendAnnouncement('Деанон не найден для ' + target.name);
        }
      })
      .catch(function (err) {
        if (ctx.logger) ctx.logger.warn('getAlias error: ' + err.message);
        ctx.room.sendAnnouncement('Ошибка поиска деанона.');
      });

    return false;
  }
};
