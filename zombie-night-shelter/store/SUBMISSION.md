# CrazyGames 提交资料 · Last Door Standing

> 用法：打开 CrazyGames Developer Portal → **Submit game**，按下面的顺序对着填。
> 英文框里的内容直接复制粘贴（游戏页面是英文的，CrazyGames 要求必须有英文）。
> 【需你自己填】= 只有你知道的个人或账号信息。

---

## ★ 重新提交（第二次被以“整体质量不达标”拒绝后）

**提交前先确认一件事：** 开发者后台 Last Door Standing 条目里的游戏文件，必须是这份 `dist/last-door-standing.zip`。
预览时应该看到 “Last Door Standing” 的加载条，右侧显示 **SDK 已检测到**、总大小约 **3.3 MB**。
如果看到的是别的游戏（比如 Fortress Front）、大小不是 3.3 MB、或者提示 “SDK not currently detected”，说明传错包了，先删掉重新上传。

这一轮查出并修掉的问题（都是之前本地测试覆盖不到的）：

1. **开局太闷**：真人节奏下，第 1 晚前 43 秒什么都不发生，然后 Boss 只打邻居的门、17 秒被打死，玩家自己的门一下没被碰过就通关了。
   现在：进房间就有 50 废料可用；锁门后几秒就有小僵尸上门（击杀给废料）；头目 Boss 从第 1 晚起就直奔玩家的门；前 3 晚 Boss 更耐打但伤害更低，战斗持续约 1 分钟。
2. **平台上加载慢**：游戏在等 SDK 的广告拦截检测（平台上最多 5 秒）。现在不等了，模拟平台环境下约 1 秒进标题。
3. **Basic Launch（广告关闭）下有“死按钮”**：门被打破后弹出的“看广告继续”点了没反应。现在广告不可用时直接进结算，所有广告按钮一开始就隐藏。
4. **iframe 里“重置进度”无效**：浏览器会屏蔽跨域 iframe 里的 `confirm()` 弹窗。改成了按两次确认。
5. **低配设备卡顿**：加了自动降画质（低于约 25 帧时自动降分辨率和特效）。
6. 其他：`loadingStart` 之前没有真正发出去；`happytime` 改为只在首次三星时触发；切到后台时静音；AZERTY 键盘可以用 ZQSD 跑动。

提交表单如果有“给审核的备注 / Notes for QA”，可以直接粘贴这段：

```
Thanks for the feedback. This update is a full quality pass on gameplay, layout and platform integration:
- Gameplay: there is action from the first seconds of every night. Scout zombies reach the doors during the build phase (kills pay scrap), the lead boss attacks the player's own door from Night 1, and early boss fights last about a minute instead of ending in 15 seconds. Players start with enough scrap for a first bed upgrade and turret, and nobody waits once every survivor has a room.
- Layout: the whole UI scales to the iframe. Every screen and button fits at 800x450, 907x510, 1077x606, 1216x684, 1366x768, 1920x1080 and on phones (portrait and landscape).
- Readability: one message lane (no overlapping tutorial / banners / toasts / tooltips), shorter texts, combined damage numbers.
- First minute: PLAY starts the tutorial night immediately (1 click); the tutorial is short and skippable.
- Platform: loads in about 1 second on CrazyGames, reports loadingStart/Stop and gameplayStart/Stop, hides every rewarded-ad button when ads are disabled (Basic Launch / adblock), and lowers render quality automatically on slow devices.
- Visuals: rooftop backdrop and building shadow, redrawn stairwell, softer wall shadows, cleaner door and boss bars.
```

## 0. 要上传的文件（全部已备好）

| 用途 | 文件 | 规格（官方要求） | 状态 |
|---|---|---|---|
| 游戏包 | `dist/last-door-standing.zip`（运行 `tools/package.sh` 生成） | HTML5；`index.html` 在 zip 根目录；总大小 ≤ 250 MB，文件数 ≤ 1500，首次下载 ≤ 50 MB（手机首页推荐要求 ≤ 20 MB） | ✅ 约 3 MB，180 个文件，只用相对路径（**请上传这次新生成的 zip**） |
| 横版封面 | `store/cover_1920x1080.jpg` | 16:9，1920×1080 | ✅ |
| 竖版封面 | `store/cover_800x1200.jpg` | 2:3，800×1200 | ✅ |
| 方形封面 | `store/cover_800x800.jpg` | 1:1，800×800 | ✅ |
| 横版预览视频 | `store/video/preview_landscape_1920x1080.mp4` | 1080p 16:9，15–20 秒，≤ 50 MB，无声音 | ✅ 16.3 秒，11 MB，H.264，无音轨 |
| 竖版预览视频 | `store/video/preview_portrait_1080x1620.mp4` | 1080p 2:3，15–20 秒，≤ 50 MB，无声音 | ✅ 16.3 秒，约 9 MB，H.264，无音轨 |
| 截图（如表单需要） | `store/screenshots/*.png` | 1280×720 | 可选 |

