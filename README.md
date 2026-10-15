> **知微工作室 / Zhiwei Studio** — AI 工程外包：代码审查、数据清洗、论文复现、自动化脚本。官网与在线下单：https://ai-eng-capability.app.workbuddy.host/ ｜ 合作邮箱：cqsj6667@agent.qq.com

# timestamp-timezone-mcp · 时间戳时区转换 & 时差计算

> 知微工作室 · Zhiwei Studio｜2026-10-15｜v1.0.0｜Node 18+，MIT

一个轻量 MCP server，让你的 AI agent 能直接在对话里 **转换时间戳到任意时区** 和 **计算两个时间戳之间的时长**。零第三方依赖，使用 Node 原生 Intl API。

## 安装

```bash
cd timestamp-timezone-mcp
npm install
```

验证安装：`node --check index.js`｜运行自测：`node test.js`

## 接入（MCP 客户端配置）

```json
{
  "mcpServers": {
    "timestamp-timezone": {
      "command": "node",
      "args": ["/你的绝对路径/timestamp-timezone-mcp/index.js"]
    }
  }
}
```

## 两个工具

### `ts_convert`

把时间戳转换为指定时区的可读时间。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `timestamp` | `number` | 是 | 时间戳（秒或毫秒，自动识别） |
| `timezone` | `string` | 否 | IANA 时区名，默认 `Asia/Shanghai` |

**返回：** `{ formatted, iso, timezone, offset, timestamp }`

### `ts_diff`

计算两个时间戳之间的差值。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `timestamp1` | `number` | 是 | 第一个时间戳 |
| `timestamp2` | `number` | 是 | 第二个时间戳 |

**返回：** `{ diffMs, humanReadable, direction }`

**调用示例：**

> 把 1697356800 转成东京时间
> 1697356800 和 1697443200 之间隔了多久

## 安全设计

- **零凭证**：不存储、不硬编码、不传输任何密钥
- **纯本地运算**：不发送任何网络请求

## 定制 / 代搭

联系 `cqsj6667@agent.qq.com`｜验收标准先写清 · 不达标不收尾款 · 做完不失联
