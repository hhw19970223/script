module HHW {
    const myConfig = {
        /* 推送忽略推送的进程列表 */
        ignore_name_list: [
            'pm2-logrotate',
            'pm2Logs',
            'hhw',
            'pm2Monit',
            'zw-team1[0]script-0-0',
            'zw-team2[0]script-0-0',
            'zw-team3[0]script-0-0',
            'zw-team5[0]script-0-0',
            'zw-team6[0]script-0-0',

        ],
        /** pm2的位置， 如果不配置 npm root -g 寻找位置 (/usr/local/node-14.17.6/lib/node_modules/pm2) */
        pm2_path: '',
        /** 企业微信推送key */
        wx_key: 'ee5621af-ddc8-4d6d-ba41-93dd0352f561',
        /** @某个人 | 分割 */
        name: '',
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const childProcess = require('child_process');
    const path = require("path");


    /**
     * 企业微信推送 通过markdown格式
     * @param {string} msg
     * @param {string} key
     * @param {string} name
     */
    function pushWx_markdown(msg: string, key: string, name?: string) {
        if (!key) return;
        if (name) {
            let name_list = name.split('|');
            name_list.forEach((name) => {
                msg += `\n<@${name})`;
            })
        }

        let postData: any = {
            "msgtype": "markdown",
            "markdown": {
                "content": msg,
            }
        }

        _pushWx(postData, key);
    }


    function _pushWx(postData: any, key: string) {
        let data = JSON.stringify(postData);
        let options: any = {
            hostname: "qyapi.weixin.qq.com",
            port: "443",
            path: "/cgi-bin/webhook/send?key=" + key,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data)
            }

        }

        let https = require("https");
        if (https) {
            let rst = https.request(options, function (res: any) {

            })
            rst.write(data);
            rst.end();
        }
    }

    /** 进程任务执行 */
    function exec2(cmd: string, cb: (rst?: any) => void, options: any = {}) {
        const exec = childProcess.exec;
        // if (process.platform !== 'linux') return cb();
        exec(cmd, options, function (err: any, stdout: any, stderr: any) {
            if (err) {
                console.error(err);
                throw "执行报错请查看日志";
            } else {
                let data = stdout || stderr;
                cb(data);
            }
        })
    }

    class Pm2_tool {
        private _pm2: any;
        private _pm2_path: string;
        constructor() {
            this._pm2_path = myConfig.pm2_path || "";//pm2路径不存在就从全局nodeModule下取
            this.init();
        }

        public init() {
            let self = this;
            let promise: Promise<string> = new Promise(function (resolve, reject) {
                if (self._pm2_path) {
                    resolve(self._pm2_path);
                } else {
                    exec2("npm root -g", function (rst) {
                        rst = rst.split('\n')[0];
                        self._pm2_path = path.join(rst, 'pm2');
                        resolve(self._pm2_path);
                    })
                }
            });

            promise.then((rst: string) => {
                const API = require(path.join(rst, "lib/API.js"));
                let pm2 = self._pm2 = new API();
                self._loopMonit();
            }, (err) => {
                console.error(err);
            })

        }

        private _loopMonit() {
            let self = this;
            let currentTime = new Date();
            self._pm2.Client.executeRemote('getMonitorData', {}, function(err: any, list: any[]) {
                let socket_list: MonitInfo[] = [];
                list.forEach((info) => {
                    let name = info.pm2_env.name;
                    if (myConfig.ignore_name_list.indexOf(name) > -1) return;

                    let cpu = Number(info.monit.cpu);//%
                    if (cpu > 90) {
                        let mem = Number((info.monit.memory / 1048576).toFixed(2));//'MB',
                        let msg = `进程 ${name} cpu使用率过高\n` +
                            ` >[cpu]:<font color="warning">** ${cpu}% **</font>\n` +
                            ` >[内存]:<font color="warning">** ${mem}MB **</font>\n` +
                            ` >[重启次数]:<font color="warning">** ${info.pm2_env.restart_time} **</font>\n` +
                            ` >[发生时间]:<font color="info">** ${new Date().toLocaleString()}**</font>\n`;

                        pushWx_markdown(msg, myConfig.wx_key, myConfig.name);
                    }
                })

                setTimeout(function () {
                    pm2_tool._loopMonit();
                }, 30000);//30秒
            });
        }
    }

    interface MonitInfo {
        name?: string;
        /** 进程状态 */
        status?: string;
        /** 进程号 */
        pid?: string;
        /** 进程重启次数 */
        restart_time?: string;
        node_version?: string;
        node_args?: string;
        pm_exec_path?: string;
        pm_pid_path?: string;
        pm_uptime?: string;
        version?: string;
        list?: {mem?: number, cpu?: number, time: string}[]
    }

    const pm2_tool: Pm2_tool = new Pm2_tool();
}