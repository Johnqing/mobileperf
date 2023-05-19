const { exec } = require('child_process');
const log = require('./log')

class FPSMonitor {
    constructor(adb, deviceId, packageName = null, sdkversion, interval = 1000) {
      this.adb = adb;
      this.deviceId = deviceId;
      this.packageName = packageName;
      this.sdkversion = sdkversion;
      this.interval = interval;
      this.lastTimestamp = 0;
      this.dataQueue = []
      // 收集surfaceflinger数据,用了两种方式:use_legacy_method 为ture时，需要root权限:service call SurfaceFlinger 1013 得到帧数。为false,dumpsys SurfaceFlinger --latency  
      this.useLegacyMethod = false;
      this.timer = null;
    }

    async start(){
      this.timer = setInterval(async() => {
        await this.collector()
        await this.calculator()
      }, this.interval)
    }
    stop(){
      clearInterval(this.timer)
    }
    // 处理surfaceflinger数据
    async calculator() {
      const data = this.dataQueue[0] || [];
      console.log('cal-queue:', this.dataQueue, data)
      if(!data.length){
        return
      }

      const refreshPeriod = data[0];
      const timestamps = data[1];
      const collectTime = data[2];
      console.log('cal:', refreshPeriod, timestamps, collectTime)

      const result = await this.calculateResults(refreshPeriod, timestamps);
      const [fps, jank] = result;
      console.debug(`FPS:${fps} Jank:${jank}`);
      const fpsList = [collectTime, this.focusWindow, fps, jank];

      log.addOrUpdateJsonField('fps', {
        collectTime, focusWindow: this.focusWindow, fps, jank
      })
      this.dataQueue.shift()
    }

    /**
     * 计算 FPS 和 Jank
     * @param {number} refreshPeriod - 刷新周期，单位为毫秒
     * @param {Array<{frameNumber: number, timeStamp: number, refreshPeriod: number}>} timestamps - 时间戳数组，每个元素包括帧号、时间戳（单位为毫秒）和刷新周期（单位为纳秒）
     * @returns {Array<number>} [fps, jank] - FPS 和 Jank
     */
    calculateResults(refreshPeriod, timestamps) {
      const frameCount = timestamps.length;
      if (frameCount === 0) {
        return [0, 0];
      }
      let fps, jank;
      const lastTimestamp = timestamps[frameCount - 1][1];
      const timeDelta = lastTimestamp - timestamps[0][1];
      console.log('calculateResults---', frameCount, lastTimestamp, timestamps, timeDelta)
      const seconds = timeDelta / 1000;
      if (frameCount === 1) {
        fps = 1;
        jank = 0;
      } else if (seconds <= 0) {
        fps = 1;
        jank = 0;
      } else {
        console.log('calculateResults', frameCount, seconds)
        fps = Math.round((frameCount - 1) / seconds);
        if (frameCount <= 4) {
          jank = this.calculateJanky(timestamps);
        } else {
          jank = this.calculateJankey_new(timestamps);
        }
      }
      return [fps, jank];
    }

    /**
     * 计算 Jank
     * @param {Array<{frameNumber: number, timeStamp: number, refreshPeriod: number}>} timestamps - 时间戳数组，每个元素包括帧号、时间戳（单位为毫秒）和刷新周期（单位为纳秒）
     * @returns {number} jank - Jank
     */
    calculateJanky(timestamps) {
      const twoFrameTime = 16.7;
      let jank = 0;
      for (let i = 0; i < timestamps.length - 1; i++) {
        const currentFrameTime = timestamps[i + 1].timeStamp - timestamps[i].timeStamp;
        if (currentFrameTime >= twoFrameTime) {
          jank += currentFrameTime - twoFrameTime;
        }
      }
      return jank;
    }

    /**
     * 计算 Jank
     * @param {Array<{frameNumber: number, timeStamp: number, refreshPeriod: number}>} timestamps - 时间戳数组，每个元素包括帧号、时间戳（单位为毫秒）和刷新周期（单位为纳秒）
     * @returns {number} jank - Jank
     */
    calculateJankey_new(timestamps) {
      const twoFrameTime = 16.7;
      const jankThreshold = 10 * timestamps[0].refreshPeriod / 1000000;
      let lastFourFrameTime, lastThreeFrameTime, lastTwoFrameTime, lastOneFrameTime, currentFrameTime;
      let tempFrameTime = 0;
      let jank = 0;
      for (let i = 0; i < timestamps.length; i++) {
        const frameTime = timestamps[i].timeStamp - timestamps[0].timeStamp;
        if (i <= 3) {
          // 前 4 帧不计算 Jank
          if (tempFrameTime === 0) {
            tempFrameTime = frameTime;
            continue;
          }
          const costTime = frameTime - tempFrameTime;
          tempFrameTime = frameTime;
          if (costTime > jankThreshold) {
            jank += costTime;
          }
        } else {
          // 计算临时帧间隔和当前帧间隔
          lastFourFrameTime = timestamps[i - 4].timeStamp - timestamps[0].timeStamp;
          lastThreeFrameTime = timestamps[i - 3].timeStamp - timestamps[0].timeStamp;
          lastTwoFrameTime = timestamps[i - 2].timeStamp - timestamps[0].timeStamp;
          lastOneFrameTime = timestamps[i - 1].timeStamp - timestamps[0].timeStamp;
          currentFrameTime = frameTime - timestamps[i - 1].timeStamp;
          // 计算 Jank
          if (lastOneFrameTime - lastTwoFrameTime >= twoFrameTime) {
            jank += lastOneFrameTime - lastTwoFrameTime - twoFrameTime;
          }
          if (lastTwoFrameTime - lastThreeFrameTime >= twoFrameTime) {
            jank += lastTwoFrameTime - lastThreeFrameTime - twoFrameTime;
          }
          if (lastThreeFrameTime - lastFourFrameTime >= twoFrameTime) {
            jank += lastThreeFrameTime - lastFourFrameTime - twoFrameTime;
          }
          if (currentFrameTime >= twoFrameTime) {
            jank += currentFrameTime - twoFrameTime;
          }
        }
      }
      return jank;
    }

