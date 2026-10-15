/**
 * timestamp-timezone-mcp 自测脚本
 * 知微工作室 · Zhiwei Studio · 2026-10-15
 * 运行：node test.js
 */

/* ===== 复制核心函数 ===== */

function normalizeToMs(ts) {
  const n = Number(ts);
  if (Number.isNaN(n)) throw new Error(`无效的时间戳: ${ts}`);
  return n < 1e11 ? n * 1000 : n;
}

function formatInTimezone(ms, timezone) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) throw new Error(`无效的时间戳: ${ms}ms`);
  try { Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new Error(`无效时区: ${timezone}`); }

  const dtStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = t => parts.find(p => p.type === t)?.value || "";
  const localISO = `${get("year")}-${get("month")}-${get("day")}`;

  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const getT = t => timeParts.find(p => p.type === t)?.value || "";
  const localTime = `${getT("hour")}:${getT("minute")}:${getT("second")}`;

  const utcParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const utcGet = t => utcParts.find(p => p.type === t)?.value || "";
  const utcDate = `${utcGet("year")}-${utcGet("month")}-${utcGet("day")}`;
  const utcTimeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const utcGetT = t => utcTimeParts.find(p => p.type === t)?.value || "";
  const utcTime = `${utcGetT("hour")}:${utcGetT("minute")}:${utcGetT("second")}`;

  const localMs = new Date(`${localISO}T${localTime}Z`).getTime();
  const utcMs = new Date(`${utcDate}T${utcTime}Z`).getTime();
  const offsetMin = Math.round((localMs - utcMs) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offH = String(Math.floor(absMin / 60)).padStart(2, "0");
  const offM = String(absMin % 60).padStart(2, "0");
  const offset = `${sign}${offH}:${offM}`;

  return { formatted: dtStr, iso: `${localISO}T${localTime}${offset}`, timezone, offset, timestamp: ms };
}

function humanDuration(ms) {
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小时`);
  if (minutes > 0) parts.push(`${minutes} 分钟`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} 秒`);
  return parts.join(" ");
}

/* ===== 测试框架 ===== */

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { console.log(`  ✓ ${msg}`); passed++; } else { console.error(`  ✗ ${msg}`); failed++; } }

/* ===== 测试用例 ===== */

// [1] 自动识别秒/毫秒
console.log("\n[1] 自动识别秒/毫秒");
{
  // 1697356800 秒 = 1697356800000 毫秒 = 2023-10-15T12:00:00Z
  assert(normalizeToMs(1697356800) === 1697356800000, "秒级时间戳 × 1000");
  assert(normalizeToMs(1697356800000) === 1697356800000, "毫秒级时间戳不变");
  assert(normalizeToMs(0) === 0, "零值 = 0ms");
}

// [2] UTC 时区转换
console.log("\n[2] UTC 时区转换");
{
  const r = formatInTimezone(1697356800000, "UTC");
  assert(r.formatted.includes("2023"), `包含年份 2023（实际: ${r.formatted}）`);
  assert(r.formatted.includes("10") && r.formatted.includes("15"), "包含月 10 日 15");
  assert(r.offset === "+00:00", `UTC 偏移 +00:00（实际 ${r.offset}）`);
}

// [3] Asia/Shanghai 时区（UTC+8）
console.log("\n[3] Asia/Shanghai 时区");
{
  const r = formatInTimezone(1697356800000, "Asia/Shanghai");
  assert(r.offset === "+08:00", `上海偏移 +08:00（实际 ${r.offset}）`);
  // 1697356800 = 2023-10-15T08:00:00Z
  // 08:00 UTC + 8h = 16:00 上海
  assert(r.formatted.includes("16"), `上海时间包含 16 时（实际: ${r.formatted}）`);
}

// [4] America/New_York 时区（UTC-4 夏令时 / UTC-5 冬令时）
console.log("\n[4] America/New_York 时区");
{
  // 2023-10-15 仍在夏令时（EDT = UTC-4）
  const r = formatInTimezone(1697356800000, "America/New_York");
  assert(r.offset === "-04:00", `纽约夏令时偏移 -04:00（实际 ${r.offset}）`);
  // 1697356800 = 2023-10-15T08:00:00Z
  // 08:00 UTC - 4h = 04:00 纽约
  assert(r.formatted.includes("04"), `纽约时间包含 04 时（实际: ${r.formatted}）`);
}

// [5] ts_diff 人类可读
console.log("\n[5] ts_diff 人类可读");
{
  assert(humanDuration(0) === "0 秒", "零差值 = 0 秒");
  assert(humanDuration(1000) === "1 秒", "1000ms = 1 秒");
  assert(humanDuration(60000) === "1 分钟", "60000ms = 1 分钟");
  assert(humanDuration(3600000) === "1 小时", "3600000ms = 1 小时");
  assert(humanDuration(86400000) === "1 天", "86400000ms = 1 天");
  assert(humanDuration(90000000) === "1 天 1 小时", "90000000ms = 1 天 1 小时");
  assert(humanDuration(90061000) === "1 天 1 小时 1 分钟 1 秒", "完整拆解");
}

// [6] ts_diff 负值
console.log("\n[6] ts_diff 负值取绝对值");
{
  assert(humanDuration(-86400000) === "1 天", "负值也正确显示");
}

// [7] 秒级时间戳传入
console.log("\n[7] 秒级时间戳转换");
{
  const r = formatInTimezone(normalizeToMs(1697356800), "UTC");
  assert(r.formatted.includes("2023"), "秒级时间戳也能正确转换");
}

// [8] 中文时区名（Tokyo / Seoul）
console.log("\n[8] 其他亚洲时区");
{
  const r = formatInTimezone(1697356800000, "Asia/Tokyo");
  assert(r.offset === "+09:00", `东京偏移 +09:00（实际 ${r.offset}）`);
  // 1697356800 = 2023-10-15T08:00:00Z
  // 08:00 UTC + 9h = 17:00 东京
  assert(r.formatted.includes("17"), `东京时间包含 17 时（实际: ${r.formatted}）`);
}

// [9] ISO 格式输出
console.log("\n[9] ISO 格式输出");
{
  const r = formatInTimezone(1697356800000, "Asia/Shanghai");
  assert(r.iso.includes("T"), "ISO 包含 T 分隔");
  assert(r.iso.includes("+08:00"), "ISO 包含偏移量");
}

// [10] 无效时间戳报错
console.log("\n[10] 无效输入");
{
  let threw = false;
  try { normalizeToMs("not-a-number"); } catch { threw = true; }
  assert(threw, "无效时间戳抛出异常");
}

// [11] 大时间跨度
console.log("\n[11] 大时间跨度");
{
  const oneYear = 365 * 86400000;
  const result = humanDuration(oneYear);
  assert(result.includes("365 天"), `一年 = 365 天（实际: ${result}）`);
}

// 汇总
console.log(`\n========== 结果 ==========`);
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed > 0) { console.error("有测试失败！"); process.exit(1); }
else { console.log("全部通过 ✓"); }
