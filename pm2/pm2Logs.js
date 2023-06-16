var HHW;
(function (HHW) {
    var myConfig = {
        /* 推送忽略推送的进程列表 */
        ignore_name_list: [
            'pm2-logrotate',
            // 'pm2Logs'
        ],
        /** 包含推送内容列表（匹配）先 */
        include_list: [
            'of undefined',
            'HHW',
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
    };
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    var childProcess = require('child_process');
    var path = require("path");
    /**
     * 企业微信推送 通过markdown格式
     * @param {string} msg
     * @param {string} key
     * @param {string} name
     */
    function pushWx_markdown(msg, key, name) {
        if (!key)
            return;
        if (name) {
            var name_list = name.split('|');
            name_list.forEach(function (name) {
                msg += "\n<@".concat(name, ")");
            });
        }
        var postData = {
            "msgtype": "markdown",
            "markdown": {
                "content": msg,
            }
        };
        _pushWx(postData, key);
    }
    HHW.pushWx_markdown = pushWx_markdown;
    function _pushWx(postData, key) {
        var data = JSON.stringify(postData);
        var options = {
            hostname: "qyapi.weixin.qq.com",
            port: "443",
            path: "/cgi-bin/webhook/send?key=" + key,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data)
            }
        };
        var https = require("https");
        if (https) {
            var rst = https.request(options, function (res) {
            });
            rst.write(data);
            rst.end();
        }
    }
    /** 进程任务执行 */
    function exec2(cmd, cb, options) {
        if (options === void 0) { options = {}; }
        var exec = childProcess.exec;
        // if (process.platform !== 'linux') return cb();
        exec(cmd, options, function (err, stdout, stderr) {
            if (err) {
                console.error(err);
                throw "执行报错请查看日志";
            }
            else {
                var data = stdout || stderr;
                cb(data);
            }
        });
    }
    var Pm2_tool = /** @class */ (function () {
        function Pm2_tool() {
            this._pm2_path = myConfig.pm2_path || ""; //pm2路径不存在就从全局nodeModule下取
            this.init();
        }
        Pm2_tool.prototype.init = function () {
            var self = this;
            var promise = new Promise(function (resolve, reject) {
                if (self._pm2_path) {
                    resolve(self._pm2_path);
                }
                else {
                    exec2("npm root -g", function (rst) {
                        rst = rst.split('\n')[0];
                        self._pm2_path = path.join(rst, 'pm2');
                        resolve(self._pm2_path);
                    });
                }
            });
            promise.then(function (rst) {
                var API = require(path.join(rst, "lib/API.js"));
                var pm2 = self._pm2 = new API();
                pm2.connect(function () {
                    self._inject(pm2);
                    setTimeout(function () {
                        console.error('错误监听开启');
                    }, 1000);
                });
            }, function (err) {
                console.error(err);
            });
        };
        // 监听日志
        Pm2_tool.prototype._inject = function (pm2) {
            var self = this;
            //pm2 logs
            pm2.Client.launchBus(function (err, bus, socket) {
                bus.on('log:*', function (type, packet) {
                    var errData = packet.data || '';
                    if (type == 'err' && self._filter(errData, packet.process.name)) {
                        var msg = 'pm2报错日志：\n' +
                            ">[\u8FDB\u7A0B\u4FE1\u606F]:<font color=\"info\">** ".concat(packet.process.name, "**</font>\n") +
                            " >[\u53D1\u751F\u65F6\u95F4]:<font color=\"info\">** ".concat(new Date().toLocaleString(), "**</font>\n") +
                            " >[\u9519\u8BEF\u65E5\u5FD7]:<font color=\"warning\">** ".concat(errData, "**</font>");
                        pushWx_markdown(msg, myConfig.wx_key || '', myConfig.name);
                    }
                });
            });
        };
        // 过滤
        Pm2_tool.prototype._filter = function (errData, name) {
            if (!errData)
                return false;
            if (myConfig.ignore_name_list && myConfig.ignore_name_list.indexOf(name) > -1) {
                return false;
            }
            if (myConfig.include_list) { //先看包含
                for (var _i = 0, _a = myConfig.include_list; _i < _a.length; _i++) {
                    var include_data = _a[_i];
                    if (errData.indexOf(include_data) > -1) {
                        return true;
                    }
                }
            }
            if (myConfig.ignore_list && myConfig.ignore_list.length) { //再看过滤
                for (var _b = 0, _c = myConfig.ignore_list; _b < _c.length; _b++) {
                    var ignore_data = _c[_b];
                    if (errData.indexOf(ignore_data) > -1) {
                        return false;
                    }
                }
            }
            return true;
        };
        return Pm2_tool;
    }());
    var pm2_tool = new Pm2_tool();
})(HHW || (HHW = {}));
//# sourceMappingURL=pm2Logs.js.map