# Letter Legion — CrazyGames 上线填写单

对着 CrazyGames 开发者后台（developer.crazygames.com → Submit a game）一项项填即可。代码块里的英文直接复制粘贴。

> 说明：CrazyGames 官方文档没有公开上传表单的确切字段名和字数上限。下面按表单常见内容整理，后台字段名可能略有不同，找到对应项填进去即可。

---

## 一、要上传的文件

| 用途 | 文件（在 `letter-legion/` 下） | 规格 |
|---|---|---|
| **游戏包** | `release/letter-legion-v1.0.zip` | 3.6 MB；53 个文件；`index.html` 在 zip 根目录 |
| 横版封面 16:9 | `store/cover_1920x1080.jpg` | 1920×1080，画面里只有游戏标题文字 |
| 竖版封面 2:3 | `store/cover_800x1200.jpg` | 800×1200 |
| 方形封面 1:1 | `store/cover_800x800.jpg` | 800×800 |
| 横版预览视频（必填） | `store/video/preview_landscape_1920x1080.mp4` | 1080p，18.5 秒，无声，6.8 MB，第一帧就是封面 |
| 竖版预览视频（必填） | `store/video/preview_portrait_1080x1620.mp4` | 1080×1620（2:3），18.5 秒，无声，6.5 MB |
| 截图（如需要） | `store/screenshots/*.jpg` | 1920×1080，9 张 |

以后改了代码要重新打包：在 `letter-legion/` 下运行 `./build_release.sh 1.1`，会生成 `release/letter-legion-v1.1.zip`。

---

## 二、逐项填写

**Game name / 游戏名**
```
Letter Legion
```

**Technology / 引擎**：HTML5（纯 JavaScript，无引擎，无需构建）
**Main file / 入口文件**：`index.html`

**SDK**：已接入 CrazyGames HTML5 SDK v3。用到了 loading、gameplay、happytime、midgame 广告、rewarded 广告和 data 存档。

**Orientation / 方向**：Landscape（横屏）。竖屏手机也能玩；如果后台有"Both / 两者都支持"就选它。

**Mobile / 手机支持**：Yes，支持触屏，手机横屏和竖屏都适配。

**Multiplayer / 多人**：No。只有单人对战电脑，所有对手都标明了是 CPU。

**In-game purchases / 内购**：No

**Languages / 语言**：English

**Age / 内容分级**：符合 PEGI 12。只有卡通奇幻战斗，没有血腥、文字聊天或用户生成内容，不面向儿童。

**Category / 分类**
```
Strategy
```
这是塔防游戏。如果分类里有 Tower Defense，也可以直接选它。

**Tags / 标签**（从后台列表里勾选）
```
Tower Defense, Merge, Word, Strategy, Casual, Fantasy, Cartoon, 2D, Upgrade, Mouse
```

**Short description / 一句话简介**（152 个字符）
```
Summon living letters, merge them into stronger soldiers and SPELL heroes like K-I-N-G and M-A-G-E to defend baby Prince Pip in this tower defense duel!
```

**Description / 游戏介绍**
```
In the cheerful kingdom of Letterland every soldier is a living letter, and baby Prince Pip needs all of them!

Duel a computer-controlled rival on mirrored battlefields. Spend Ink to summon blind-box recruits: the sword-swinging S, the lance-thrusting L, the bow-bending B and the galloping K. Drop two identical letters of the same level onto each other to merge them into a stronger, shinier soldier. Cells are scarce, so every keep-or-merge choice matters.

Lucky summons bring golden hero letters. Line them up left to right in one row to spell a hero's name: KING, MAGE, MONK, HAWK, NINJA, DRUID, TITAN or SAINT. The letters fuse into a hero with a spectacular special skill: meteors, arrow storms, shadow flurries, quake shouts and more.

Outlast your rival: whoever keeps their ward safe the longest wins.

Features:
- Random-summon merge tower defense with a word-spelling twist
- 8 heroes with unique skills that level up when you spell them again
- 4 hand-crafted maps: Ember Plains, Misty Marsh, Crimson Bay and Iron Gate Pass
- A ladder of 9 CPU rivals, each with their own personality
- Weapon drops in five rarities, an item shop and a limited loadout
- Daily Duel with the map, seed and buff of the day, plus your personal best board
- 1-minute tutorial, 1x/2x speed, mouse and touch support

All rivals are computer-controlled. No account needed: your progress is saved automatically.
```

**Controls / 操作说明**
```
Mouse / touch: click SUMMON, then drag recruits from the tray onto cells (or click a recruit, then a cell).
Drop a letter on the same letter of the same level to merge them.
Place golden letters in one row, left to right, to spell heroes.
Drag a letter onto the X bin to sell it. Click a locked cell while holding a shovel to dig it.
When your board is clear, click the wave bar to call the next wave early for bonus Ink.
Keyboard (optional): Space = summon, 1-3 = auto-place a recruit, N = next wave, Q/W = items, F = speed, Esc = pause
```

**以下几项按你自己的情况填**：
- 开发者 / 公司名、联系邮箱
- 是否已在其他平台发布：目前没有
- 应用商店链接：无（游戏里也没有任何外链）

---

## 三、CrazyGames 要求核对（2026-11-06 对照官方文档）

依据的文档：requirements/technical、gameplay、ads、game-covers、quality 等页面。✅ = 已满足并实测；⚠️ = 需要你在官方预览工具里再确认一次。

