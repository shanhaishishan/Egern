/**
 * showEgernStartPanel.js
 *
 * 改写自 SurgePro.js（版本 1.5，作者 @Rabbit-Spec）：
 *   https://github.com/Rabbit-Spec/Surge/blob/master/Module/Panel/Surge-Pro/Moore/SurgePro.js
 * 原始脚本由 @fishingworld 编写，后由 @Rabbit-Spec 修改（2022.06.15）。版本：1.5 ePro.js](file-service://file-NytFtbEadEVxCodME3bFPd)
 *
 * 主要改动：
 * 1. 保留对 /v1/traffic 接口的调用，计算启动时长。
 * 2. 保留点击按钮时 `/v1/profiles/reload` 的逻辑。
 * 3. 用 Egern 面板脚本格式（$done 返回）来代替 Surge 特有的 Panel 格式。
 */

let params = getParams($argument);

!(async () => {
  // —— 1. 从内部 API 拿到流量统计（包含 startTime） —— 
  let traffic = await httpAPI("/v1/traffic", "GET");
  let dateNow = new Date();
  // traffic.startTime 单位是秒，这里乘 1000 转为毫秒
  let dateTime = Math.floor(traffic.startTime * 1000);
  let startTime = timeTransform(dateNow, dateTime);

  // —— 2. 如果用户点击了面板的“刷新”按钮，就触发重载 Profile —— 
  if ($trigger === "button") {
    await httpAPI("/v1/profiles/reload", "GET");
  }

  // —— 3. 返回给 Egern 面板需要渲染的内容 —— 
  $done({
    title: "Egern Pro®",
    content: `启动时长: ${startTime}`,
    icon: params.icon,
    "icon-color": params.color
  });
})();

/**
 * timeTransform: 把当前时间 dateNow 与启动时间 dateTime 对比，
 * 返回“X天Y时Z分W秒”或“X时Y分Z秒”等格式字符串。
 */
function timeTransform(dateNow, dateTime) {
  let dateDiff = dateNow - dateTime;
  let days = Math.floor(dateDiff / (24 * 3600 * 1000)); // 相差天数
  let leave1 = dateDiff % (24 * 3600 * 1000); 
  let hours = Math.floor(leave1 / (3600 * 1000));       // 相差小时数
  let leave2 = leave1 % (3600 * 1000);
  let minutes = Math.floor(leave2 / (60 * 1000));       // 相差分钟数
  let leave3 = leave2 % (60 * 1000);
  let seconds = Math.round(leave3 / 1000);               // 相差秒数

  if (days === 0) {
    if (hours === 0) {
      if (minutes === 0) return (`${seconds}秒`);
      return (`${minutes}分${seconds}秒`);
    }
    return (`${hours}时${minutes}分${seconds}秒`);
  } else {
    return (`${days}天${hours}时${minutes}分`);
  }
}

/**
 * httpAPI: 封装 $httpAPI，返回一个 Promise。
 * 注意：Egern 面板脚本里也支持 $httpAPI，与 Surge 兼容。
 *
 * 调用示例：
 *   let result = await httpAPI("/v1/traffic", "GET");
 *   let reloadResult = await httpAPI("/v1/profiles/reload", "GET");
 */
function httpAPI(path = "", method = "POST", body = null) {
  return new Promise((resolve) => {
    $httpAPI(method, path, body, (result) => {
      resolve(result);
    });
  });
}

/**
 * getParams: 将 $argument（形如 "icon=paperplane.circle&color=%23f6c970"）解析为对象：
 *   { icon: "paperplane.circle", color: "#f6c970" }
 */
function getParams(param) {
  return Object.fromEntries(
    param
      .split("&")
      .map(item => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}