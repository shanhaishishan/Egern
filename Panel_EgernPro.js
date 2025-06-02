/**
 * showEgernStartPanel.js （使用 Egern 内置的 $httpAPI）
 */

(async () => {
  // —— 1. 解析从模块 YAML 里传进来的参数（icon/color），或使用默认值 —— 
  const rawArgs = typeof $argument === "string" ? $argument : "";
  const params = parseArgs(rawArgs);

  // —— 2. 准备一个 panel 对象，后面再填 content —— 
  let panel = {
    title: "Egern Pro®",
    content: "",       // 最终要显示的文字
    icon: params.icon, // 例如 "paperplane.circle"
    "icon-color": params.color // 例如 "#f6c970"
  };

  try {
    // —— 3. 直接用 $httpAPI 拿到 traffic.json（不用带端口） —— 
    //    Egern 会自动把它路由到 http://127.0.0.1:<API_PORT>/v1/traffic
    let traffic = await httpAPI("/v1/traffic", "GET");

    if (!traffic || typeof traffic.startTime !== "number") {
      throw new Error("接口返回数据缺少 startTime 字段");
    }

    // —— 4. 计算“启动时长” —— 
    const nowMs   = Date.now();
    const startMs = Math.floor(traffic.startTime * 1000);
    const durationText = formatDuration(nowMs, startMs);
    panel.content = `启动时长：${durationText}`;

    // —— 5. 如果用户点了“刷新”按钮（$trigger === "button"），就调用 /v1/profiles/reload —— 
    if ($trigger === "button") {
      // 重载配置
      await httpAPI("/v1/profiles/reload", "GET");
      // 再次重新读取一次 startTime
      let traffic2 = await httpAPI("/v1/traffic", "GET");
      if (traffic2 && typeof traffic2.startTime === "number") {
        const startMs2 = Math.floor(traffic2.startTime * 1000);
        const durationText2 = formatDuration(Date.now(), startMs2);
        panel.content = `（已刷新）启动时长：${durationText2}`;
      }
    }
  } catch (err) {
    // —— 如果以上任意一步失败，都在 panel.content 里显示错误信息 —— 
    panel.content = `❗ 获取启动时间失败：\n${err.message}`;
  } finally {
    // —— 6. 返回给 Egern 面板渲染 —— 
    $done(panel);
  }
})();

/**
 * parseArgs: 把 "icon=paperplane.circle&color=%23f6c970" 解析成 {icon, color}
 * 如果没有传参数，就用默认 icon="paperplane.circle"、color="#f6c970"
 */
function parseArgs(argString) {
  const defaults = {
    icon: "paperplane.circle",
    color: "#f6c970"
  };
  if (!argString) return defaults;
  try {
    const obj = Object.fromEntries(
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
    return defaults;
  }
}

/**
 * formatDuration: 根据 nowMs（毫秒）与 startMs（毫秒）算出差值，
 * 并返回类似 “1天3时5分20秒” / “3时5分20秒” / “5分20秒” / “20秒” 等格式。
 */
function formatDuration(nowMs, startMs) {
  let diff = nowMs - startMs;
  if (diff < 0) diff = 0;
  const totalSec = Math.floor(diff / 1000);
  const days  = Math.floor(totalSec / (3600 * 24));
  const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;

  if (days > 0) {
    return `${days}天${hours}时${mins}分`;
  } else if (hours > 0) {
    return `${hours}时${mins}分${secs}秒`;
  } else if (mins > 0) {
    return `${mins}分${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

/**
 * httpAPI: 把 Egern 环境下的 $httpAPI 封成 Promise 形式。
 * 仔细看：第一个参数是相对路径 "/v1/traffic"，第二个是 HTTP 方法 "GET"、"POST" 等，
 * 第三个可选 body（这里我们都不需要 body，所以传 null）。
 * Egern 会自动把它路由到正确的 http://127.0.0.1:<管理 API 端口>/… 路径。
 */
function httpAPI(path = "", method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    // $httpAPI 在 Egern 面板脚本里应该和 Surge 一样可用：
    // $httpAPI(method, path, body, callback)
    $httpAPI(method, path, body, (result, error) => {
      if (error) {
        reject(new Error(error));
      } else {
        resolve(result);
      }
    });
  });
}