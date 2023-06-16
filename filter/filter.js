let rs = require("fs");
let content = rs.readFileSync('./in.txt', 'utf8');
function filter(v) {
    content = content.replace(new RegExp(v, 'g'), "#");
}
function isSpecialWord(value) {
    let patrn = /[`~!@#$%^&*()_\-+=<>?:"{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]/im;
    if (!patrn.test(value)) { // 如果包含特殊字符返回false
        return false;
    }
    return true;
}
filter("、");
filter("\n");
filter("\r");
filter("，");
filter(",");



let list = content.split("#");
for(let i = list.length - 1; i >= 0; i--) {
    if (list[i]) list[i] = list[i].trim();//去周围空格
    if (!list[i]) list.splice(i, 1);//删除空
    else if (isSpecialWord(list[i])) {
        console.log(list[i]);//校验
    }
}

rs.writeFileSync('./out.txt', list.join("#"));