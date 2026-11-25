# SurfCore 分发安装指南（含桌宠 + 云端语音）

> 版本锚点：SurfCore `v0.8.6`（2026-11-01）· surfpet `v0.2.3` · surfvoicecloud `v0.1.0`
> 平台：**仅 Windows 10/11**（沙箱 ACL 与 `.bat` 启动器按 Windows 写死）
> 一句话：**本体能一次装完；桌宠能一次装完；云端语音能一次装完 —— 但三样各有一个"只能本人做"的动作。**

---

## 0. 先把"一次性"说清楚（不然小伙伴会骂你）

| 环节 | 能否一次到位 | 卡在哪 |
|---|---|---|
| SurfCore 本体 | ✅ 一条命令 / 双击一个 bat | 无 |
| 装进 DSH（preset + 3 个 MCP + bundle） | ✅ 脚本自动 | 装完要**完全退出 DSH 再开** |
| 接上 QQ | ⚠️ 半自动 | **SnowLuma 必须本人扫码登录**（第三方，EULA 禁止代装） |
| 桌宠 | ✅ 设置页填 2 个值 + 点 2 下 | 包内**不含 Electron**，要先有 `electron.exe` |
| 云端语音 | ✅ 设置页点「安装」自动拉包+建环境 | **必须本机有 Python 3.10~3.13**；**必须自己申请火山 AppID/AccessKey**；**音色 ID 必须是自己的复刻**|
| B 站 | ⚠️ 扫码 | 同上，本人扫 |

**结论**：一个新人从零到"群里能回话 + 桌宠能说话 + 语音走云端"，实操约 20~35 分钟，其中 10 分钟在等下载。你没法把它压成"双击一下"，因为扫码和密钥天然属于账号。

---

## 1. 路线 A：发安装包（推荐给完全没接触过的人）

官方仓库自带安装包素材：`dist/installer/`（6 个文件）

```
1-安装说明.txt       ← 给人看的四步
2-安装.bat           ← 双击这个，全自动
3-自检.bat           ← 出问题双击这个，生成「诊断报告.txt」
4-反馈模板.txt
installer.mjs
doctor.mjs
```

**注意**：GitHub Release 页（`v0.8.6`）的 assets 是**空的**，官方没有上传 zip。所以"安装包"要你自己打：
把上面 6 个文件压成 `surfcore-install-kit-v0.8.6.zip` 发给对方即可。

朋友那边只有 4 步：

1. 解压 → 双击 **`2-安装.bat`**（自动检查 Node/DSH/SnowLuma → 下载 SurfCore → npm install → 装进 DSH → 生成配置文件），全程 3~10 分钟，中途不要关窗；
2. **完全退出 DSH**（托盘图标也要退），再打开；
3. 设置 → **SurfCore** → **诊断 → 一键安装（全部）** → 填主人 QQ → 勾要放行的群 → 「开始安装」；
4. 群里 @ 她。

出问题让他双击 `3-自检.bat`，把 `诊断报告.txt` 发回来。

**前置（缺一个就装不上）**：Node ≥ 22.13、DSH ≥ 0.2.1-rc.2、SnowLuma（要收 QQ 才需要）。

---

## 2. 路线 B：发一条命令（推荐给能开终端的人，永远装最新版）

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/Mieksido/surfcore/main/scripts/bootstrap.ps1 | iex"
```

它会：查环境 → 克隆/更新（没有 git 就下 zip）→ `npm install` → `setup-dsh.mjs` → 生成 `config.json` → 打印下一步。

国内 `raw.githubusercontent.com` 经常抽风，备用写法（第三方代理，介意别用）：

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://ghproxy.net/https://raw.githubusercontent.com/Mieksido/surfcore/main/scripts/bootstrap.ps1 | iex"
```

默认装到 `C:\Users\<你>\surfcore`；想换盘先设 `$env:SURFCORE_DIR='D:\surfcore'` 再跑同一条。

