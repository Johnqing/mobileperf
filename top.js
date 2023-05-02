const { spawn } = require('child_process');

const TOP_ARGS = ['top', '-b'];

const topRegex = /^\s*(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/;

class RealTimeTopCommandRunner {
    /**
     * 
     * @param {Adb} adb Adb对象
     * @param {String} devicesId  切换到那个 deviceId
     * @param {String} packageName 特定 app 的包名
     * @param {number} [interval=1000] 定时器时间间隔（毫秒）
     */
    constructor(adb, devicesId, packageName = null, interval = 1000) {
        this.adb = adb;
        this.devicesId = devicesId;
        this.packageName = packageName;
        this.interval = interval;
        this.output = [];
        this.appTop = null;
        this.systemCpuTop = null;
        this.systemMemTop = null;
        this.processTops = [];
        this.topProcess = null;
        this.timer = null;
    }

    async start() {
        TOP_ARGS.unshift('-s')
        TOP_ARGS.unshift(this.devicesId)
        // 启动 top 进程并设置 stdout 和 stderr 流
        this.topProcess = spawn(this.adb, TOP_ARGS);
        this.topProcess.stdout.on('data', data => {
            this.output.push(data);

            // 解析 top 输出并找到与特定应用程序相关的行和系统的 top 信息
            const lines = data.toString().split('\n');
            const appLine = this.packageName ? this.findAppLine(lines, this.packageName) : null;
            if (appLine) {
                this.appTop = this.parseTopLine(appLine);
            }

            const systemCpuLine = lines.find(line => line.startsWith('%Cpu(s):')); // 查找包含 CPU 使用率的行
            if (systemCpuLine) {
                this.systemCpuTop = this.parseCpuTopLine(systemCpuLine);
            }

            const systemMemLine = lines.find(line => line.startsWith('KiB Mem :')); // 查找包含内存使用量的行
            if (systemMemLine) {
                this.systemMemTop = this.parseMemTopLine(systemMemLine);
            }

            const processLines = lines.slice(7); // 忽略前 7 行
            this.processTops = processLines.map(line => this.parseTopLine(line)).filter(top => top !== null);

            // 将 top 数据写入文件
            const topData = {
                appTop: this.appTop,
                systemCpuTop: this.systemCpuTop,
                systemMemTop: this.systemMemTop,
                processTops: this.processTops,
            };
            console.log('topData: ', topData)
        });
        this.topProcess.stderr.on('data', data => {
            console.error(data.toString());
        });

        // 设置定时器以在每个间隔中获取 top 数据
        this.timer = setInterval(() => {
            this.topProcess.stdin.write('q\n'); // 发送 q 命令以退出 top
            this.topProcess.stdin.write('\n'); // 发送空格以确认退出
            this.topProcess.stdin.write(TOP_ARGS.join(' ') + '\n'); // 发送 top 命令以重新启动
        }, this.interval);
    }

    stop() {
        // 停止定时器和 top 进程
        clearInterval(this.timer);
        this.topProcess.stdin.write('q\n');
        this.topProcess.stdin.write('\n');
        this.topProcess.kill();
    }

    findAppLine(lines, packageName) {
        return lines.find(line => line.includes(packageName));
    }

    parseTopLine(line) {
        const match = line.match(topRegex);
        if (!match) return null;

        const [pid, user, pr, ni, virt, res, shr, s, cpu, mem, time, command] = match.slice(1);
        return {
            pid,
            user,
            pr,
            ni,
            virt,
            res,
            shr,
            s,
            cpu,
            mem,
            time,
            command,
        };
    }

    parseCpuTopLine(line) {
        const [_, cpuUsage] = line.split(':');
        return cpuUsage.trim();
    }

    parseMemTopLine(line) {
        const [_, memUsage] = line.split(':');
        return memUsage.trim();
    }
}

module.exports = RealTimeTopCommandRunner