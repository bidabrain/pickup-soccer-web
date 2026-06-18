# Pickup Football 技术方案 v2

> 业余足球「约球 / 报名」平台。无需注册，凭 PIN 管理自己的预约与报名。
> 架构：React + Vite + TS + Tailwind（GitHub Pages）+ Cloudflare Workers + D1（SQLite）。
> 本文档是 `PickupFootball_PRD_CN.pdf` 的可执行版，补全了原 PRD 缺失的业务规则与关键技术决策。

---

## 1. 项目概述

一个移动端优先的约球平台。任何人无需登录即可：

- 浏览未来 7 天内的预约场次；
- 新建预约（设管理 PIN，用于日后修改本场）；
- 报名参加某场（设个人 PIN，用于日后改/删自己的报名）；
- 超过上场人数的报名自动进入候补名单（Waiting List）；
- 创建人可随机抽 2 名队长；
- 过期场次自动只读，30 天后自动清除。

**只读无需 PIN，任何写操作都需要 PIN。**

---

## 2. 关键技术决策

这一节是地基，解决原 PRD 没覆盖的 4 个设计冲突。

### 2.1 PIN 去重 vs 加盐哈希（双列方案）

需求：同一场内若新报名 PIN 与他人重复，要提示换一个。但加盐哈希同一 PIN 两次结果不同，无法靠比对哈希判重。解决办法是**一个 PIN 存两列**：

| 列 | 算法 | 用途 |
|----|------|------|
| `pin_hash` | PBKDF2-SHA256 + 随机盐 + 100k 次 | 验证 PIN（不可逆、防拖库） |
| `pin_lookup` | HMAC-SHA256(pin, `match_secret`) | 判重（确定性、可比对） |

- 对 `registrations` 加约束 `UNIQUE(match_id, pin_lookup)`。
- 相同 PIN → 相同 HMAC → 插入冲突 → API 返回 `409 PIN_DUPLICATE` → 前端提示换一个。
- `match_secret` 每场随机 32 字节，保证同一 PIN 在不同场次的 lookup 不同（防跨场关联）。
- 判重只在**同场报名之间**进行；管理 PIN（在 `matches` 表）与报名 PIN 互不影响。

### 2.2 防暴力枚举

4–6 位 PIN 熵低，必须配合限流：

- **限流**：同一 IP + 同一 `match_id`，验证 PIN 失败 **5 次 / 10 分钟**即临时锁定。优先用 Cloudflare 原生 Rate Limiting binding；无则用 KV 计数器（key=`{ip}:{matchId}`，TTL 600s）。
- **强制 6 位数字 PIN**（10⁶ 组合），配合限流后枚举不可行。
- 验证失败统一返回 `401 PIN_INVALID`，不泄露名字是否存在。
- 慢哈希（PBKDF2 100k 次）增加离线破解成本。
- 威胁模型边界：本平台为「熟人约球」低风险场景，PIN 不等同强密码；上述措施足以防机会性攻击，不防定向高强度攻击。

### 2.3 哈希实现：Web Crypto（不用 bcrypt）

Workers 是 V8 环境，原生 bcrypt 的 C 扩展无法加载。改用平台原生 `crypto.subtle`，零依赖、更快。

```js
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// 生成 PIN 哈希："pbkdf2$100000$<salt>$<hash>"
async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$100000$${b64(salt)}$${b64(bits)}`;
}

// 验证 PIN（恒定时间比较）
async function verifyPin(pin, stored) {
  const [, iter, saltB64, hashB64] = stored.split('$');
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: +iter, hash: 'SHA-256' }, key, 256);
  return timingSafeEqual(b64(bits), hashB64);
}

