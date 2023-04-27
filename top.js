const { exec } = require('child_process');

function parseOutput(output) {
  const lines = output.trim().split('\n');
  const header = lines.shift().split(/\s+/);
  const processes = [];

  lines.forEach((line) => {
    const cols = line.trim().split(/\s+/);
    const process = {};
    cols.forEach((col, i) => {
      process[header[i]] = col;
    });
    processes.push(process);
  });

  return processes;
}

function getTopProcesses(deviceId, numProcesses) {
  return new Promise((resolve, reject) => {
    const cmd = `adb -s ${deviceId} shell top -n 1 -m ${numProcesses} -d 1 -t`;
    exec(cmd, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      const processes = parseOutput(stdout);
      resolve(processes);
    });
  });
}

const deviceId = 'your-device-id'; // 设备 ID
const numProcesses = 10; // 要获取的进程数
getTopProcesses(deviceId, numProcesses)
  .then((processes) => {
    console.log(processes);
  })
  .catch((err) => {
    console.error(err);
  });