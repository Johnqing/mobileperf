const { spawn, exec } = require('child_process');
const log = require('./log')

const TOP = 'top -b -n 1 -d'

class RealTimeTopCommandRunner {
  constructor(adb, deviceId, packageName = null, sdkversion, interval = 1000){
    this.adb = adb;
    this.deviceId = deviceId;
    this.packageName = packageName;
    this.sdkversion = sdkversion;
    this.interval = interval;
    this.topCmd = `${this.adb} -s ${this.deviceId} shell ${TOP} ${interval}`;
    this.maxFreqCmd = `${this.adb} -s ${this.deviceId} shell "cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq"`;
    this.outputFilePath = './cpu_info.json';
    this.timer = null;
  }

  async start() {
    this.timer = setInterval(async () => {
      const cpuList = await this.collectPackageCpuThread();
      const maxFreq = await this.getMaxFreq();
      const cpuInfo = {
        datetime: new Date().toISOString(),
        cpuList,
        maxFreq
      };
      this.saveToJson(cpuInfo);
    }, this.interval);
  }

  async stop() {
    clearInterval(this.timer)
  }

  async topCpuinfo(packages) {
    return new Promise((resolve, reject) => {
      exec(this.topCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`into cpuinfos error: ${error}`);
          reject(error);
        } else {
          const outStr = stdout;
          const pckCpuinfo = new PckCpuinfo(packages, outStr, this.sdkversion);
          const data = pckCpuinfo.getData();
          resolve(data);
        }
      });
    });
  }

  async collectPackageCpuThread() {
    const packages = [this.packageName];
    const cpu_title = ['datetime', 'device_cpu_rate%', 'user%', 'system%', 'idle%'];
    for (let i = 0; i < packages.length; i++) {
      cpu_title.push('package', 'pid', 'pid_cpu%');
    }
    if (packages.length > 1) {
      cpu_title.push('total_pid_cpu%');
    }
    const cpu_info = await this.topCpuinfo(packages);

    const cpu_list = [
      new Date().toISOString(),
       cpu_info.device_cpu_rate.toString(),
       cpu_info.user_rate.toString(),
       cpu_info.system_rate.toString(),
       cpu_info.idle_rate.toString(),
     ];
     for (let i = 0; i < packages.length; i++) {
       if (cpu_info.package_list.length === packages.length) {
         cpu_list.push(
           cpu_info.package_list[i].package,
           cpu_info.package_list[i].pid.toString(),
           cpu_info.package_list[i].pid_cpu.toString()
         );
       }
     }
     if (packages.length > 1) {
       cpu_list.push(cpu_info.total_pid_cpu.toString());
     }
     console.log(cpu_title, cpu_list);
     return cpu_list;
  }

  async getMaxFreq() {
    return new Promise((resolve, reject) => {
      exec(this.maxFreqCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`getMaxFreq error: ${error}`);
          reject(error);
        } else {
          const maxFreq = stdout.trim();
          console.log('getMaxFreq:', maxFreq);
          resolve(maxFreq);
        }
      });
    });
  }

  saveToJson(data) {
    log.addOrUpdateJsonField('top', data)
  }
}

class PckCpuinfo {
  constructor(packages, source, sdkversion) {
      this.source = source;
      this.sdkversion = sdkversion;
      this.datetime = '';
      this.packages = packages;
      this.pid = 0;
      this.uid = '';
      this.pck_cpu_rate = '';
      this.pck_pyc = '';
      this.uid_cpu_rate = '';
      this.package_list = [];
      this.device_cpu_rate = '';
      this.system_rate = '';
      this.user_rate = '';
      this.nice_rate = '';
      this.idle_rate = '';
      this.iow_rate = '';
      this.irq_rate = '';
      this.total_pid_cpu = 0;
      this._parse_cpu_usage();
      this._parse_package();
  }

  getData() {
    return {
      source: this.source,
      sdkversion: this.sdkversion,
      datetime: this.datetime,
      packages: this.packages,
      pid: this.pid,
      uid: this.uid,
      pck_cpu_rate: this.pck_cpu_rate,
      pck_pyc: this.pck_pyc,
      uid_cpu_rate: this.uid_cpu_rate,
      package_list: this.package_list,
      device_cpu_rate: this.device_cpu_rate,
      system_rate: this.system_rate,
      user_rate: this.user_rate,
      nice_rate: this.nice_rate,
      idle_rate: this.idle_rate,
      iow_rate: this.iow_rate,
      irq_rate: this.irq_rate,
      total_pid_cpu: this.total_pid_cpu
    };
    
  }

  _parse_package() {
      if (!this.packages || this.packages.length === 0) {
          console.error("No process name input, please input.");
          return;
      }

      for (const pkg of this.packages) {
          const package_dic = {
              package: pkg,
              pid: "",
              pid_cpu: ""
          };
          const sp_lines = this.source.split('\n');
          for (const line of sp_lines) {
              if (line.includes(pkg)) {
                  const tmp = line.split(/\s+/);
                  this.pid = tmp[1];
                  const target_pck = tmp[tmp.length - 1];
                  this.datetime = new Date().toISOString();
                  console.debug(`cpuinfos, _parse top target_pck is : ${target_pck}, self.pacakgename : ${pkg}`);
                  if (pkg === target_pck) {
                      if (parseInt(this.pid) > 0) {
                          console.debug(`cpuinfos, into _parse_pck packege is target package, pid is : ${this.pid}`);
                          const cpu_index = this.get_cpucol_index();
                          const uid_index = this.get_uidcol_index();
                          if (tmp.length > cpu_index) {
                              this.pck_cpu_rate = tmp[cpu_index];
                              this.pck_cpu_rate = this.pck_cpu_rate.replace("%", "");
                          }

                          if (tmp.length > uid_index) {
                              this.uid = tmp[uid_index];
                          }
                          package_dic.package = pkg;
                          package_dic.pid = this.pid;
                          package_dic.pid_cpu = this.pck_cpu_rate;
                          package_dic.uid = this.uid;
                          this.total_pid_cpu += parseFloat(this.pck_cpu_rate);
                          console.debug(`uid: ${this.uid}, package: ${pkg}, cpu_rate: ${this.pck_cpu_rate}, total_pid_cpu: ${this.total_pid_cpu}`);
                      }
                      break;
                  }
              }
          }
          this.package_list.push(package_dic);
      }
  }

  get_cpucol_index() {
      return 3;
  }

  get_uidcol_index() {
      return 4;
  }

  _parse_cpu_usage() {
    const sp_lines = this.source.split('\n');
    for (const line of sp_lines) {
      if (line.includes("user") && line.includes("sys")) {
        const tmp = line.split(/\s+/);
        this.system_rate = this._getRateValue(tmp, "sys");
        this.user_rate = this._getRateValue(tmp, "user");
        this.iow_rate = this._getRateValue(tmp, "iow");
        this.irq_rate = this._getRateValue(tmp, "irq");
        this.idle_rate = this._getRateValue(tmp, "idle");
        this.nice_rate = this._getRateValue(tmp, "nice");
        break;
      }
    }
    const device_cpu_rate = parseFloat(this.user_rate || 0) + parseFloat(this.system_rate || 0) + parseFloat(this.nice_rate || 0);
    this.device_cpu_rate = device_cpu_rate.toFixed(2);
  }

  _getRateValue(tmp, target) {
    const item = tmp.find((str) => str.includes(target));
    if (item) {
      const rate = item.match(/\d+/);
      return rate ? rate[0] : "";
    }
    return "";
  }
  
  toString() {
      return JSON.stringify(this);
  }
}

module.exports = RealTimeTopCommandRunner;