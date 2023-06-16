/**
 * author: hhw
 * 首先你全局需要有个nodejs的环境
 * binlog模式最好使用 MIXED 混合模式: binlog-format = MIXED
 */
const my = my_config = {
    //binlog数据存放的目录下
    listen_path_base: 'C:/\ProgramData/\MySQL/\MySQL Server 5.7/\Data',
    //没有select， CREATE TABLE需要特殊处理
    operate_list: ['UPDATE', 'INSERT INTO', 'DELETE', 'DROP', 'CREATE TABLE'],
    //输出目录
    out_path: './out.log',
    //my.ini中配置的
    log_bin: 'mysql_bin.index',
}
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec
//记录binlog存储位置的文件
const path_binlog_index = path.join(my.listen_path_base, my.log_bin);

!function listen_binlog() {
    let log_old_idx = 0;//存放上一次解析的binlog行数
    let path_binlog;
    //监听 mysql_bin.index，只有mysql服务重启时候才会发生变化
    fs.watchFile(path_binlog_index, () => {
        log_old_idx = 0;
        search_idx();
    });

    function search_idx () {
        if (path_binlog) {
            fs.unwatchFile(path_binlog); //移除该文件所有监听
        }
        let content = fs.readFileSync(path_binlog_index, 'utf8');
        let resolve_path_list = content.split('\n');
        //文件中末尾会多个回车  .\mysql-bin.000001
        let resolve_path = resolve_path_list[resolve_path_list.length - 2];
        if (resolve_path) {
            //只需要监听当前idx的binlog
            path_binlog = path.join(my.listen_path_base, path.basename(resolve_path));
            fs.watchFile(path_binlog, _listen_binlog);
        }
    }

    function _listen_binlog(arg) {
        let command = `mysqlbinlog --base64-output=DECODE-ROWS -v ` +
            path.basename(path_binlog) +
            ` > out.log`;
        //生成out.log;
        const generate = () => {
            return new Promise(function (resolve, reject) {
                exec(command, {cwd: my.listen_path_base}, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                })
            });
        };

        co(function* () {
            yield generate();
            let content = fs.readFileSync(path.join(my.listen_path_base, 'out.log'), 'utf8');
            let content_all_list = content.split('\n');
            let content_new_list = content_all_list.slice(log_old_idx); //这个是需要解析的
            if (arg != 'no_add') {
                yield appendFile(analyzeBinlog(content_new_list));
            }
            log_old_idx = content_all_list.length - 6; //结尾标识占了6行（包括一个回车）
            if (log_old_idx < 0) log_old_idx = 0;
        })
    }

    //先删除  旧版本的nodejs使用unlink 新版本用rm
    fs.unlink(my.out_path, () => {
        search_idx();
        _listen_binlog('no_add');
    })
}()

//解析日志成比较直观的方式
function analyzeBinlog(binlog_list) {
    let content_add_list = [];
    let binlog_str = binlog_list.join('\n');
    let partitions_list = binlog_str.split('\n/*!*/;\r\n'); //再进行分割一次
    //这个分段是我们需要的信息吗？获取需要的那句sql位子
    const get_info = (list) => {
        let index = -1;//标识所在位子
        let operate = null;//操作类型
        list.some((item, idx) => {
            for (let i = 0; i < my.operate_list.length; i++) {
                if (item && item.toUpperCase().indexOf(my.operate_list[i]) == 0) {
                    index = idx;
                    operate = my.operate_list[i];
                    return true;
                }
            }
        })
        return {
            index,
            operate
        };
    }

    partitions_list.forEach((item) => {
        let list = item.split('\n');
        let info = get_info(list);
        if (info.operate) {//这才是我们需要的日志
            let str = '';

            //use `00处理数据使用`/*!*/;
            //切换数据库了
            if (list[2].indexOf('use') == 0) {
                str += list[2].match(/\`.*?\`/g)[0] + `    `;
            }

            //#220207 14:27:40 server id ... ...
            let index = list[1].indexOf('server');
            let time = list[1].substring(1, index) //220207 14:27:40
            str += time + `    `;

            //原本应该特殊处理CREATE TABLE  偷懒
            str += list[info.index];

            content_add_list.push(str);
        }
    })
    return content_add_list;
}

/**
 * 将内容输入进 my.out_path
 * @param {string} content_add
 */
function appendFile(content_add_list) {
    let str = '';
    if (content_add_list) {
        for (let i = 0, len = content_add_list.length; i < len; i++) {
            str += (content_add_list[i] + `\n`);
        }
    }
    return new Promise(function (resolve, reject) {
        fs.appendFile(my.out_path, str, () => {
            resolve();
        });
    })
}

function co(gen, cb) {
    let fn = gen();
    const iterator = (data) => {
        let next = fn.next(data);
        if (next.done) {
            if (cb) return cb(next.value)
            else return next.value;//有异步这个取不到
        };
        if (next.value instanceof Promise) {
            next.value.then((d) => {
                iterator(d);
            }).catch((err) => {
                console.log(err);
            })
        } else {
            iterator(next.value);
        }
    }
    return iterator();
}