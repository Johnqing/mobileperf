class Battery {
  /**
   * 构造函数
   * @param {Adb} adb Adb对象
   * @param {number} [interval=1000] 定时器时间间隔（毫秒）
   */
  constructor(adb, interval = 1000) {
    this.adb = adb;
    this.interval = interval;
  }

  /**
   * 启动电池信息定时记录
   */
  start() {
    this.getBattery();
    // 定时记录电池能耗
    this.batteryTimer = setInterval(async () => {
      const currentBattery = await this.getBattery();
      const batteryUsage = this.startBattery.level - currentBattery.level;
      console.log(`Battery usage: ${batteryUsage}%`);
    }, this.interval);
  }

  /**
   * 停止电池信息定时记录
   */
  stop() {
    clearInterval(this.batteryTimer);
  }

  /**
   * 获取电池信息
   * @returns {Promise<Object>} 电池信息对象
   */
  async getBattery() {
    const output = await this.adb.runShellCmd('dumpsys battery');
    return this.parseBatteryInfo(output);
  }

  /**
   * 解析电池信息输出
   * @param {string} output 电池信息输出
   * @returns {Object} 电池信息对象
   */
  parseBatteryInfo(output) {
    const batteryInfo = {};

    if (!output) {
      return batteryInfo;
    }

    const lines = output.split(/\r|\n/).slice(1);
    batteryInfo = lines.reduce((info, line) => {
      const [key, value] = this.parseLine(line);
      info[key] = value;
      return info;
    }, {});

    // 根据电流符号判断电流方向，并将电流值转换成正整数
    batteryInfo.current_flag = batteryInfo.current > 0 ? 1 : -1;
    batteryInfo.current = Math.abs(batteryInfo.current);

    return batteryInfo;
  }

  /**
   * 解析电池信息输出的每一行
   * @param {string} line 电池信息输出的每一行
   * @returns {[string, number]} 包含键和值的数组
   */
  parseLine(line) {
    const [key, value] = line.replace(/\s+/g, '').split(':');
    return [key, parseFloat(value)];
  }
}

module.exports = Battery;