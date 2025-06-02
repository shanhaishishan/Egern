/**
 * showEgernStartPanel.js（改进版）
 *
 * 兼容：
 * 1. $argument 可能为空（没有传 icon/color）；  
 * 2. /v1/traffic 接口失败时，不让脚本直接挂；  
 * 3. 确保任何分支下都调用 $done(...)，避免只显示图标无内容的问题。
 */

(async () => {
  // —— 先给默认值，避免 $argument 是 undefined 时报错 —— 
  const rawArgs = typeof $argument === "string" ? $argument : "";
  let params = parseArgs(rawArgs);

  // 准备用于最终返回给面板的数据（覆盖后面再写入）
  let panel = {
    title: "Egern Pro®",
    content: "",            // 正文（会被填充）
    icon: params.icon,      // icon 一定要有，否则面板只显示默认图标
    "icon-color": params.color // icon 颜色
  };

  try {
    // —— 1. 调用 /v1/traffic 接口，拿到 startTime —— 
    //    用内部 httpAPI 方法，默认为 GET
    let traffic = await httpAPI("/v1/traffic", "GET");
    if (!traffic || typeof traffic.startTime !== "number") {
      // 如果拿到的数据不对，就抛异常到 catch
      throw new Error("接口返回数据缺少 traffic.startTime");
    }

    // —— 2. 计算“启动时长” —— 
    const now = new Date();
    const startMs = Math.floor(traffic.startTime * 1000);
    const durationText = formatDuration(now, startMs);

    panel.content = `启动时长：${durationText}`;

    // —— 3. 如果用户点了“刷新”按钮，就走这个分支 —— 
    //    Egern 面板传入 $trigger，对应用户的操作（”button“ 代表点击了“刷新”）。
    if ($trigger === "button") {
      // 触发重载配置（等同 Surge 里的 /v1/profiles/reload）
      await httpAPI("/v1/profiles/reload", "GET");
      // 刷新后，我们可以再去拿一次新的 startTime，保持时长最新
      let refetch = await httpAPI("/v1/traffic", "GET");
      if (refetch && typeof refetch.startTime === "number") {
        const newStartMs = Math.floor(refetch.startTime * 1000);
        panel.content = `（已刷新）启动时长：${formatDuration(new Date(), newStartMs)}`;
      }
    }
  } catch (err) {
    // —— 如果上述任何一步失败，都在 content 中展示错误信息 —— 
    panel.content = `❗ 获取启动时间失败：\n${err.message}`;
  } finally {
    // —— 不管成功还是失败，都必须调用 $done 才能让面板渲染出完整内容 —— 
    $done(panel);
  }
})();

/**
 * parseArgs：把形如 "icon=paperplane.circle&color=%23f6c970" 的字符串解析成对象
 * 如果未传入，会使用内部默认值。
 */
function parseArgs(argString) {
  // 默认图标和颜色
  let defaults = {
    icon: "paperplane.circle",
    color: "#f6c970"
  };
  if (!argString) return defaults;

  try {
    let obj = Object.fromEntries(
      argString
        .split("&")
        .map(pair => pair.split("="))
        .map(([k, v]) => [k, decodeURIComponent(v)])
    );
    return {
      icon: obj.icon || defaults.icon,
      color: obj.color || defaults.color
    };
  } catch {
    // 解析失败就用默认
    return defaults;
  }
}

/**
 * formatDuration：根据当前时间 dateNow 与启动时戳 startMs（毫秒）计算时长，
 * 返回类似“1天3时5分20秒”或“3时5分20秒”、“5分20秒”等格式。
 */
function formatDuration(dateNow, startMs) {
  let diffMs = dateNow.getTime() - startMs;
  if (diffMs < 0) diffMs = 0;

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / (3600 * 24));
  const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return `${days}天${hours}时${minutes}分`;
  } else if (hours > 0) {
    return `${hours}时${minutes}分${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * httpAPI：封装 $httpAPI 调用，返回一个 Promise。
 * path：接口路径（如 "/v1/traffic"）；
 * method：HTTP 方法，GET/POST/PUT/DELETE 等；
 * body：如果有请传入 JSON 对象，否则传 null。
 */
function httpAPI(path = "", method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    // 10 秒超时保护（可选，Egern 本身也会有 timeout 配置）
    let isTimeout = false;
    const timer = setTimeout(() => {
      isTimeout = true;
      reject(new Error(`${path} 请求超时`));
    }, 10000);

    $httpAPI(method, path, body, (result, error) => {
      clearTimeout(timer);
      if (isTimeout) return;
      if (error) {
        reject(new Error(`${path} 接口错误：${error}`));
      } else {
        resolve(result);
      }
    });
  });
}