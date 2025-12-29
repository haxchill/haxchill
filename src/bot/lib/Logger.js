// Logger: Works in both Node and browser context
// Serializable for injection into browser via Puppeteer

const Logger = (function () {
  function timestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return hh + ':' + mm + ':' + ss;
  }

  function log(level, message) {
    const prefix = '[' + timestamp() + '] [' + level + ']';
    const fullMsg = prefix + ' ' + message;
    
    // Works in both Node and browser
    if (typeof console !== 'undefined') {
      if (level === 'ERROR') {
        console.error(fullMsg);
      } else if (level === 'WARN') {
        console.warn(fullMsg);
      } else {
        console.log(fullMsg);
      }
    }
  }

  return {
    info: function (msg) { log('INFO', msg); },
    warn: function (msg) { log('WARN', msg); },
    error: function (msg) { log('ERROR', msg); },
    debug: function (msg) { log('DEBUG', msg); },
  };
})();

module.exports = Logger;
