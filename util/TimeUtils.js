const schedule = require('node-schedule');

const getCurrentTimeUnderline = exports.getCurrentTimeUnderline = function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}

/**
 * 任务时长 s
 * @param {*} task 
 * @param {*} hour 
 */
exports.tastTimer = (task, minute = 1) => {
  const time = minute * 60 * 1000;
  setTimeout(() => {
    task()
    console.log('Task stopped.');
  }, time);
}