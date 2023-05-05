const { exec } = require('child_process');

const logger = require('./util/logger');

/**
 * @class Monkey
 * @classdesc Represents a Monkey test runner.
 */
class Monkey {
  /**
   * The logger instance for the Monkey class.
   * @type {Object}
   */
  logger = logger;

  /**
   * Initializes a new instance of the Monkey class.
   * @param {string} adb - The path to the ADB executable.
   * @param {string} devicesId - The ID of the target device.
   * @param {string} pkg - The package name of the target app.
   * @param {number} [timeout=20000] - The timeout for the Monkey test.
   */
  constructor(adb, devicesId, pkg, timeout = 20000) {
    /**
     * The path to the ADB executable.
     * @type {string}
     */
    this.adb = adb;
    /**
     * The ID of the target device.
     * @type {string}
     */
    this.devicesId = devicesId;
    /**
     * The package name of the target app.
     * @type {string}
     */
    this.package = pkg;
    /**
     * The timeout for the Monkey test.
     * @type {number}
     */
    this.timeout = timeout;
    /**
     * The child process for the Monkey test.
     * @type {?Object}
     */
    this.process = null;
    /**
     * The flag indicating whether the Monkey test is running.
     * @type {boolean}
     */
    this.running = false;
    /**
     * Binds the context of the cleanup method to the Monkey instance.
     */
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Starts the Monkey test.
   * @param {number} [startTime] - The start time of the Monkey test.
   */
  start(startTime) {
    this.startTime = startTime || new Date().getTime();

    if (this.running) {
      this.logger.info('Monkey process has already started. Not starting again.');
      return;
    }

    this.logger.debug('Starting monkey process.');
    this.running = true;
    this.startMonkey(this.timeout);
  }

  /**
   * Stops the Monkey test.
   */
  stop() {
    if (!this.running) {
      this.logger.debug('Monkey process is not running.');
      return;
    }

    this.logger.debug('Stopping monkey process.');
    this.stopMonkey();
  }

  /**
   * Cleans up the Monkey test process and saves the log as a JSON file.
   * @returns {Promise<string>} The log data as a string.
   */
  async cleanup() {
    if (!this.running) {
      this.logger.debug('Monkey process is not running.');
      return;
    }

    try {
      // Get the process information of the "monkey" process and kill it.
      const output = await this.exec(`${this.adb} -s ${this.devicesId} shell ps -elf | grep monkey`);
      const outputArr = output.trim().split(/\s+/);
      this.logger.debug('output.', outputArr);

      const pid = outputArr[1];
      this.logger.debug('Monkey process is running. Killing it.', pid);

      await this.exec(`${this.adb} -s ${this.devicesId} shell kill -9 ${pid}`);
    } catch (err) {
      this.logger.error('Failed to kill process:', err);
    }

    // Wait for the process to exit and save the log data as a JSON file.
    const log = await this.saveLogToJson();
    this.running = false;
    return log;
  }

  /**
   * Runs the Monkey test for a specified duration.
   * @param {number} [timeout=1000] - The duration of the Monkey test in milliseconds.
   * @returns {Promise<string>} The log data as a string.
   */
  async runMonkey(timeout = 1000) {
    // Construct the command string to run the monkey command, including the app package name and other options.
    let monkeyCmd = `${this.adb} -s ${this.devicesId} shell monkey -p ${this.package} -v -v -v -s 1000 --ignore-crashes --ignore-timeouts --ignore-security-exceptions --kill-process-after-error --pct-appswitch 20 --pct-touch 40 --pct-motion 10 --pct-trackball 0 --pct-anyevent 10 --pct-flip 0 --pct-pinchzoom 0 --throttle 1000 ${timeout}`;
    if (!this.package) {
      monkeyCmd = `${this.adb} -s ${this.devicesId} shell monkey -v -v -v -s 1000 --ignore-crashes --ignore-timeouts --ignore-security-exceptions --kill-process-after-error --pct-appswitch 20 --pct-touch 40 --pct-motion 10 --pct-trackball 0 --pct-anyevent 10 --pct-flip 0 --pct-pinchzoom 0 --throttle 1000 ${timeout}`;
    }
    this.logger.debug(`Running command:  ${monkeyCmd}`);

    // Start the monkey command and capture the output to a string.
    const monkeyProcess = exec(monkeyCmd);
    this.process = monkeyProcess;
    let log = '';
    for await (const data of monkeyProcess.stdout) {
      log += data;
    }
    return log;
  }

  /**
   * Starts the Monkey test and handles the cleanup process.
   * @param {number} timeout - The duration of the Monkey test in milliseconds.
   */
  async startMonkey(timeout) {
    try {
      // Start the monkey command and wait for the process to exit.
      const log = await this.runMonkey(timeout);
      this.logger.debug('Monkey process has exited.');
      console.log(log);
    } catch (err) {
      this.logger.error(`Failed to start monkey process: ${err}`);
   } finally {
      // Clean up the process and save the log data.
      const log = await this.cleanup();
      await this.saveLogToJson(log);
    }
  }

  /**
   * Stops the Monkey test and handles the cleanup process.
   */
  async stopMonkey() {
    // Call the cleanup method to clean up the process and save the log data.
    this.cleanup();
  }

  /**
   * Saves the log data as a JSON file.
   * @param {string} [log] - The log data as a string.
   * @returns {Promise<string>} The log data as a string.
   */
  async saveLogToJson(log) {
    // Save the log data to a JSON file and return a Promise object.
    // console.log('saveLogToJson:', log);
    return log;
  }

  /**
   * Executes a command and returns the output as a Promise object.
   * @param {string} cmd - The command to execute.
   * @returns {Promise<string>} The output of the command as a string.
   */
  async exec(cmd) {
    // Wrap the exec method in a Promise object to support async/await syntax.
    return new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}

module.exports = Monkey;