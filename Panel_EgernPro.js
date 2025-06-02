/**
 * showEgernStartPanel.js（针对 Egern 环境改写） 
 *
 * 说明：
 * 1. 用原生 fetch() 去调用 Egern 本地管理 API，例如 GET http://127.0.0.1:6154/v1/traffic 
 *    和 GET http://127.0.0.1:6154/v1/profiles/reload。
 * 2. 如果你的 Egern 管理 API 端口不是 6154，请把下面所有出现 “6154” 的地方改成你实际的端口号。
 * 3. 最后依然通过 $done({ title, content, icon, "icon-color" }) 返回给面板渲染。
 */

(async () => {
  // —— 1. 先解析面板给的参数，兼容 $argument 可能为空 —— 
  const rawArgs = typeof $argument === "string" ? $argument : "";
  const params = parseArgs(rawArgs);

  // —— 2. 初始化一个“面板要返回”的对象” —— 
  let panel = {
    title: "Egern Pro®",
    content: "",            // 最终要显示的文本
    icon: params.icon,      // 从 $argument 里解析，或者用默认
    "icon-color": params.color
  };

  try {
    // —— 3. 调用 GET /v1/traffic 拿到 { startTime, … } —— 
    // 注意：下面把端口写成了 6154 → 如果你的 Egern API 端口不是 6154，请修改！
    const traffic = await fetchJSON("http://127.0.0.1:6154/v1/traffic");

    if (!traffic || typeof traffic.startTime !== "number") {
      throw new Error("接口返回数据不包含 traffic.startTime");
    }

    // —— 4. 用 traffic.startTime（单位秒）与当前时间计算“启动时长” —— 
    const nowMs   = Date.now();
    const startMs = Math.floor(traffic.startTime * 1000);
    const durationStr = formatDuration(nowMs, startMs);

    panel.content = `启动时长：${durationStr}`;

    // —— 5. 如果用户点击了“刷新”(trigger === "button") 就顺便调用 /v1/profiles/reload —— 
    //    并且再次重新计算一次最新的时长。 
    if ($trigger === "button") {
      // 触发配置重载，告诉 Egern “请重新应用配置”
      await fetchNoReturn("http://127.0.0.1:6154/v1/profiles/reload");
      // 再次去拿最新的 startTime（有可能刚重载，时长不变，但我们仍重新读一遍）
      const traffic2 = await fetchJSON("http://127.0.0.1:6154/v1/traffic");
      if (traffic2 && typeof traffic2.startTime === "number") {
        const startMs2 = Math.floor(traffic2.startTime * 1000);
        const durationStr2 = formatDuration(Date.now(), startMs2);
        panel.content = `（已刷新）启动时长：${durationStr2}`;
      }
    }
  } catch (err) {
    // —— 6. 任何一步出错，都会跑到这里，显示一条错误提示 —— 
    panel.content = `❗ 获取启动时间失败：\n${err.message}`;
  } finally {
    // —— 7. 最终把 panel 对象交给 Egern 渲染 —— 
    $done(panel);
  }
})();

/**
 * parseArgs：把类似 "icon=paperplane.circle&color=%23f6c970" 的字符串解析成对象
 * 如果没有传 $argument，就使用默认图标和配色。
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
 * formatDuration：把 nowMs（毫秒）与 startMs（毫秒）比较，
 * 返回类似 “1天3时5分20秒” 或 “3时5分20秒”、“5分20秒” 等格式。
 */
function formatDuration(nowMs, startMs) {
  let diffMs = nowMs - startMs;
  if (diffMs < 0) diffMs = 0;

  const totalSec = Math.floor(diffMs / 1000);
  const days   = Math.floor(totalSec / (3600 * 24));
  const hours  = Math.floor((totalSec % (3600 * 24)) / 3600);
  const mins   = Math.floor((totalSec % 3600) / 60);
  const secs   = totalSec % 60;

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
 * fetchJSON：用于 GET 任意 URL，并把结果 parse 成 JSON 返回
 * 如果接口返回非 200 或者 JSON 解析失败，就抛异常。
 */
async function fetchJSON(url) {
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) {
    throw new Error(`${url} 返回 ${resp.status}`);
  }
  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error(`${url} 返回的不是合法 JSON`);
  }
  return data;
}

/**
 * fetchNoReturn：用于 GET/POST 任意 URL，不关心返回内容，只要请求能发出去就 resolve
 */
async function fetchNoReturn(url) {
  const resp = await fetch(url, { method: "GET" });
  // 如果状态码不是 2xx，也可以抛异常，也可以忽略。这里我们只在非 2xx 时抛。
  if (!resp.ok) {
    throw new Error(`${url} 返回 ${resp.status}`);
  }
  return;
}
