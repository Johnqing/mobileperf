const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function executeAdbCommand(device, command) {
  const adbCmd = `adb -s ${device} ${command}`;
  const { stdout, stderr } = await exec(adbCmd);
  if (stderr) {
    console.error(`Error executing command: ${stderr}`);
    return;
  }
  console.log(`Output for device ${device}:`);
  console.log(stdout.trim());
}

async function main() {
  const devices = ['192.168.0.101:5555', '192.168.0.102:5555'];
  const adbTcpCommand = 'tcpip 5555';
  const adbConnectCommand = (device) => `connect ${device}`;

  for (let device of devices) {
    await executeAdbCommand(device, adbTcpCommand);
    await executeAdbCommand(device, adbConnectCommand(device));
  }

  // 执行其他 adb 命令
  await executeAdbCommand(devices[0], 'shell ls');
  await executeAdbCommand(devices[1], 'shell ps');
}

main();