只想体检不装（`-Check` 不能跟在管道后面，要先落盘）：

```powershell
$f="$env:TEMP\bootstrap.ps1"; irm https://raw.githubusercontent.com/Mieksido/surfcore/main/scripts/bootstrap.ps1 -OutFile $f; & $f -Check
```

**两条路共同的硬规矩**：

- **别下 ZIP 装本体**：没有 `.git`，以后「检查更新」直接不可用；
- **装完必须 F5 或重启 DSH**：客户端模块图是页面加载时的快照，不刷新就看不到设置页；
- **装完要重启一次 DSH 才能看到 SurfCore 是正常的，不是装坏了**；
- **端口是活的，不是常量**：DSH 每次启动会换端口，`config.json` 的 `dsh.baseUrl` 必须跟着走（见 §3.1），写错了只报 401、「DSH 未就绪」。

---

## 3. 装完必做（两条路一样）

设置 → SurfCore → **诊断 → 环境体检**（9 项）。缺什么点「一键配置」，然后 **一键安装（全部）**。

然后填这 5 处（在设置页里改，保存即生效并自动备份；也可直接编辑仓库根 `config.json`）：

| 位置 | 填什么 | 不填的后果 |
|---|---|---|
| `dsh.baseUrl` | **正在运行的 DSH 端口**，别手填 —— 跑下面的 `sync-dsh-port.mjs` | 桥接「DSH 未就绪」、控制台 401，而且完全联想不到是端口问题 |
| `snowluma.wsUrl / httpUrl / accessToken` | SnowLuma 的 OneBot 端口（默认 3001 / 3000）和 token | 桥接连不上 QQ，控制台一直"未连接" |
| `ownerQQ` | 自己的 QQ 号 | 管理员功能全失效 |
| `allow.private / allow.groups` | 允许她接触的私聊 / 群 | **白名单为空 = 谁都不理**（不是全放行，这是第一个大坑） |
| `consoleToken` | 留空会自动生成到 `state/console-token` | 控制台 401 |

### 3.1 让 `dsh.baseUrl` 跟上 DSH 的端口（这份指南第一版漏了，最坑）

DSH 桌面端每次启动会**随机挑一个空闲回环端口**（实测 28918 → 15016 → 41742 → 42212 → 59127），而 `config.json` 里的 `dsh.baseUrl` 是写死的静态值。写错的症状是「DSH 未就绪」或者控制台 401 —— 你根本不会往端口上想。

```powershell
cd $env:USERPROFILE\surfcore
node scripts\sync-dsh-port.mjs          # 探测正在运行的 DSH，写回 config.json
node scripts\sync-dsh-port.mjs --print  # 只看探测结果，不改文件
```

桥接自己启动时也有同一份兜底探测（`src/dsh-port.js`），所以正常重启不用管；但**手动编辑过 `config.json`、或者 DSH 换了端口之后必须跑一次**，再重启桥接。

> 实测记录：`config.example.json` 的默认值是 `http://127.0.0.1:3080`，本机实际是 `59127`。差着 5 万号端口，但报错只说 401。

验收三件事：**群里 @ 她 → DSH 里出现对应会话 → 回复回到 QQ**。

---

## 4. 桌宠（一次走通）

### 4.1 朋友要做的

1. 设置 → **桌宠**；
2. 「安装包地址」填下面这个（16 MB，官方 Release 直链）：
   ```
   https://github.com/Mieksido/surfpet/releases/download/v0.2.3/pet-pack.zip
   ```
3. 「Electron 路径」填 `electron.exe` 的位置 → 点 **安装** → 点 **启动**。

装好后右键桌面上的小鱼：**文本对话 / 语音对话 / 专注模式 / 穿什么呢**。气泡上每句话都有「回复」按钮。

### 4.2 唯一的坑：包里没有 Electron

`pet-pack.zip` 只有 **16 MB**，是纯资源 + 已构建的 JS，**不含 Electron 运行时**（Electron 本体 ~150 MB）。所以「Electron 路径」必须指向一个已存在的 `electron.exe`：

