module.exports = function (ctx) {
  if (!ctx.touches) ctx.touches = { lastTouches: [null, null], lastTeamTouched: 0 };
  ctx.touches.lastTouches = [null, null];
  ctx.touches.lastTeamTouched = 0;
};
