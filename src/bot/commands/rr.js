module.exports = {
  name: 'restart',
  trigger: '!rr',
  description: 'Перезапуск матча',
  handle: function (ctx, player, args) {
    try { ctx.room.stopGame(); } catch {}
    ctx.room.startGame();
    ctx.room.sendAnnouncement('Перезапуск матча инициирован ' + player.name + '.');
    return false; // cancel echo
  }
};