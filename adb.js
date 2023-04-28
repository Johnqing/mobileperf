const fs = require('fs');
const os = require('os');
const {exec, execSync, spawn } = require('child_process')

const TimeUtils = require('./util/TimeUtils');
const logger = require('./util/logger');
const { getDevices, startServer, killServer} = require('./util/devices');
const { resolve } = require('path');
/**
 * execPromise执行命令
 * @returns 
 */
function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

const adbPath = `adb`

class Adb{
  constructor(deviceId){
    this.deviceId = deviceId
  }
  /**
   * 判断当前连接状态是否正常
   * @param {*} deviceId 
   * @returns 
   */
  isConnect(deviceId) {
    const devices = getDevices();

    return devices.indexOf(deviceId) !== -1
  }
  /**
   * 替换deviceId
   * @param {*} deviceId 
   */
  setDeviceId(deviceId){
    this.deviceId = deviceId;
  }
  
  /**
   * 如果出现断开重启
   * @returns 
   */
  recover() {
    if (this.checkAdbNormal()) {
      logger.log('adb is normal');
      return;
    } else {
        logger.error('adb is not normal');
        killServer();
        startServer();
      }
  }
  /**
   * 判断系统
   * @returns osPlatform
   */
  getOSName() {
    return os.platform();
  }
  /**
   * 判断是否异常
   * @returns 
   */
  checkAdbNormal() {
    const adbRet = execSync('adb devices').toString();
    logger.log(`adb device ret: ${adbRet}`);

    if (!adbRet) {
      logger.log('devices list maybe is empty');
      return true;
    } else {
      if (adbRet.includes('daemon not running.')) {
        logger.warn('daemon not running.');
        return false;
      } else if (adbRet.includes("ADB server didn't ACK")) {
        logger.warn('error: ADB server did not ACK, kill occupy 5037 port process');
        return false;
      } else {
        return true;
      }
    }
  }
  async runCmdOnce(cmd) {
    // 根据是否指定设备 ID 构造命令参数数组
    const cmdArgs = this.deviceId ? ['-s', this.deviceId, cmd] : [cmd];
    const command = `${adbPath} ${cmdArgs.join(' ')}`
    logger.debug('runCmdOnce:', command);

    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else if (stderr) {
          reject(new Error(stderr));
        } else {
          resolve(stdout);
        }
      });
    });
  }
  /**
   * 封装执行 adb 命令的函数，支持最多重试3次
   * @param {string} cmd - adb 命令字符串
   * @param {...string} argv - 命令参数
   * @param {...string} options - 命令参数
   * @returns {Promise<string>} - 命令执行结果的 Promise 对象
   */
  async runAdbCmdWithRetry(cmd, ...argv) {
    let retryCount = 3; // 最多重试3次
    while (retryCount > 0) {
      try {
        // 尝试执行 adb 命令
        const output = await this.runCmdOnce(cmd, ...argv);
        return output;
      } catch (error) {
        console.log(error)
        logger.error(`adb 命令执行失败：${error.message} ${this.deviceId}`);
        retryCount--;
        if (retryCount === 0) {
          throw error;
        }
      }
    }
  }

  /**
   * 执行 adb shell 命令
   * @param {string} cmd - 要执行的命令字符串
   * @param {Object} [options] - 可选参数对象
   * @param {boolean} [options.sync] - 是否同步执行命令（默认为 true）
   * @returns {Promise<string|undefined>} - 命令执行结果的 Promise 对象
   */
  async runShellCmd(cmd, options = { sync: true }) {
    if (options.sync === undefined) options.sync = true;
    // 如果失去连接后，adb 又正常连接了
    if (!this.beforeConnect && this.afterConnect) {
      const cpuUptimeFile = path.join(RuntimeData.packageSavePath, 'uptime.txt');
      const cpuUptimeCmd = 'shell cat /proc/uptime';

      return this.runAdbCmdWithRetry(cpuUptimeCmd).then(output => {
        const currentTime = TimeUtils.getCurrentTimeUnderline();
        const cpuUptimeLine = `${currentTime} /proc/uptime:${output}\n`;
        return fs.promises.appendFile(cpuUptimeFile, cpuUptimeLine, { encoding: 'utf-8' });
      }).then(() => {
        this.beforeConnect = true;
        return this.runAdbCmdWithRetry(`shell ${cmd}`, options);
      });
    }
    return this.runAdbCmdWithRetry(`shell ${cmd}`, options);
  }

  clearData(packageName) {
    /*清除指定包的 用户数据*/
    return this.runShellCmd(`pm clear ${packageName}`);
  }

  stopPackage(packageName) {
    /*杀死指定包的进程*/
    return this.runShellCmd(`am force-stop ${packageName}`);
  }

  input(string) {
    return this.runShellCmd(`input text ${string}`);
  }

  ping(address, count) {
    return this.runShellCmd(`shell ping -c ${count} ${address}`);
  }

  getSystemVersion() {
    if (!this.systemVersion) {
      this.systemVersion = this.runShellCmd('getprop ro.build.version.release');
    }
    return this.systemVersion;
  }

  getSN() {
    const uuid = this.runShellCmd('getprop ro.boot.serialno');
    return uuid || '';
  }

  getGenieWifi() {
    const wifiMac = this.runShellCmd('cat /sys/class/net/wlan0/address');
    return wifiMac || '';
  }
  /*获取应用版本信息*/
  getPackageVer(pkg) {
    const packageVer = this.runShellCmd(`dumpsys package ${pkg}`);
    return packageVer || '';
  }

  getSdkVersion() {
    /*获取SDK版本，如：16*/
    if (!this.sdkVersion) {
      this.sdkVersion = parseInt(this.runShellCmd('getprop ro.build.version.sdk'));
    }
    return this.sdkVersion;
  }

  getPhoneBrand() {
    if (!this.phoneBrand) {
      this.phoneBrand = this.runShellCmd('getprop ro.product.brand');
    }
    return this.phoneBrand;
  }

  getPhoneModel() {
    if (!this.phoneModel) {
      this.phoneModel = this.runShellCmd('getprop ro.product.model');
    }
    return this.phoneModel;
  }

  getScreenSize() {
    return this.runShellCmd('getprop ro.product.screensize');
  }

  getWmSize() {
    return this.runShellCmd('wm size');
  }
}


module.exports = Adb