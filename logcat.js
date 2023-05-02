const { spawn } = require('child_process');

// 设置 logcat 命令参数
const LOGCAT_ARGS = ['-v', 'time'];

// 定义 logcat 输出解析正则表达式
const logcatRegex = /^(\d+-\d+\s+\d+:\d+:\d+\.\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([VDIWEFS])\/(.+?):\s+(.*)$/;

class LogcatReader {
  constructor(adb, filter = null) {
    this.adb = adb;
    this.filter = filter;
    this.logcatProcess = null;
  }

  // 启动 logcat 进程
  start() {
    const args = [...LOGCAT_ARGS];
    if (this.filter) {
      args.push(this.filter);
    }
    this.logcatProcess = spawn(this.adb, ['logcat', ...args]);

    // 监听 logcat 输出
    this.logcatProcess.stdout.on('data', data => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const match = line.match(logcatRegex);
        if (match) {
          const [, time, pid, tid, level, tag, message] = match;
          console.log(`[${time}] [${level}/${tag}] ${message}`);
        }
      }
    });

    // 监听 logcat 进程的错误输出
    this.logcatProcess.stderr.on('data', data => {
      console.error(data.toString());
    });
  }

  // 停止 logcat 进程
  stop() {
    this.logcatProcess.kill();
  }
}

// 创建一个 Adb 类，用于执行 adb 命令
class Adb {
  constructor(deviceId = '') {
    this.deviceId = deviceId;
  }

  // 获取 adb 命令的完整路径，并加上设备 ID 参数
  getAdb() {
    return `adb${this.deviceId ? ` -s ${this.deviceId}` : ''}`;
  }
}

module.exports = LogcatReader