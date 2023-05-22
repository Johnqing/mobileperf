const { exec } = require('child_process');

// 导入所需模块
const Adb = require('./adb');
const { getDevices, startServer, killServer } = require('./util/devices');

// 定义测试任务主函数
const runTests = async function () {
  // 终止并重启 ADB 服务
  killServer();
  startServer();

  // 获取连接的设备列表
  const devices = await getDevices();
  console.log('Connected devices:', devices);

  // 为每个设备创建一个测试任务
  const testTasks = devices.map(async (device) => {
    const adb = new Adb(device);
    const devicesId = adb.getDeviceId()

    exec(`${adb} -s ${devicesId} shell am start -n com.debug.loggerui/.MainActivity`);
  });

  // 等待所有测试任务完成
  await Promise.all(testTasks);
};

// 运行测试任务
runTests();