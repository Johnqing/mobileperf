const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');

const createXlsx = function () {
  const dataFile = path.join(__dirname, 'data/data.json')
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (err) {
    console.error(err);
  }

  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  // 添加表头
  worksheet.columns = [
    { header: 'Time', key: 'time' },
    { header: 'Battery Level', key: 'battery' },
    { header: 'FPS', key: 'fps' },
    { header: 'Max CPU Freq', key: 'maxFreq' },
  ];

  // 添加数据行
  const rows = Object.entries(data).map(([time, values]) => {
    values.Battery = values.Battery || {}
    values.fps = values.fps || {}
    values.top = values.top || {}
    return {
      time,
      battery: values.Battery.level,
      fps: values.fps.fps,
      maxFreq: values.top.maxFreq,
    };
  });
  worksheet.addRows(rows);
  const outputFilePath = path.join(__dirname, 'data/data.xlsx');

  // 将数据保存为Excel文件
  workbook.xlsx.writeFile(outputFilePath)
    .then(() => {
      console.log('Excel file generated successfully.');
    })
    .catch((err) => {
      console.error(err);
    });

}

// 添加或更新数据字段的函数
const addOrUpdateJsonField = exports.addOrUpdateJsonField = function (fieldName, fieldValue) {
  // 获取当前日期
  const now = new Date();
  const formatted = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();

  const dataFile = path.join(__dirname, 'data/data.json')

  // 读取文件中已有的数据
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (err) {
    console.error(err);
  }

  // 添加或更新字段
  console.log('data[formatted]', data, formatted)
  data[formatted] = data[formatted] || {}
  data[formatted][fieldName] = fieldValue;

  // 将更新后的数据写回文件
  fs.writeFileSync(dataFile, JSON.stringify(data));

  // 生成excel
  createXlsx();
}
