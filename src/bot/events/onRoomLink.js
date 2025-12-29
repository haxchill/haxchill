module.exports = function (ctx, url) {
  if (ctx.logger) ctx.logger.info('onRoomLink triggered with URL: ' + url);
  console.log('[ROOM LINK]', url);
  ctx.room.sendAnnouncement('Ссылка на комнату: ' + url, null, 0x00FF00, 'bold', 1);
  if (ctx.logger) ctx.logger.info('Room link announcement sent');
};