const { spawn } = require('child_process');
const logger = require('./util/logger');
const fs = require('fs');

class Monkey {
  constructor(adb, pkg, timeout = 20000) {
    this.adb = adb;
    this.package = pkg;
    this.timeout = timeout;
    this.process = null;
    this.running = false;
    this.cleanup = this.cleanup.bind(this);
  }

  start(startTime) {
    this.startTime = startTime || new Date().getTime();

    if (this.running) {
      logger.info('Monkey process has already started. Not starting again.');
      return;
    }

    logger.debug('Starting monkey process.');
    this.running = true;
    this.startMonkey(this.timeout);
  }

  stop() {
    if (!this.running) {
      logger.debug('Monkey process is not running.');
      return;
    }

    logger.debug('Stopping monkey process.');
    this.stopMonkey();
  }

  async cleanup() {
    if (!this.running) {
      logger.debug('Monkey process is not running.');
      return;
    }

    logger.debug('Monkey process is running. Killing it.');
    this.process.kill();

    return new Promise(resolve => {
      const checkProcess = setInterval(() => {
        if (this.process.exitCode !== null) {
          clearInterval(checkProcess);
          this.running = false;
          this.saveLogToJson().then(() => {
            resolve();
          });
        }
      }, 1000);
    });
  }

  async runMonkey(timeout = 1000) {
    let monkeyCmd = `${this.adb} -s ${this.adb.getDeviceId()} shell monkey -p ${this.package} -v -v -v -s 1000 --ignore-crashes --ignore-timeouts --ignore-security-exceptions --kill-process-after-error --pct-appswitch 20 --pct-touch 40 --pct-motion 10 --pct-trackball 0 --pct-anyevent 10 --pct-flip 0 --pct-pinchzoom 0 --throttle 1000 ${timeout}`;

    const monkeyProcess = spawn(monkeyCmd, { stdio: 'pipe', shell: true });
    this.process = monkeyProcess;
    let log = '';

    for await (const data of monkeyProcess.stdout) {
      log += data;
    }

    return log;
  }

  async startMonkey(timeout) {
    try {
      const log = await this.runMonkey(timeout);
      logger.debug('Monkey process has exited.');
      console.log(log);
      this.saveLogToJson(log);
    } catch (err) {
      logger.error(`Failed to start monkey process: ${err}`);
    } finally {
      this.cleanup();
    }
  }

  async stopMonkey() {
    this.cleanup();
  }

  saveLogToJson(log) {
    console.log('saveLogToJson:', log)
  }
}

module.exports = Monkey;