// 导入所需模块
const Adb = require('./adb');
const Battery = require('./battery');
const Monkey = require('./monkey');
const Top = require('./topRunner');
const FPSMonitor = require('./fps');
const { getDevices, startServer, killServer } = require('./util/devices');
const TimeUtils = require('./util/TimeUtils');

// 定义测试配置项
const config = {
  package: 'com.yangcong345.cloud.pocket',
};

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

    // 启动电池电量监控
    const battery = new Battery(adb);
    battery.start();

    // 启动 Monkey 测试
    // const monkey = new Monkey(adb.getAdb(), adb.getDeviceId(), config.package);
    const monkey = new Monkey(adb.getAdb(), adb.getDeviceId());
    const startTime = Date.now();
    monkey.start();

    // 启动 top 监控
    const top = new Top(adb.getAdb(), adb.getDeviceId(), config.package, adb.getSdkVersion());
    top.start();

    const fpsMonitor = new FPSMonitor(adb.getAdb(), adb.getDeviceId(), config.package, adb.getSdkVersion())
    fpsMonitor.start()

    // 定时结束测试任务
    await TimeUtils.tastTimer(async () => {
      battery.stop();
      top.stop();
      fpsMonitor.stop();

      monkey.stop();
      const endTime = Date.now();
      console.log(`Monkey runtime on ${device}: ${(endTime - startTime) / 1000}s`);
    }, 60 * 3); // 时间单位为分钟
  });

  // 等待所有测试任务完成
  await Promise.all(testTasks);
};

// 运行测试任务
runTests();