封面已按规则检查：除了游戏标题没有任何文字，没有边框、图标或商店 logo，三张风格统一。
视频已按规则制作：第一帧是封面，之后是真实 1 倍速的游戏画面，中间几段用淡入淡出衔接（没有黑屏转场），没有黑边、鼠标指针、“Play now”之类的宣传字或声音。
如果要重新生成：`node tools/trailer.cjs landscape <dir>/landscape && node tools/trailer.cjs portrait <dir>/portrait && tools/trailer.sh <dir>`。

---

## 1. 基本信息

| 字段 | 填写 |
|---|---|
| Game name / 游戏名 | `Last Door Standing` |
| Developer / Studio name | 【需你自己填】 |
| Engine / Technology | `HTML5 (vanilla JavaScript + Canvas 2D, no engine)` |
| CrazyGames SDK integrated? | `Yes – HTML5 SDK v3`（`index.html` 里已引用 `https://sdk.crazygames.com/crazygames-sdk-v3.js`） |
| Launch type | `Basic Launch`（首次提交都是这一档，这时广告会被关闭） |
| Multiplayer | `No`（队友是 AI 邻居） |
| In-game purchases | `No` |
| Account integration (User module) | `No` |
| Progress saving | `Yes – SDK Data module (with localStorage fallback)` |
| Language | `English` |
| Released on other platforms? | `No`（如果你在别处发过，按实际填） |
| Target audience / age | `13+`（卡通僵尸，没有血腥，符合 PEGI 12） |

## 2. 分类与标签

| 字段 | 建议 |
|---|---|
| Category / 主分类 | **Tower Defense**（如果没有这个选项，选 **Strategy**；再不行选 **Casual**） |
| Tags / 标签（按顺序挑表单里有的） | `Zombie`, `Tower Defense`, `Survival`, `Base Building`, `Idle`, `Upgrade`, `Strategy`, `2D`, `Mouse`, `Casual` |

## 3. 设备与方向

| 字段 | 填写 |
|---|---|
| Desktop | ✅ Yes |
| Mobile | ✅ Yes（支持触控：点按、拖动平移、双指缩放） |
| Tablet | ✅ Yes |
| Orientation | `Both (landscape & portrait)`；电脑上是横屏。如果只能选一个，选 **Landscape** |
| Input | Mouse, Keyboard (optional hotkeys), Touch |

## 4. 简短描述（Short description，≈160 字符）

```
Grab an apartment, lock the door and build turrets! Survive the zombie bosses until dawn – or team up with your neighbours to take them down.
```

## 5. 完整描述（Description / About the game）

```
The zombies are coming and the whole apartment floor is running for cover!

Last Door Standing is a cartoony idle tower defense game. When the night begins you and three other survivors dash down the hallway to claim an apartment. Once you're inside, the door slams shut – and that door is your life bar.

Lie down on your bed to earn scrap every second, then spend it wisely:
- Upgrade your bed to double your income – but fancy beds need a sturdier door first.
- Build turrets on your floor: rapid Nail Guns, armor-piercing Crossbows, Fire Sprayers, splash-damage Mortars and chain-lightning Tesla Coils.
- Power up with Generators, slow zombies with Chill Traps, earn passive scrap with a Vending Machine, auto-fix your door with a Repair Bench and more.
- Repair or upgrade your door before the bosses smash through.
- Throw Flashbangs to stun bosses mid-swing and Molotovs to set them on fire.

Turrets cover the hallway, so neighbours protect each other – and you can send scrap to your allies or pay to repair and reinforce their doors. Help them and they'll return the favour. But beware: a pack of bosses prowls the floor every night (2 at first, up to 6), one of them hunting you, and every door they break makes them stronger. Fallen survivors rise as zombies that join the hunt!

Survive until dawn for one star, keep every ally alive for two, and destroy every boss while at least one neighbour is still standing for three. Collect medals to buy permanent upgrades, unlock 12 survivors with their own bonuses, and take on 22 handcrafted nights with six boss types – the Brute, the acid-spitting Spitter, the door-slamming Charger, the Howler, the armored Riot Tank and the Abomination. Then see how many waves you can last in Endless mode.
```