- 设置页里有下载提示，按提示下；
- 或者自己 `npm i -g electron` 后指到全局路径；
- 或者从任意用 Electron 的软件里找一个（版本不要太老）。

路径填错的表现就是「装完起不来」——这是官方文档里排第一的桌宠故障。

### 4.3 桌宠和插件的连接方式

桌宠不碰 DSH 登录态，它读 `%USERPROFILE%\.dsh\surfcore\pet\host.json`（本机 + 一次性令牌）发现插件接口，端口漂移会自动重读。所以 **DSH 重启、端口变了都不用重配桌宠**。

---

## 5. 云端语音（一次走通）

### 5.1 装（全自动，别手动 clone）

设置 → **语音** → 「云端语音包」卡片 → 点 **安装**（下载约 60 MB；装完包目录约 300 MB = 模型 63 MB + `.venv` 230 MB）。

后台其实做了四件事（源码 `src/voice-packs.js`）：

1. 下载 `github.com/Mieksido/surfvoicecloud/archive/refs/heads/main.zip` → 系统 `tar` 解压；
2. 把 `config.example.toml` 复制成 `config.toml`，并**清空任何预置的云端凭据**；
3. 跑 `scripts/fetch-models.mjs`：拉 ≈56 MB 模型（含 piper 兜底音色），带 sha256 校验；
4. 跑 `scripts/bootstrap-env.mjs`：在包内建 `.venv` 并装依赖（首次 5~15 分钟，走清华/阿里镜像）。

包目录 = `<仓库根>\state\voice-packs\voice-cloud`（**不是** `~/.dsh` 下面）。

装完**不会有** `voices/` 目录（`.gitignore` 排除了），这会在 §5.3 填音色 ID 的时候咬你一口，先记着。

**已知毛病（v0.1.0 实测，会让人误判为装失败）**：第 4 步不止建 `.venv`，还会照着 `requirements-gsv.txt` 再建一个 `.venv-gsv`（GPT-SoVITS 环境，那个文件自己的注释写着"本地包专用"）。而 Python 3.12 的 venv 默认不带 setuptools，`pyopenjtalk-prebuilt` 只能源码构建 → 必然报 `BackendUnavailable: Cannot import 'setuptools.build_meta'`，清华、阿里、官方三个源挨个试一样失败，最后整条安装显示「失败」。

**云端包根本用不到 `.venv-gsv`。** 所以判定装好没有，别看进度条、也别看那个「失败」字样，看这三样：

- `.venv\Scripts\python.exe` 在；
- `config.toml` 在；
- `models\zh_CN-huayan-medium.onnx` 在（63 MB，piper 兜底音色）。

三样齐了就是装好了；半成品 `.venv-gsv` 直接删掉（连 `.pip-cache` 一起能省 700 MB 左右），下次别点「重装」去补它 —— 补不回来，也不需要。

### 5.2 唯一的前置：Python 3.10~3.13

`bootstrap-env.mjs` 只做"建虚拟环境 + 装依赖"，**不自带解释器**。机器上没有 3.10~3.13 会直接退出（`没找到 Python 3.10~3.13`）。

- 装 Python 3.12 时勾 **Add to PATH**；
- 不需要动系统环境：所有依赖都装在包目录内的 `.venv`，卸载 = 删目录。

**本机只有 3.14 时会被拒**（脚本按 `py -3.13 / py -3.12 / py -3.11 / py -3.10 / python / python3` 的顺序找，只认 3.10~3.13）。装不了新 Python 的话，用 uv 托管的解释器顶一下：

```powershell
cd "$env:USERPROFILE\surfcore\state\voice-packs\voice-cloud"   # 必须在包目录里跑
$py312 = "$env:APPDATA\uv\python\cpython-3.12.13-windows-x86_64-none"
$env:PATH = "$py312;$env:PATH"; python --version   # 应该输出 3.12.13
node scripts\bootstrap-env.mjs
```

