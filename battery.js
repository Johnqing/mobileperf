

const regex = {
  level: /level:\s*(\d+)/,
  temperature: /temperature:\s?(\d+)/,
  current: /current now:\s?(\d+)/,
  voltage: /(?:^|\W)voltage:\s*(\d+)/i,
};

class BatteryInfo {
  constructor(adb) {
    this.adb = adb;
    this.data = {
      level: 0,
      temperature: 0,
      current: 0,
      voltage: 0,
      current_flag: -1,
    };
  }

  getPowerInfoDic(out) {
    if (!out) {
      return this.data;
    }

    const outArr = out.split(/\r|\n/);
    outArr.shift();
    
    for (let index = 0; index < outArr.length; index++) {
      const el = outArr[index].replace(/\s+/, '');
      const elArr = el.split(':')
      const key = elArr[0];
      this.data[key] = elArr[1]
    }
  
    if (this.data.current > 0) {
      this.data.current_flag = 1;
    } else {
      this.data.current = 0;
    }
  
    return this.data;
  }

  async update() {
      const stdout = await this.adb.runShellCmd(`dumpsys battery`)

    return this.getPowerInfoDic(stdout)
  }


  getBattery() {
    return this.data;
  }
}

module.exports = BatteryInfo