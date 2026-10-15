#!/usr/bin/env node
/**
 * timestamp-timezone-mcp — 时间戳时区转换 & 时差计算工具
 * 知微工作室 · Zhiwei Studio · 2026-10-15 · v1.0.0
 *
 * 提供 2 个工具：
 *   ts_convert  时间戳（秒/毫秒自动识别）+ 目标时区 → 该时区可读时间
 *   ts_diff     两个时间戳之差 → 人类可读时长（如 "2 天 3 小时"）
 *
 * 设计原则：
 *   - 零第三方依赖（使用 Node 原生 Intl.DateTimeFormat）
 *   - 自动识别秒级 / 毫秒级时间戳（分界线：1e11）
 *   - 不存储、不硬编码任何凭证
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/* ===== 时间戳工具函数 ===== */

/**
 * 自动识别秒级 / 毫秒级时间戳，返回毫秒值
 * 分界线：1e11（约 5100 年的秒值），低于此值视为秒
 */
function normalizeToMs(ts) {
  const n = Number(ts);
  if (Number.isNaN(n)) throw new Error(`无效的时间戳: ${ts}`);
  return n < 1e11 ? n * 1000 : n;
}

/**
 * 把毫秒时间戳格式化为指定时区的可读时间
 * 使用 Intl.DateTimeFormat（Node 18+ 原生支持）
 */
function formatInTimezone(ms, timezone) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) throw new Error(`无效的时间戳: ${ms}ms`);

  // 验证时区名是否合法
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error(`无效时区: ${timezone}。请使用 IANA 时区名，如 Asia/Shanghai`);
  }

  // 格式化日期时间
  const dtStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  // 提取各部分用于 ISO 构建
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = t => parts.find(p => p.type === t)?.value || "";
  const localISO = `${get("year")}-${get("month")}-${get("day")}`;

  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getT = t => timeParts.find(p => p.type === t)?.value || "";
  const localTime = `${getT("hour")}:${getT("minute")}:${getT("second")}`;

  // 计算 UTC 偏移
  const utcStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const utcGet = t => utcStr.find(p => p.type === t)?.value || "";
  const utcDate = `${utcGet("year")}-${utcGet("month")}-${utcGet("day")}`;

  const utcTimeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const utcGetT = t => utcTimeParts.find(p => p.type === t)?.value || "";
  const utcTime = `${utcGetT("hour")}:${utcGetT("minute")}:${utcGetT("second")}`;

  // 偏移量 = 本地 - UTC（分钟）
  const localMs = new Date(`${localISO}T${localTime}Z`).getTime();
  const utcMs = new Date(`${utcDate}T${utcTime}Z`).getTime();
  const offsetMin = Math.round((localMs - utcMs) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offH = String(Math.floor(absMin / 60)).padStart(2, "0");
  const offM = String(absMin % 60).padStart(2, "0");
  const offset = `${sign}${offH}:${offM}`;

  return {
    formatted: dtStr,
    iso: `${localISO}T${localTime}${offset}`,
    timezone,
    offset,
    timestamp: ms,
  };
}

/**
 * 两个毫秒时间戳之差 → 人类可读时长
 */
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

/* ===== MCP Server ===== */

const server = new Server(
  { name: "timestamp-timezone-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ts_convert",
      description: "把时间戳转换为指定时区的可读时间。自动识别秒级（<1e11）和毫秒级时间戳。时区使用 IANA 名称（如 Asia/Shanghai、America/New_York、Europe/London）。",
      inputSchema: {
        type: "object",
        properties: {
          timestamp: { type: "number", description: "时间戳（秒或毫秒，自动识别）。例：1697356800（秒）或 1697356800000（毫秒）" },
          timezone: { type: "string", description: "目标时区（IANA 名称），默认 Asia/Shanghai。例：America/New_York、UTC、Europe/London" },
        },
        required: ["timestamp"],
      },
    },
    {
      name: "ts_diff",
      description: "计算两个时间戳之间的差值，返回人类可读时长（如 \"2 天 3 小时 15 分钟\"）。自动识别秒级和毫秒级时间戳。",
      inputSchema: {
        type: "object",
        properties: {
          timestamp1: { type: "number", description: "第一个时间戳" },
          timestamp2: { type: "number", description: "第二个时间戳" },
        },
        required: ["timestamp1", "timestamp2"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  try {
    if (name === "ts_convert") {
      const ms = normalizeToMs(a.timestamp);
      const tz = a.timezone || "Asia/Shanghai";
      const result = formatInTimezone(ms, tz);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "ts_diff") {
      const ms1 = normalizeToMs(a.timestamp1);
      const ms2 = normalizeToMs(a.timestamp2);
      const diffMs = ms2 - ms1;
      const result = {
        diffMs,
        humanReadable: humanDuration(diffMs),
        direction: diffMs >= 0 ? "timestamp2 晚于 timestamp1" : "timestamp1 晚于 timestamp2",
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    return { content: [{ type: "text", text: "未知工具: " + name }], isError: true };
  } catch (e) {
    return {
      content: [{ type: "text", text: "错误: " + (e && e.message ? e.message : String(e)) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