> 这样建出来的 venv 仍然依赖那个基础解释器目录，**别删** `%APPDATA%\uv\python\cpython-3.12.13-windows-x86_64-none`，删了语音包就起不来。

> 提示：安装过程中当前版本有个已知小毛病——**进度和失败原因不刷新**（每次请求都新建实例，进度存在闭包里）。判定标准别看进度条，看包目录里有没有 `config.toml` + `models/`；卡住就点「取消」再点「安装」（已下的模型会保留）。

### 5.3 填 3 个值（这步谁也代劳不了）

设置 → 语音 → 「云端包：密钥与音色」：

| 字段 | 从哪来 |
|---|---|
| **AppID** | 火山引擎控制台 → 语音技术 → 自己的应用 |
| **Access Key** | 同上（密钥） |
| **音色 ID（speaker）** | 火山「声音复刻」里**你自己复刻出来的**音色 ID，形如 `S_xxxxxxxx` |

`resource` 固定 `seed-icl-2.0`，**别改**（改成 `seed-tts-2.0` 会报 55000000）。

填完 → **保存** → **测试连接** → **启动** → 点试听。

#### 已知坑：三个值都填了，还是说「云端包还没填密钥」

**症状**：AppID / Access Key / 音色 ID 三栏都填满了、也点了保存，启动依然报「失败：云端包还没填密钥」。

**原因**（v0.1.0 实测，这是真 bug 不是操作错）：`surfvoicecloud` 仓库的 `.gitignore` 里写着 `voices/`，所以 GitHub archive zip 里**永远没有这个目录**。而插件写 speaker 的分支要求 `voices/age12*` 存在：

```js
// src/voice-packs.js —— cloudConfig()
if (body.speaker) {
  const vdir = path.join(dir, 'voices');
  const first = (await fsp.readdir(vdir).catch(() => [])).find(x => x.startsWith('age12'));
  if (first) { /* 写进 voice.json */ }   // 没有 first 就静默跳过，不报错
}
```

`readdir(...).catch(() => [])` 把"目录不存在"吞成空数组，于是 speaker 被**静默丢掉**；而 AppID / AccessKey 走的是另一条分支（正则替换 `config.toml` 的行），不需要目录，所以**写成功了**。读的一侧（`voiceStatus`）从同一个 `voice.json` 取 speaker，取不到就 `configured:false` → 启动被拒。**写安静地丢、读严格地拒**，就是你看到「填了却说没填」的全部原因。

**先判定是哪种**：

```powershell
$pack = "$env:USERPROFILE\surfcore\state\voice-packs\voice-cloud"
Select-String -Path "$pack\config.toml" -Pattern '^cloud_app_id|^cloud_access_key'   # 有值 = 密钥写进去了
Test-Path "$pack\voices\age12-cloud\voice.json"                                      # False = speaker 丢了
```

**修法 A（命令行，最稳）**：建目录 + 直接把 speaker 写进去，然后回设置页点「启动」（不用再保存）：

```powershell
$pack = "$env:USERPROFILE\surfcore\state\voice-packs\voice-cloud"
$vdir = "$pack\voices\age12-cloud"
New-Item -ItemType Directory -Force -Path $vdir | Out-Null
'{ "id": "age12-cloud", "label": "小语（云端 · 女童声）", "speaker": "S_你的音色ID" }' |
  Set-Content "$vdir\voice.json" -Encoding utf8
```

**修法 B（纯界面）**：先只跑上面那行 `New-Item`（建目录，不写文件），再回设置页把音色 ID 重填一次并保存 —— 目录存在了，写入路径就通了。

> 为什么作者没发现：`.gitignore` 只影响版本库、不删他本机的文件，他开发机上 `voices/` 一直在，所以那条 `if (first)` 永远为真。只有「全新安装 + 只装云端包」的机器才会踩到。

