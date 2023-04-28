const os = require('os');
const {exec, execSync, spawn } = require('child_process')
const logger = require('./logger');

/**
* 获取设备列表
* @returns []
*/
exports.getDevices = ()=>{
 return new Promise((resolve, reject) => {
   exec('adb devices', (error, stdout, stderr) => {
     if (error) {
       reject(error);
       return;
     }
     const result = stdout.replace(/\r/g, '').split('\n').slice(1).filter(line => line.length > 1 && line.indexOf('\t') >= 0 && line.split('\t')[1] === 'device').map(line => line.split('\t')[0]);
     logger.log(result)
     resolve(result);
   });
 });
}

/**
   * 启动服务
   */
exports.startServer = () =>{
  killOccupy5037Process();
  logger.warn('fork-server');
  execSync('adb server server -a');
}
/**
 * 杀死进程
 */
exports.killServer = () => {
  logger.warn('kill-server');
  execSync('adb kill-server');
}
/**
 * TCP的方式杀死特定端口
 * @returns 
 */
const killOccupy5037Process = exports.killOccupy5037Process = () => {
  const sysetnm = os.platform()
  if (sysetnm === 'Windows') {
    const cmd = 'netstat -ano|findstr "5037"';
    const ret = execSync(cmd).toString();

    if (!ret) {
      logger.debug('netstat is empty');
      return;
    }

    const lines = ret.split('\n');
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        logger.debug(line);
        const pid = line.trim().split(/\s+/).pop();
        const cmd2 = `tasklist |findstr ${pid}`;
        const ret2 = execSync(cmd2).toString();
        const process = ret2.trim().split(/\s+/)[0];

        logger.debug(`pid:${pid}, process:${process} occupy 5037 port`);
        execSync(`taskkill /T /F /PID ${pid}`);
        logger.debug(`kill process ${process}`);
        break;
      }
    }
  }
}