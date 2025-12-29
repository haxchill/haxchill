module.exports = {
  name: 'addadmin',
  trigger: '!addadmin',
  description: 'Добавить админа по auth (только для админов)',
  handle: function (ctx, player, args) {
    // Check if player is admin
    const isAdmin = ctx.room.getPlayerList().find(function(p) {
      return p.id === player.id && p.admin === true;
    });
    
    if (!isAdmin) {
      ctx.room.sendAnnouncement('Только админы могут использовать эту команду', player.id);
      return;
    }
    
    if (args.length < 1) {
      ctx.room.sendAnnouncement('Использование: !addadmin <player_name_or_id>', player.id);
      return;
    }
    
    const targetName = args.join(' ');
    const playerList = ctx.room.getPlayerList();
    
    // Find target player by name or ID
    const targetPlayer = playerList.find(function(p) {
      return p.name.toLowerCase() === targetName.toLowerCase() || p.id === parseInt(targetName, 10);
    });
    
    if (!targetPlayer) {
      ctx.room.sendAnnouncement('Игрок "' + targetName + '" не найден', player.id);
      return;
    }
    
    if (!targetPlayer.auth) {
      ctx.room.sendAnnouncement('У игрока ' + targetPlayer.name + ' нет auth (гость)', player.id);
      return;
    }
    
    // Check if already admin in list
    const alreadyAdmin = ctx.adminList && ctx.adminList.some(function(admin) {
      return admin.auth === targetPlayer.auth;
    });
    
    if (alreadyAdmin) {
      ctx.room.sendAnnouncement(targetPlayer.name + ' уже админ', player.id);
      return;
    }
    
    // Add to admin list (in-memory for current session)
    if (!ctx.adminList) {
      ctx.adminList = [];
    }
    ctx.adminList.push({ auth: targetPlayer.auth, name: targetPlayer.name, role: 'admin' });
    
    // Grant admin rights immediately
    ctx.room.setPlayerAdmin(targetPlayer.id, true);
    
    ctx.room.sendAnnouncement(
      targetPlayer.name + ' назначен админом! (auth: ' + targetPlayer.auth + ')',
      null,
      0x00FF00,
      'bold',
      2
    );
    
    if (ctx.logger) {
      ctx.logger.info('Admin added: ' + targetPlayer.name + ' (auth=' + targetPlayer.auth + ') by ' + player.name);
    }
    
    // Note: This only adds to current session. To persist, we need to expose DB to browser context
    ctx.room.sendAnnouncement('⚠️ Админка сохранена только на эту сессию. Для постоянной админки добавьте в БД через консоль.', player.id);
  }
};
