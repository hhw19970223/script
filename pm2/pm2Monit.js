var HHW;
(function (HHW) {
    var myConfig = {
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
                self._loopMonit();
            }, function (err) {
                console.error(err);
            });
        };
        Pm2_tool.prototype._loopMonit = function () {
            var self = this;
            var currentTime = new Date();
            self._pm2.Client.executeRemote('getMonitorData', {}, function (err, list) {
                var socket_list = [];
                list.forEach(function (info) {
                    var name = info.pm2_env.name;
                    if (myConfig.ignore_name_list.indexOf(name) > -1)
                        return;
                    var cpu = Number(info.monit.cpu); //%
                    if (cpu > 90) {
                        var mem = Number((info.monit.memory / 1048576).toFixed(2)); //'MB',
                        var msg = "\u8FDB\u7A0B ".concat(name, " cpu\u4F7F\u7528\u7387\u8FC7\u9AD8\n") +
                            " >[cpu]:<font color=\"warning\">** ".concat(cpu, "% **</font>\n") +
                            " >[\u5185\u5B58]:<font color=\"warning\">** ".concat(mem, "MB **</font>\n") +
                            " >[\u91CD\u542F\u6B21\u6570]:<font color=\"warning\">** ".concat(info.pm2_env.restart_time, " **</font>\n") +
                            " >[\u53D1\u751F\u65F6\u95F4]:<font color=\"info\">** ".concat(new Date().toLocaleString(), "**</font>\n");
                        pushWx_markdown(msg, myConfig.wx_key, myConfig.name);
                    }
                });
                setTimeout(function () {
                    pm2_tool._loopMonit();
                }, 30000); //30秒
            });
        };
        return Pm2_tool;
    }());
    var pm2_tool = new Pm2_tool();
})(HHW || (HHW = {}));
//# sourceMappingURL=pm2Monit.js.map