// 导入所需模块
const Adb = require('./adb');
const Battery = require('./battery');
const Monkey = require('./monkey');
const Top = require('./top');
const { getDevices, startServer, killServer } = require('./util/devices');
const TimeUtils = require('./util/TimeUtils');

// 定义测试配置项
const config = {
  package: 'com.yangcong345.yxsq.settings',
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
    const monkey = new Monkey(adb.getAdb(), device, config.package);
    const startTime = Date.now();
    monkey.start();

    // 启动 top 监控
    const top = new Top(adb.getAdb(), device, config.package);
    top.start();

    // 定时结束测试任务
    await TimeUtils.tastTimer(async () => {
      // monkey 需要优先结束。保证数据是 monkey 过程的中的
      monkey.stop();
      const endTime = Date.now();
      console.log(`Monkey runtime on ${device}: ${(endTime - startTime) / 1000}s`);

      battery.stop();

      top.stop();
      
      killServer();
    }, 10000); // 时间单位为毫秒，这里设置时间为10秒
  });

  // 等待所有测试任务完成
  await Promise.all(testTasks);
};

// 运行测试任务
runTests();