## 6. 特色列表（Features，如果表单有单独的框）

```
- 22 handcrafted nights + Endless mode
- 2 to 6 bosses every night, 6 boss types with unique abilities, plus waves of minions
- 11 upgradeable buildings, including 5 turret types
- Flashbang & Molotov abilities, parachuted supply crates, daily supplies
- Co-op with AI neighbours: send scrap, repair or reinforce their doors – they help you back
- 12 unlockable survivors, each with a unique bonus
- Permanent upgrades and 3-star ratings for every night
- Interactive tutorial on Night 1
- Mouse-first controls with hotkeys, full touch support
```

## 7. 操作说明（Controls / Instructions）

```
Mouse: click a free apartment to claim it, click empty floor to build, click a building to upgrade or sell it, click your bed or door for options, click a neighbour's room to help them.
Hotkeys: Q Flashbang · E Molotov · B upgrade bed · R repair door · U upgrade door · 0–9 build on the hovered tile · Z zoom · P pause · Esc close menu
WASD / Arrow keys: run through the hallway during the room rush
Mouse wheel / pinch: zoom · Drag: move the camera
Touch: tap to select, drag to pan, pinch to zoom
```

## 8. 合规自查（QA 会检查的项目，已全部处理）

| 规则 | 本游戏 |
|---|---|
| 必须调用 `gameplayStart`（Basic Launch） | ✅ 每晚开始和继续时调用；暂停、菜单、结算和广告期间调用 `gameplayStop`；切出页面（失去焦点）时**不**调用 stop（平台自己会处理） |
| `loadingStart` / `loadingStop` | ✅ 包住资源加载过程 |
| Basic Launch 关闭广告时不能留“点了没反应”的广告按钮 | ✅ SDK 返回 `adsDisabled` 或 `adblock` 时，所有广告按钮在本次游戏中自动隐藏；检测到广告拦截器（`hasAdblock`）时也会隐藏 |
| 激励广告按钮不能出现在正在进行的游戏画面上 | ✅ 只出现在四个地方：开局前的 **Head start**、门被打破后的 **Continue**、结算页的 **Double medals**、每日奖励的 **Claim double**，局内 HUD 里没有广告按钮 |
| `adError` 时不能给奖励 | ✅ |
| 广告期间暂停游戏并静音 | ✅ |
| 插屏广告只在关卡之间，且最多每 3 分钟一次 | ✅ 本次游戏的第一晚不放 |
| 不要用 Esc 当操作键（Esc 会退出全屏） | ✅ Esc 只用来关闭菜单，暂停改用 P |
| 不能自带全屏按钮 | ✅ 没有 |
| 不能有跨平台推广或外链 | ✅ 没有 |
| body 设置 `user-select: none` | ✅ |
| 只用相对路径 | ✅ |
| 必须有英文 | ✅ |
| 4 GB 内存的设备能流畅运行 | ✅ 60 FPS，JS 堆内存约 10 MB |

## 9. 只有你能填的项目

- CrazyGames 开发者账号、收款方式（每月结算，满 €100 才付款）、税务信息
- Developer / Studio 名称、联系邮箱
- 隐私政策 URL（如果表单要求）：游戏本身不收集个人数据，存档只用 SDK Data 和 localStorage
- 发布日期

## 10. 以后升级到 Full Launch 时要补的

- 新玩家“点 1 次就进入游戏”的要求已经做到：第一次点 PLAY 直接进入第 1 晚教程。
- Full Launch 才会开广告收益，现有的广告接入已经满足上面的规则。

---

参考的官方文档：
https://docs.crazygames.com/requirements/intro/ ·
https://docs.crazygames.com/requirements/game-covers/ ·
https://docs.crazygames.com/requirements/technical/ ·
https://docs.crazygames.com/requirements/ads/ ·
https://docs.crazygames.com/sdk/game/
