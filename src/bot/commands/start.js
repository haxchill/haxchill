module.exports = {
  name: 'start',
  trigger: '!start',
  description: 'Начать игру',
  handle: function (ctx, player, args) {
    try {
      ctx.room.startGame();
      ctx.room.sendAnnouncement('Игра запущена игроком ' + player.name);
    } catch (e) {
      ctx.room.sendAnnouncement('Не удалось запустить игру: ' + e.message);
    }
    return false;
  }
};