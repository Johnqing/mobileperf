
function logger() {
  function log(...args) {
    console.log( ...args);
  }

  function info(...args) {
    console.log( ...args);
  }

  function debug(...args) {
    console.log( ...args);
  }

  function warn(...args) {
    console.log(...args);
  }

  function error(...args) {
    console.log(...args);
  }

  return {
    log,
    info,
    debug,
    warn,
    error
  };
}

module.exports = logger();
