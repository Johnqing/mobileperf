const util = require('util');
const exec = util.promisify(require('child_process').exec);

class Fps {
  constructor() {
    this.fps = 0;
    this.frames = 0;
    this.lastTime = 0;
    this.totalTime = 0;
  }

  async getFps() {
    let cmd = 'adb shell dumpsys SurfaceFlinger --latency-clear && sleep 1 && adb shell dumpsys SurfaceFlinger --latency';
    let { stdout, stderr } = await exec(cmd);

    if (stderr) {
      throw new Error(stderr);
    }

    let lines = stdout.split('\n');
    let count = 0;
    let interval = 0;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (/^\d+\s+\d+/.test(line)) {
        count++;
        let parts = line.split(/\s+/);
        let presentTime = parseInt(parts[0]);
        let receivedTime = parseInt(parts[1]);
        let deltaTime = presentTime - receivedTime;

        if (deltaTime > interval) {
          interval = deltaTime;
        }
      }
    }

    if (count > 0) {
      this.frames = count;
      this.totalTime = interval * count;
      this.fps = Math.round(count / (this.totalTime / 1000));
    }

    return this.fps;
  }

  async printFps(interval) {
    interval = interval || 1000;

    while (true) {
      let fps = await this.getFps();
      console.log(`FPS: ${fps}`);

      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

let fps = new Fps();
fps.printFps();