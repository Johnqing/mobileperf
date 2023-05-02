const Adb = require('./adb')
const Battery = require('./battery')
const Monkey = require('./monkey')
const { getDevices, startServer, killServer } = require('./util/devices');
const TimeUtils = require('./util/TimeUtils');

const config = {
  package: 'com.yangcong345.yxsq.settings'
}

const main = async function () {
  killServer();
  startServer();

  const devices = await getDevices();
  console.log('getDevices: ', devices)

  for (const device of devices) {
    const adb = new Adb(device);

    const battery = new Battery(adb);
    const startBattery = await battery.getBattery();
    console.log(`Start battery level: ${startBattery.level}`);

    const monkey = new Monkey(adb, config.package);
    const startTime = Date.now();
    monkey.start();

    //定时记录电池能耗
    const batteryTimer = setInterval(async () => {
      const currentBattery = await battery.getBattery();
      const batteryUsage = startBattery.level - currentBattery.level;
      console.log(`Battery usage: ${batteryUsage}%`);
    }, 1000); // 时间单位为分钟

    //定时结束 
    await TimeUtils.tastTimer(async () => {
      monkey.stop();
      const endTime = Date.now();
      console.log(`Monkey runtime: ${(endTime - startTime) / 1000}s`);

      clearInterval(batteryTimer);

      const endBattery = await battery.getBattery();
      console.log(`End battery level: ${endBattery.level}`);

      const batteryUsage = startBattery.level - endBattery.level;
      console.log(`Battery usage: ${batteryUsage}%`);
    }, 2); // 时间单位为秒，这里设置时间为10秒
  }
}

main()