// 判重用 HMAC（确定性）
async function pinLookup(pin, matchSecretB64) {
  const key = await crypto.subtle.importKey('raw', unb64(matchSecretB64),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(pin));
  return b64(sig);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
```

### 2.4 时区：每场可选，默认韩国（KST）

时区由创建人在新建时选择，默认 `Asia/Seoul`。**新建时一次性把比赛绝对 UTC 时刻 `start_utc` 算出来存下**，之后所有时间比较都是纯数字、DST 自动正确。

- `date` + `time`：创建人填的墙上时间，用于显示。
- `timezone`：IANA 名（如 `Asia/Seoul`），用于显示与计算。
- `start_utc`：由三者算出的绝对 UTC 毫秒，所有比较都用它。

规则：
- 过期变灰：`now > start_utc`。
- 30 天清理：`now > start_utc + 30 * 86400_000`。
- 7 天窗口：相对**该场选定时区**的「今天」，即 `date ∈ [todayInTZ(tz), todayInTZ(tz)+7]`。
- 显示：卡片加时区角标（如 `KST` / `GMT+9`），避免跨时区误读。

```js
// 墙上时间 + 时区 → 绝对 UTC 毫秒（处理 DST）
function wallTimeToUtcMs(date, time, timeZone) {
  const [Y, M, D] = date.split('-').map(Number);
  const [h, m]    = time.split(':').map(Number);
  let utc = Date.UTC(Y, M - 1, D, h, m);
  const off1 = tzOffsetMs(utc, timeZone); utc -= off1;
  const off2 = tzOffsetMs(utc, timeZone);
  if (off2 !== off1) utc = Date.UTC(Y, M - 1, D, h, m) - off2;
  return utc;
}
function tzOffsetMs(utcMs, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}
function todayInTZ(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
```

---

## 3. 数据库设计（Cloudflare D1）

```sql
CREATE TABLE matches (
  id                 TEXT    PRIMARY KEY,        -- nanoid
  date               TEXT    NOT NULL,           -- YYYY-MM-DD（墙上时间，所选时区）
  time               TEXT    NOT NULL,           -- HH:MM
  timezone           TEXT    NOT NULL DEFAULT 'Asia/Seoul',
  start_utc          INTEGER NOT NULL,           -- 绝对 UTC 毫秒
  venue              TEXT    NOT NULL,
  fee                INTEGER NOT NULL,           -- 每人费用（整数，单位元）
  max_players        INTEGER NOT NULL,           -- 上场人数
  note               TEXT,                       -- 备注（可空）
  organizer_pin_hash TEXT    NOT NULL,           -- 管理 PIN（PBKDF2）
  match_secret       TEXT    NOT NULL,           -- HMAC 密钥（base64）
  captains_drawn     INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL            -- UTC 毫秒
);

CREATE TABLE registrations (
  id          TEXT    PRIMARY KEY,               -- nanoid
  match_id    TEXT    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  pin_hash    TEXT    NOT NULL,                  -- 个人 PIN（PBKDF2）
  pin_lookup  TEXT    NOT NULL,                  -- HMAC，用于判重
  position    INTEGER NOT NULL,                  -- 报名顺序 1..n
  is_captain  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  UNIQUE(match_id, pin_lookup)                   -- 同场 PIN 判重
);

CREATE INDEX idx_reg_match    ON registrations(match_id, position);
CREATE INDEX idx_matches_start ON matches(start_utc);
```

**确认/候补不落库，按 `position` 排序在读取时计算**：按 `position` 升序，前 `max_players` 个为确认上场，其余为候补。这样有人取消后，候补自动顶上，无需改库。

---

## 4. API 设计（Cloudflare Workers）

基址 `/api`。所有响应 JSON。需 PIN 的接口在 body 传 `pin`。

| 方法 | 路径 | 说明 | 需 PIN |
|------|------|------|--------|
| GET | `/api/matches` | 首页列表（`start_utc >= now - 30天`），含计算后的人数/状态 | 否 |
| POST | `/api/matches` | 新建预约（校验 7 天窗口，算 `start_utc`，哈希管理 PIN） | 设置 |
| GET | `/api/matches/:id` | 详情 + 报名列表（按 position 排序，标确认/候补/队长） | 否 |
| PUT | `/api/matches/:id` | 创建人编辑本场（不可改名单） | 管理 |
| POST | `/api/matches/:id/registrations` | 报名（判重 PIN，分配 position） | 设置 |
| PUT | `/api/matches/:id/registrations/:rid` | 改自己的报名（如改名） | 个人 |
| DELETE | `/api/matches/:id/registrations/:rid` | 删自己的报名 | 个人 |
| POST | `/api/matches/:id/captains` | 从确认名单随机抽 2 队长 | 管理 |

### 4.1 业务校验要点

- **新建**：`date` 必须 ∈ `[todayInTZ(tz), todayInTZ(tz)+7]`；`time`/`venue`/`fee`/`max_players` 必填；PIN 必须 6 位数字。
- **过期锁定**：任何写接口若目标场 `now > start_utc`，一律拒绝（`409 MATCH_LOCKED`），仅 GET 可用。
- **报名**：`position = 当前最大 position + 1`；插入命中 `UNIQUE` → `409 PIN_DUPLICATE`。
- **编辑本场**：只允许改 `time/venue/fee/max_players/note`（`date`/`timezone` 是否可改见下）；**禁止**通过此接口改动 `registrations`。
- **抽队长**：从「确认上场」(`position <= max_players`) 中随机取 2 个置 `is_captain=1`，其余清 0，`captains_drawn=1`；可重复抽（覆盖上次）。
- **限流**：所有「验证 PIN」的接口（PUT/DELETE 报名、PUT 本场、POST 队长）走 2.2 的限流。

> 待定项：编辑本场时是否允许改 `date`/`max_players`。建议允许，但改 `max_players` 会影响确认/候补划分（自动重算，无需改库）；改 `date` 仍须落在 7 天窗口内。

### 4.2 错误码

| HTTP | code | 含义 |
|------|------|------|
| 400 | `VALIDATION` | 字段缺失/格式错/日期越界 |
| 401 | `PIN_INVALID` | PIN 错误 |
| 403 | `MATCH_LOCKED` | 场次已过期，只读 |
| 404 | `NOT_FOUND` | 场/报名不存在 |
| 409 | `PIN_DUPLICATE` | 同场 PIN 重复 |
| 429 | `RATE_LIMITED` | 验证次数过多 |

---

## 5. 业务规则详述

- **首页卡片状态**：
  - 未满：徽章「还差 N 人」（`N = max_players - 确认数`，>0 时）。
  - 已满：徽章「已满」+ 候补数（候补 > 0 时显示 `+M 候补`）。
  - 过期：整卡置灰、只读，徽章「已结束」。
- **候补机制**：报名不限人数；`position > max_players` 即候补；确认者取消后，候补按 position 自动顶上。
- **队长**：仅从确认名单抽 2 人，用两种颜色标注；任何人可见，重抽需管理 PIN。
- **可见性**：详情、名单、队长所有人可见；一切写操作需对应 PIN。
- **生命周期**：过期即只读；`start_utc` 超过 30 天由 Cron 删除（连带 `registrations` 级联删除）。

---

## 6. 前端结构（React + Vite + TS + Tailwind）

```
src/
  api/            # fetch 封装、类型定义
  pages/
    HomePage.tsx          # 场次列表 + FAB 新建
    CreateMatchPage.tsx   # 新建表单（含时区下拉、7 天窗口）
    MatchDetailPage.tsx   # 详情 + 名单 + 候补 + 队长
  components/
    MatchCard.tsx         # 列表卡片（状态徽章、置灰）
    PinInput.tsx          # 6 位 PIN 输入
    RegisterModal.tsx     # 报名弹窗（名字 + PIN）
    PinVerifyModal.tsx    # 改/删前验证 PIN
    TimezoneSelect.tsx    # 时区下拉，默认 Asia/Seoul
  lib/time.ts             # 与后端一致的时区工具
```

- 路由：`/`、`/create`、`/match/:id`。
- 状态：轻量，React Query 或自写 fetch 即可；无需全局登录态。
- UI：Material Design 风格（顶部 App Bar、FAB、卡片、Chip 徽章），主色取草地绿 `#0F6E56 / #1D9E75`。

---

## 7. 部署与运维

- **前端**：`vite build` → 推到 GitHub Pages（项目站点 `用户名.github.io/<repo>/`，注意 `base` 配置）。
- **后端**：`wrangler deploy` 部署 Worker；`wrangler d1 create` 建库、`d1 execute` 跑建表 SQL。
- **CORS**：Worker 对 Pages 域名放行（`Access-Control-Allow-Origin`）。
- **Cron Trigger**：每日一次，删除 `start_utc < now - 30天` 的 `matches`（级联清 `registrations`）。
- **环境**：Worker 绑定 D1（`DB`）、KV（限流，可选）、`HMAC_PEPPER`（可选全局盐）。

```toml
# wrangler.toml 关键片段
name = "pickup-football-api"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "pickup-football"
database_id = "<your-d1-id>"

[triggers]
crons = ["0 3 * * *"]   # 每日 03:00 UTC 清理
```

---

## 8. 安全清单

- [x] PIN 用 PBKDF2 加盐哈希存储，不可逆。
- [x] PIN 判重用每场独立 HMAC，不泄露明文、不可跨场关联。
- [x] 验证 PIN 接口限流（IP + match）。
- [x] PIN 强制 6 位数字。
- [x] 错误信息不泄露存在性。
- [x] 写操作严格校验过期锁定。
- [ ] 可选：全局 `HMAC_PEPPER` 增强（拖库后仍难判重）。

---

## 9. 里程碑

1. **M1 基建**：repo + Pages + D1 建库建表 + wrangler 骨架。
2. **M2 后端**：matches/registrations CRUD + PIN 方案 + 限流 + Cron。
3. **M3 前端**：三页 + 弹窗 + 时区选择 + 状态/置灰渲染。
4. **M4 联调上线**：CORS、部署、端到端验证（建场→报名→候补→抽队长→过期→清理）。

---

## 附录：未决问题

- 编辑本场允许修改的字段范围（`date`/`max_players` 是否可改）。
- 时区下拉的候选列表（建议：Asia/Seoul 默认 + Asia/Shanghai/Tokyo + 跟随本机）。
- 费用是否需要支持小数 / 多币种（当前设计为整数元）。
- 是否需要「创建人删除整场」能力（当前仅自动 30 天清理）。
