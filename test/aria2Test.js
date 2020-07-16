'use strict';
const { app } = require("electron");
const path = require('path');
const Aria2 = require('aria2');
const forever = require('forever-monitor');
const winston = require('winston');
const fs = require('fs');

const globalConfigDir = app.getPath('userData');
const aria2Dir = path.join(app.getAppPath(),"resource","aria2",process.platform);
const aria2_app = path.join(aria2Dir,"aria2c.exe");
const aria2_config = path.join(aria2Dir,"aria2.conf");
const sessionPath = path.join(app.getPath('userData'), 'download.session');

const logger = winston.createLogger({
	level: 'debug',
	format: winston.format.combine(
		winston.format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss'
		}),
		winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`+(info.splat!==undefined?`${info.splat}`:" "))
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: path.join(globalConfigDir,'logs/error.log'), level: 'error' }),
		new winston.transports.File({ filename: path.join(globalConfigDir,'logs/all.log') }),
	],
});


logger.debug(aria2_app);
logger.debug(aria2_config);
const EMPTY_STRING = '';
const systemConfig = {
    'all-proxy': EMPTY_STRING,
    'allow-overwrite': false,
    'auto-file-renaming': true,
    'check-certificate': false,
    'continue': true,
    'dir': app.getPath('downloads'),
    'max-concurrent-downloads': 5,
    'max-connection-per-server': 10,
    'max-download-limit': 0,
    'max-overall-download-limit': 0,
    'max-overall-upload-limit': '256K',
    'min-split-size': '1M',
    'no-proxy': EMPTY_STRING,
    'pause': true,
    'rpc-listen-port': 16801,
    'rpc-secret': EMPTY_STRING,
    'seed-ratio': 1,
    'seed-time': 60,
    'split': 10,
    'user-agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36Transmission/2.94'
  }
function transformConfig (config) {
    const result = []
    for (const [k, v] of Object.entries(config)) {
        if (v !== '') {
        result.push(`--${k}=${v}`)
        }
    }
    return result
}

let cmds = [aria2_app, `--conf-path=${aria2_config}`, `--save-session=${sessionPath}`];
if(fs.existsSync(sessionPath))
{
    cmds.push(`--input-file=${sessionPath}`);
}

cmds = [ ...cmds, ...transformConfig(systemConfig) ];
logger.debug(cmds.join(' '));

let instance = forever.start(cmds,{
    max:10,
    parser: function (command, args) {
        logger.debug(command,args);
        return {
        command: command,
        args: args
        }
    },
    silent: false
});

const { child } = instance
logger.info('Engine pid:', child.pid)

instance.on('error', (err) => {
  logger.info(`Engine error: ${err}`)
})

instance.on('start', function (process, data) {
  logger.info('Engine started' ) 
})

instance.on('stop', function (process) {
  logger.info('Engine stopped')
})

let aria2 = new Aria2({port:16801});

aria2
.open()
.then(() => console.log("aria2 open"))
.catch(err => console.log("aria2 error", err));

[
    'onDownloadStart',
    'onDownloadPause',
    'onDownloadStop',
    'onDownloadComplete',
    'onDownloadError',
    'onBtDownloadComplete'
].forEach((notification) => {
    aria2.on(notification, (params) => {
        console.log('aria2', notification, params)
    })
})

aria2.call("addUri",[ 'https://tools.heisir.cn/HLSDownload/ChromeVideoPlugin.crx' ],{ dir: app.getPath('downloads') , out: "123.crx", split: "64"})
