const logger = require('./util/logger');

class Monkey {
  /**
   * Monkey executor
   * @param {string} package - Package name to test with monkey
   * @param {number} timeout - Monkey duration in minutes, default is infinite
   */
  constructor(adb, package, timeout = 10000) {
    this.adb = adb;
    this.package = package;
    this.timeout = timeout;
    this.running = false;
  }

  /**
   * Starts monkey
   * @param {Date} startTime - Start time of monkey
   */
  start(startTime) {
    this.startTime = startTime || new Date().getTime();

    if (!this.running) {
      this.running = true;
      this.startMonkey(this.package, this.timeout);
    }
  }

  /**
   * Stops monkey
   */
  stop() {
    this.stopMonkey();
  }

  /**
   * Starts monkey process
   * @param {string} package - Package name to test with monkey
   * @param {number} timeout - Monkey duration in minutes
   */
  startMonkey(package, timeout) {
    if (this.running) {
      console.warn('Monkey process has already started. Not starting again.');
      return;
    }

    let monkeyCmd = `monkey -p ${package} -v -v -v -s 1000 --ignore-crashes --ignore-timeouts --ignore-security-exceptions --kill-process-after-error --pct-appswitch 20 --pct-touch 40 --pct-motion 10 --pct-trackball 0 --pct-anyevent 10 --pct-flip 0 --pct-pinchzoom 0 --throttle 1000 ${timeout}`;
    this.logPipe = this.adb.runShellCmd(monkeyCmd)
  }

  /**
   * Stops monkey process
   */
  stopMonkey() {
    this.running = false;
    console.debug('Stopping monkey.');

    if (this.logPipe) {
      if (this.logPipe.exitCode == null) {
        this.logPipe.kill();
      }
    }
  }
}

module.exports = Monkey;