> **别指望"包里自带参考音频"**：`surfvoicecloud` v0.1.0 的包目录里**没有** `voicepack/`（只有 `models/`、`voxd/`、`scripts/`、`config*.toml`）。要做声音复刻，自己录 10~20 秒干净人声（无 BGM、无回声、别喷麦）拿去火山控制台复刻，几秒出 `S_xxxxxxxx`。
> **不要共用别人的音色 ID / 别人的 AK**：音量是按字符计费，最后算在谁的账号上就花谁的钱。

### 5.4 点「启动」一直停在「处理中」

**症状**：语音页点「启动」，按钮一直显示「处理中…」，几十秒后失败；`8767` 端口始终不监听，`包目录\logs\` 里没有 `voxd.out.log`。

**原因**（v0.1.0 实测）：`run.bat` 第 10 行的重定向路径里藏了一个**控制字符**。原本是

```bat
start "" /b "%~dp0.venv\Scripts\pythonw.exe" -m voxd --config config.toml >> "%~dp0logs\voxd.out.log" 2>&1
```

但发行包里 `logs\voxd.out.log` 的 `\v` 被写成了字节 **0x0B（垂直制表符）**——十六进制能看到 `6C 6F 67 73 0B 6F 78 64`。Windows 文件名不允许 `<0x20` 的字符，于是 cmd 的重定向直接失败，`start "" /b pythonw` **整行不执行**，voxd 从头到尾没被拉起。插件那边只是在等端口，所以表现成"一直处理中"。

**判定**（三秒）：

```powershell
$pack = "$env:USERPROFILE\surfcore\state\voice-packs\voice-cloud"
(Get-Content "$pack\run.bat")[9]                                                     # 看那条 pythonw 命令
Get-NetTCPConnection -LocalPort 8767 -State Listen -ErrorAction SilentlyContinue      # 空 = 没起来
Test-Path "$pack\logs\voxd.out.log"                                                  # False = 重定向失败
```

**修法**：把那个 0x0B 换回真正的 `\v`（等价于把路径改成 `logs\voxd.out.log`）。一条命令搞定：

```powershell
$f = "$env:USERPROFILE\surfcore\state\voice-packs\voice-cloud\run.bat"
$raw = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::Latin1)
[System.IO.File]::WriteAllText($f, ($raw -replace "logs\x0B", "logs\v"), [System.Text.Encoding]::Latin1)
```

改完回设置页再点「启动」；或者绕开启动器直接起：

```powershell
$pack = "$env:USERPROFILE\surfcore\state\voice-packs\voice-cloud"
Start-Process "$pack\.venv\Scripts\python.exe" -ArgumentList "-m","voxd","--config","config.toml" `
  -WorkingDirectory $pack -WindowStyle Hidden
```

**验证**（不用等界面）：

```powershell
Invoke-RestMethod http://127.0.0.1:8767/v1/health | Select-Object ok, engines   # cloud.loaded 应为 True
```

> ⚠️ **更新语音包会覆盖 `run.bat`**，这个 0x0B 会回来。更新完记得重打一次。
> 判定"真的通没通"别看按钮，看 `包目录\logs\requests.jsonl`：出现 `"engine": "cloud"` 且 `degraded: []` 就是火山那条链路真的合成了。

### 5.5 别指望它默认会说话

AI 发语音**默认三闸全关**：

| 闸门 | 默认 | 位置 |
|---|---|---|
| `socialV2.voice.enabled` | `false` | 设置 → 语音 → 触发规则 |
| `socialV2.tools.sendVoice` | `false` | 设置 → 工具开关 |
| `tts.enabled` | `false` | 语音页「允许 AI 主动发语音」 |

三个都打开才会出声。另有「一条主人消息最多换一条语音」「主人 10 分钟内说过话」两道限制——这是设计，不是 bug。

### 5.6 重启矩阵（照着做，省一半排查时间）

