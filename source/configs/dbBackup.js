const fs = require('fs');
const spawn = require('child_process').spawn;
const dumpFileName = `./dbBackup/mini_hrms.dump.sql`;
const serverConfig = require('./server.config.js');

const writeStream = fs.createWriteStream(dumpFileName);

const dump = spawn('mysqldump', [
    '-u',
    serverConfig.database.username,
    `-p${serverConfig.database.password}`,
    serverConfig.database.db
]);

dump
    .stdout
    .pipe(writeStream)
    .on('finish', function () {
        console.log('Completed');
    })
    .on('error', function (err) {
        console.log(err);
    });