    async collector(){
      const surfaceflingerFrameData = await this.getSurfaceflingerFrameData()
      const refreshPeriod = surfaceflingerFrameData.refreshPeriod
      const newTimestamps = surfaceflingerFrameData.timestamps

      let isFirst = true;
      if(!refreshPeriod || !newTimestamps){
        this.focusWindow = await this.getFocusActivity()
        console.log('focusWindow:', this.focusWindow)
        return
      }
      const timestamps = [];

      for (let i = 0; i < newTimestamps.length; i++) {
          const timestamp = newTimestamps[i];
          if (timestamp[1] > this.lastTimestamp) {
              timestamps.push(timestamp);
          }
      }

      if(timestamps.length){
        const firstTimestamp = [[0, this.lastTimestamp, 0]];
        if (!isFirst) {
            timestamps.unshift(...firstTimestamp);
        }
        this.lastTimestamp = timestamps[timestamps.length - 1][1];
        isFirst = false;
      } else {
        const curFocusWindow = await this.getFocusActivity();
        console.log('curFocusWindow:', this.focusWindow, curFocusWindow)
        if (this.focusWindow !== curFocusWindow) {
            this.focusWindow = curFocusWindow;
        } 
      }

      const currentStamp = Date.now();
      this.dataQueue.push([
        refreshPeriod, timestamps, currentStamp
      ])

      console.log('collector:', this.lastTimestamp, this.focusWindow)
    }

    runCommand(cmd) {
      cmd = `${this.adb} -s ${this.deviceId} shell ${cmd}`
      console.log(`fps ${cmd}`)
      return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error(`into cpuinfos error: ${error}`);
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
    }

    async getSurfaceflingerFrameData() {
      let refreshPeriod = null;
      const timestamps = [];
      let focusWindow = this.focusWindow 
      if(!focusWindow) {
        focusWindow = await this.getFocusActivity();
      }
      const packageName = this.packageName;

      const nanosecondsPerSecond = 1000000

      let results =  await this.runCommand(`dumpsys SurfaceFlinger --latency ${focusWindow}`);
      console.log('results=before', results)
      results = results.replace(/\r\n/g, "\n").split("\n");
      refreshPeriod = parseInt(results[0]) / nanosecondsPerSecond
      results = await this.runCommand(`dumpsys gfxinfo ${packageName} framestats`);
      // 把dumpsys gfxinfo package_name framestats的结果封装成   dumpsys SurfaceFlinger --latency的结果
      results = results.replace(/\r\n/g, "\n").split("\n");
      if(!results.length){
        return {
          refreshPeriod, timestamps
        }
      }

      let isHaveFoundWindow = false;
      let PROFILEDATA_line = 0;

      results.forEach((line) => {
        if (!isHaveFoundWindow) {
          if (line.includes('Window') && line.includes(focusWindow)) {
            isHaveFoundWindow = true;
          }
        }

        if (!isHaveFoundWindow) {
          return
        }

        if (line.includes('PROFILEDATA')) {
          PROFILEDATA_line += 1;
        }

        const fields = line.split(',');

        if (fields && fields[0] === '0') {
          let timestamp = [
            parseInt(fields[1]),
            parseInt(fields[2]),
            parseInt(fields[13]),
          ];

          timestamp = timestamp.map((_timestamp) => _timestamp / nanosecondsPerSecond);
          timestamps.push(timestamp);
        }
      });

      return {
        refreshPeriod, 
        timestamps
      };
    }

    async getFocusActivity() {
      let activityName = '';
      let activityLine = '';
      let activityLineSplit = '';
    
      const dumpsysResult = await this.runCommand('dumpsys window windows');
      const dumpsysResultList = dumpsysResult.split('\n');
    
      dumpsysResultList.forEach((line) => {
        if (line.includes('mInputMethodInputTarget')) {
          activityLine = line.trim();
        }
      });
    
      if (activityLine) {
        activityLineSplit = activityLine.split(' ');
      } else {
        return activityName;
      }
      if (activityLineSplit.length > 1) {
        activityName = activityLineSplit[activityLineSplit.length - 1].replace('}', '');
      }
    
      console.log('getFocusActivity:', activityName)
      this.focusWindow = activityName;
      return activityName;
    }
}

module.exports = FPSMonitor