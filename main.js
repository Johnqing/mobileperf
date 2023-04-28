const Adb = require('./adb')
const BatteryStats = require('./battery')
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
      const batteryPromise = await adb.runShellCmd(`dumpsys battery`)
      const battery = new BatteryStats(batteryPromise)
      battery.update();
      const data = battery.getBattery()
      console.log(`Battery: ${JSON.stringify(data)}`);
    }, 1000)

    const sn = await adb.getSN()
    console.log('sn:', sn)
  });
}

main()