### 技术要求
| 要求 | 结果 |
|---|---|
| 总大小 ≤ 250 MB | ✅ 3.8 MB |
| 文件数 ≤ 1500 | ✅ 53 个 |
| 初始下载 ≤ 50 MB（上手机首页要 ≤ 20 MB） | ✅ 约 3.1 MB 后显示标题页，全部资源 3.8 MB |
| 进入游戏时间 ≤ 20 秒 | ✅ 模拟 1.6 Mbps / 150 ms 慢网速，12.8 秒显示标题页 |
| 只用相对路径 | ✅ 扫描过，没有绝对路径 |
| 唯一外部资源是 SDK | ✅ |
| Chrome / Edge 能跑 | ✅ Chromium 下全部自动化测试通过，无报错 |
| 鼠标、键盘、触屏都支持 | ✅ |
| 桌面横屏可玩 | ✅ |
| 移动端 `user-select: none` | ✅ |
| iOS 音频在 touchend / click 时解锁 | ✅ |
| Sitelock | 不需要（官方说是可选的） |
| SDK：loadingStart/Stop、gameplayStart/Stop 成对调用，进度存 data 模块 | ✅ 用模拟 SDK 测过：开始/停止成对，存档走 data 模块 |

### 玩法与内容
| 要求 | 结果 |
|---|---|
| 官方列出的 10 种 iframe 尺寸下文字都可读（DPR 1） | ✅ 907×510、821×462、800×450 等矮屏改用加大字体的紧凑版界面；所有尺寸都截图检查过，自动测试确认界面元素互不重叠 |
| 不同刷新率下游戏速度一致 | ✅ 固定 60 Hz 逻辑步长，速度不随帧率变化 |
| 英文 | ✅ |
| 没有自带全屏按钮 | ✅ |
| 没有交叉推广、外链、应用商店链接 | ✅ 扫描过，没有任何链接或 `window.open` |
| 内容原创 | ✅ 名字、角色、美术都是原创；字体是 OFL 开源授权，许可证文件已附带 |
| 符合 PEGI 12，不面向儿童 | ✅ |
| 新玩家最多点 1 次就进入游戏（Full Launch 要求） | ✅ 加载完 → 点一次 "PLAY — 1-MIN TUTORIAL" → 直接进入可玩的教程 |
| 没有报错或崩溃 | ✅ 自动化测试全部通过：模糊测试、浏览器乱点测试、教程、完整胜负局、性能 |

### 广告规则
| 要求 | 结果 |
|---|---|
| Basic Launch 阶段广告被关闭时不能出现"点了没反应"的激励按钮 | ✅ 启动时检测到 `adsDisabledBasicLaunch` 就隐藏所有广告按钮，用模拟 SDK 测过 |
| 战斗进行中不出现广告或激励按钮 | ✅ 原来局内的"免费召唤 / 免费铲子"已移除，改成战前页面的"Head start"加成 |
| 激励广告有非广告的替代方式 | ✅ Head start 可以用 50 金币买；商店刷新可以用 40 金币 |
| 激励广告失败不给奖励 | ✅ |
| 同一个关卡间隙里不能既有激励广告又有插屏广告 | ✅ 结算页看过"双倍金币"后，本次不再播放 midgame，模拟 SDK 测过 |
| 插屏广告每 3 分钟最多 1 次，开局时不播 | ✅ |
| 广告期间游戏暂停 | ✅ |
| 只在广告真正开始后静音 | ✅ |
| 不惩罚装了广告拦截的玩家，被挡的功能有提示 | ✅ 检测到拦截时显示 "Ad bonus unavailable (ad blocker)"，金币选项照常可用 |

### 封面与视频
| 要求 | 结果 |
|---|---|
| 三张封面尺寸 | ✅ 1920×1080、800×1200、800×800 |
| 封面无边框、只有游戏名文字、没有 Play Now 或图标 | ✅ |
| 横竖两个 1080p 预览视频（必填） | ✅ |
| 视频 15–20 秒、≤ 50 MB | ✅ 18.5 秒，6.8 / 6.5 MB |
| 视频无声、不快进、没有鼠标指针、没有黑屏过渡 | ✅ 按真实速度逐帧录制，没有音轨 |
| 视频第一帧和封面一致 | ✅ 开头 1 秒是封面，再淡入实际游戏画面 |

### ⚠️ 自动测试覆盖不到、建议你在官方预览工具里点一遍的
1. **Safari / iPhone 和 Firefox**：本环境只有 Chromium，没有在真机 Safari 和 Firefox 上跑过。代码避开了已知的兼容问题（WebP 要 Safari 14+，ES modules，iOS 音频在 touchend 时解锁）。官方的规则是"在 Safari 上表现不好的游戏会对 Safari 用户关闭"，不会因此被拒。
2. **真实 SDK 环境**：广告和 SDK 只用模拟 SDK 测过两种模式（Basic / Full）。上传后在后台的 Preview / QA 工具里过一遍：开一局、打完、点 Continue，确认能正常回到大厅。
3. **4 GB 内存的 Chromebook 流畅度**：没有实机测过。目前运行时 JS 内存稳定在 4–6 MB，桌面上一直是 60 fps。

---

## 四、上线后的流程

1. **Basic Launch**：先小范围上线至少 7 天并达到 500 次游玩（或 21 天后自动结束）。这个阶段广告由平台关闭，游戏会自动隐藏所有广告按钮。
2. 官方根据平均游玩时长、留存、进入游戏的转化率决定是否转为 **Full Launch**。转为 Full Launch 后广告自动生效，不需要重新提交游戏包。
3. 之后更新：重新打 zip 上传即可。官方说更新当天审核；Basic Launch 阶段的更新会立即生效。
