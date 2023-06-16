module HHW {
    const myConfig = {
        /* 推送忽略推送的进程列表 */
        ignore_name_list: [
            'pm2-logrotate',
            // 'pm2Logs'
        ],
        /** 包含推送内容列表（匹配）先 */
        include_list: [
            'of undefined',
            'HHW',//输出日志使用
            'Error',
        ],
        /** 忽略推送内容列表（匹配）后 */
        ignore_list: [
            '脚本执行',
            '脚本函数',
            '会话已过期，请重新登录',
            'gs.usr.heartTick',
            'connect ECONNREFUSED',
            '请检查是否由于异步操作导致问题的出现',
            'doOfflineHandler.exception:',
            '初始化分服与区服映射缓存',
            '通知区服守护结束',
            '通知指定玩家他有守护状态结束',
            '结束同步宗门信息到Main库',
            '开始宗主7日未上线检测',
            '结束符石获得记录清理结算',
            '公会副本每日重置',
            '结束竞技场每日结算',
            '订阅推送',
            'WebSocketNet',
            '开始获取日志记录服务器信息',
            '开始获取聊天服务器信息',
            '链接出错，将于1秒后重试',
            '日志记录服务器断开！！',
            '当前运行版本号为',
            'gm-dir_static',
            'gm-entry',
            '区服段配置',
            '刷新活动列表成功',
            '登录聊天服成功',
            '每分钟更新个人榜单',
            '当前冲榜结算的玩家为空',
            '跨服活动服务器断开',
            '当前平台不使用自动开服',
            '当前查询用户数量为',
            '冲榜:批次',
            'gsm.refreshAct',
            '开始同步宗门信息到Main库',
            '成功清除',
            '日志插件不存在',
            '自动转让族长：设置标志条数',
            '对应的服务器组配置不存在',
            '公会副本每日自动开启',
        ],
        /** pm2的位置， 如果不配置 npm root -g 寻找位置 (/usr/local/node-14.17.6/lib/node_modules/pm2) */
        pm2_path: '',
        /** 企业微信推送key */
        wx_key: 'd5fbc60b-b931-4f97-94cf-c72561677520',
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
    export function pushWx_markdown(msg: string, key: string, name?: string) {
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
                pm2.connect(function () {
                    self._inject(pm2);
                    setTimeout(() => {
                        console.error('错误监听开启');
                    }, 1000)
                });
            }, (err) => {
                console.error(err);
            })

        }

        // 监听日志
        private _inject(pm2: any) {
            let self = this;
            //pm2 logs
            pm2.Client.launchBus(function (err: any, bus: any, socket: any) {
                bus.on('log:*', function (type: string, packet: any) {
                    let errData = packet.data || ''
                    if (type == 'err' && self._filter(errData, packet.process.name)) {
                        let msg = 'pm2报错日志：\n' +
                            `>[进程信息]:<font color="info">** ${packet.process.name}**</font>\n` +
                            ` >[发生时间]:<font color="info">** ${new Date().toLocaleString()}**</font>\n` +
                            ` >[错误日志]:<font color="warning">** ${errData}**</font>`;

                        pushWx_markdown(msg, myConfig.wx_key || '', myConfig.name);
                    }
                });
            });
        }

        // 过滤
        private _filter(errData: string, name: string): boolean {
            if (!errData)
                return false;
            if (myConfig.ignore_name_list && myConfig.ignore_name_list.indexOf(name) > -1) {
                return false;
            }
            if (myConfig.include_list) {//先看包含
                for (let include_data of myConfig.include_list) {
                    if (errData.indexOf(include_data) > -1) {
                        return true;
                    }
                }
            }
            if (myConfig.ignore_list && myConfig.ignore_list.length) {//再看过滤
                for (let ignore_data of myConfig.ignore_list) {
                    if (errData.indexOf(ignore_data) > -1) {
                        return false;
                    }
                }
            }
            return true;
        }
    }

    const pm2_tool: Pm2_tool = new Pm2_tool();
}