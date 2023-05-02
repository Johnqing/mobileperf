const { spawn } = require('child_process');
const logger = require('./util/logger');

class Monkey {
  /**
   * Monkey executor
   * @param {Adb} adb - Adb object
   * @param {string} pkg - Package name to test with monkey
   * @param {number} timeout - Monkey duration in minutes, default is infinite
   */
  constructor(adb, pkg, timeout = 20000) {
    this.adb = adb;
    this.package = pkg;
    this.timeout = timeout;
    this.process = null;
    this.running = false;
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Starts monkey
   * @param {Date} startTime - Start time of monkey
   */
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

  /**
   * Stops monkey
   */
  stop() {
    if (!this.running) {
      logger.debug('Monkey process is not running.');
      return;
    }

    logger.debug('Stopping monkey process.');
    this.stopMonkey();
  }

  /**
   * Cleanup function to be called on Monkey exit or shutdown
   */
  cleanup() {
    if (!this.running) {
      logger.debug('Monkey process is not running.');
      return;
    }

    logger.debug('Monkey process is running. Killing it.');
    this.process.kill();
    this.running = false;
  }

  runMonkey(timeout = 1000) {
    let monkeyCmd = `${this.adb.getAdb()} -s ${this.adb.getDeviceId()} shell monkey -p ${this.package} -v -v -v -s 1000 --ignore-crashes --ignore-timeouts --ignore-security-exceptions --kill-process-after-error --pct-appswitch 20 --pct-touch 40 --pct-motion 10 --pct-trackball 0 --pct-anyevent 10 --pct-flip 0 --pct-pinchzoom 0 --throttle 1000 ${timeout}`;

    return new Promise((resolve, reject) => {
      // 启动子进程
      const monkeyProcess = spawn(monkeyCmd, { stdio: 'pipe', shell: true });
      this.process = monkeyProcess;

      // 定义日志变量
      let log = '';

      // 监听子进程输出
      monkeyProcess.stdout.on('data', (data) => {
        log += data;
      });

      monkeyProcess.stderr.on('data', (data) => {
        logger.error(`stderr: ${data}`);
      });

      // 监听子进程退出
      monkeyProcess.once('exit', (code, signal) => {
        logger.debug(`Monkey process exited with code: ${code}, signal: ${signal}.`);
        resolve(log);
      });
    });
  }

  /**
   * Starts monkey process
   * @param {number} timeout - Monkey duration in minutes
   */
  async startMonkey(timeout) {
    this.runMonkey(timeout).then((log) => {
      logger.debug('Monkey process has exited.');
      console.log(log);
    }).catch((err) => {
      logger.error(`Failed to start monkey process: ${err}`);
    }).finally(() => {
      this.cleanup();
    });
  }

  /**
   * Stops monkey process
   */
  async stopMonkey() {
    this.cleanup();
  }
}

module.exports = Monkey;