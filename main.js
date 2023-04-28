const Adb = require('./adb')
const BatteryStats = require('./battery')
const Monkey = require('./monkey')
const { getDevices, startServer, killServer } = require('./util/devices');

const config = {
  package: 'com.yangcong345.cloud.pocket'
}

const main = async function () {
  killServer();
  startServer();

  const devices = await getDevices();
  console.log('devices: ', devices)
  devices.forEach( async (device) => {
    const adb = new Adb(device);

    setInterval(async() => {
      const battery = new BatteryStats(adb)
      battery.update();
      const data = battery.getBattery()
      console.log(`Battery: ${JSON.stringify(data)}`);
    }, 1000)

    const monkey = new Monkey(adb, config.package);
    monkey.start()

    const sn = await adb.getSN()
    console.log('sn:', sn)
  });
}

main()