| 刚才改了什么 | 要重启谁 |
|---|---|
| 切本地 / 云端语音包 | **QQ 桥接**（切包只写盘，桥接内存不刷新） |
| 「允许 AI 主动发语音」/ 触发规则 / 音量 | **QQ 桥接** |
| `tools.sendVoice`（工具开关） | **QQ 桥接 + DSH** |
| 云端密钥 / 音色 ID | **只重启语音包**（`config.toml` 只在进程启动时读一次） |
| 桌宠侧语音 | 不用重启，下一条立即生效 |
| 手动改过 `config.json`（含 `ownerQQ`、`dsh.baseUrl`、白名单） | **QQ 桥接**（重启前先跑 §3.1 的 `sync-dsh-port.mjs`） |
| 装完插件、改了 preset | **完全退出 DSH 再开** |

"完全退出"= 托盘图标也要退，不是关窗口。

> 手工重启桥接的正确姿势（不回话/不弹黑框）：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-qq-bot.ps1` 停，再用 `node src\bridge.js` 以隐藏窗口起。DSH 自己在插件初始化时也会 `autoStartBridge`，所以**完全退出 DSH 再开**是最省事的等效操作。

---

## 6. 你（分享者）千万别做的两件事

1. **别把整个装好的目录打包发出去。**
   `config.json` 里有你的 `ownerQQ`、群号白名单、`consoleToken`，`state/` 里还有聊天记录和日志。要发就发 `git clone` 下来的干净仓库 / 官方安装包。
2. **别把你的火山 AK 和音色 ID 写进分发包。**
   安装器会自动 `stripCloudCredentials()` 清掉预置凭据（作者已经踩过这个坑），但你自己手动打包的项目里可能还留着。用你的 AK = 花你的钱。

---

## 7. 故障表（只列真会遇到的）

| 症状 | 原因 | 解决 |
|---|---|---|
| 设置页找不到 SurfCore | bundle 没装上 / 没重启 | 重跑 `node scripts\setup-dsh.mjs`，**完全退出 DSH 再开**；实在没有就 F5 |
| 激活时报 `Cannot find module '@deepseek-ai/schemastery'` | 先装 bundle 后装依赖了 | 回到仓库根 `npm install`，再重跑 setup |
| `Cannot find module ...\src\xxx.js` | 只装了 `plugins/surfcore` | 必须**从仓库根**安装（有 19 处 `../../../src/*.js`） |
| 桥接起来了但收不到消息 | SnowLuma 没登录 / token 不对 / 端口不是 3000/3001 | 控制台「运行总览」看状态，核对 `config.json` 的 `snowluma.*` |
| 群里 @ 她没反应 | 白名单没加这个群 / 已暂停 / 模式不对 | 设置 → QQ → 白名单 |
| 她只会聊天不调工具 | MCP 没挂上 / 被安全守卫限制 | 重跑 setup-dsh，看设置页工具开关 |
| 控制台 401 | 没带 token | `http://127.0.0.1:3100/?token=<consoleToken>` |
| `npm install` 后启动报 ESM 错 | postinstall 补丁没跑 | `npm rebuild` 或 `node scripts\patch-snowluma-sdk.mjs` |
| 桌宠装完起不来 | Electron 路径不对 | 设置 → 桌宠，重选 `electron.exe` |
| 语音点「安装」一直转圈 | 上面的进度显示缺陷 | 看包目录有没有 `config.toml`；取消再装一次 |
| 语音启动失败「还没填密钥」 | 云端包强制校验三项齐全 | 补 speaker（音色 ID），只填 AK/AppID 不够 |
| 三个值都填了、也保存了，还是报「还没填密钥」 | `voices/` 被 `.gitignore` 排除，干净安装没这个目录 → speaker 被静默丢弃 | 见 §5.3「已知坑」：建目录 + 写 `voice.json` |
| 语音「启动超时」 | 60 秒内端口没起来 | 云端包一般 5~20 秒；超时就先卸载再装，多半是 `.venv` 没建好 |
| 一说话就 403 / 429 | 三闸没开 / 触发窗口过期 / 频率超限 | 见 §5.5、§5.6 |
| 点「启动」一直「处理中」、8767 不监听 | `run.bat` 里 `logs\voxd.out.log` 的 `\v` 被写成 0x0B 控制字符，重定向失败导致整行不执行 | 见 §5.4：一条命令修 `run.bat`，或绕开它直接起 `.venv\Scripts\python.exe -m voxd` |
| 更新一直提示"本地有改动" | 改过被 git 跟踪的文件 | 角色卡放 `%USERPROFILE%\.dsh\surfcore\characters\`，别改仓库里的示例 |
| 桥接一直「DSH 未就绪」/ 控制台 401 但 token 明明是对的 | `dsh.baseUrl` 还是旧的静态端口 | 跑 `node scripts\sync-dsh-port.mjs` 再重启桥接，见 §3.1 |
| 安装日志里 `dsh plugin --profile desktop install 返回退出码 1` | **打包版 DSH 没有 `dsh` CLI**，setup 最后那步必然失败，可忽略 | 验证不是看退出码，是看 `%USERPROFILE%\.dsh\surfcore\pet\host.json` 有没有生成（有 = 插件真的加载了） |
| `node scripts\verify-dsh-020-adaptation.mjs` 报 `Cannot find module '@deepseek-ai/dsh-persona'` | 打包版 DSH 的依赖在 `app.asar` 里，没有开发态的 profile `node_modules` | 这条体检只对开发态 checkout 有效；打包用户用设置页「诊断 → 环境体检」代替 |
| 语音装到一半报「GPT-SoVITS 依赖安装失败」 | `.venv-gsv` 缺 setuptools，且云端包根本不需要它 | 见 §5.1 的判定三件套，直接删 `.venv-gsv` |

体检命令（在仓库根跑）：

```powershell
node scripts\check-onebot-status.mjs          # OneBot 连通性（只读）
node scripts\sync-dsh-port.mjs --print        # DSH 实际端口 vs config.json（只读）
node scripts\verify-dsh-020-adaptation.mjs    # DSH 版本逐项复核（仅开发态 checkout 可用）
```

---

## 8. 直接复制发群的文案

> **【SurfCore 装法 · 20 分钟】**
> 前提：Win10/11 + Node ≥22.13 + 已装 DSH(≥0.2.1-rc.2) + SnowLuma 已扫码登录。
> ① 解压我发的 zip，双击 `2-安装.bat`，等它跑完（3~10 分钟，别关窗）；
> ② **完全退出 DSH**（托盘也退）再打开；
> ③ 设置 → SurfCore → 诊断 → 一键安装（全部）→ 填自己的 QQ、勾要放行的群；
> ④ 群里 @ 她一下，回话就成了。
> 想要桌宠：设置 → 桌宠 → zip 地址填 `https://github.com/Mieksido/surfpet/releases/download/v0.2.3/pet-pack.zip`，Electron 路径选你机器上的 `electron.exe`，装完点启动。
> 想要云端语音（先装个 Python 3.12，勾 Add to PATH）：设置 → 语音 → 云端包点「安装」→ 填自己的火山 AppID / AccessKey / 音色 ID → 启动 → 打开「允许 AI 主动发语音」→ 重启 DSH 和 QQ 桥接。
> 卡住了双击 `3-自检.bat`，把 `诊断报告.txt` 发我。

---

## 9. 参考

- SurfCore：https://github.com/Mieksido/surfcore （README / `docs/guides/INSTALL.md`）
- 桌宠：https://github.com/Mieksido/surfpet/releases
- 云端语音：https://github.com/Mieksido/surfvoicecloud
- 本地语音（免费、需 6G+ 显存、约 1.8 GB）：https://github.com/Mieksido/surfvoicelocal
- 维护者文档：`docs/guides/ARCHITECTURE.md`、`SUBSYSTEM-VOICE.md`、`SUBSYSTEM-PET.md`、`PITFALLS.md`
