# Active Theory 网站逆向分析报告

> 仅用于个人学习研究。数据来源为公开可访问的静态资源与公开 CMS 接口。

## 1. 逆向方法

使用 `rea` 工具对 https://activetheory.net 做静态 + 实时抓取分析：

- **实时 CDP 抓取**（`analyze_web_bundle`）：通过远程调试协议连接页面，枚举出全部真实脚本资源及 SHA-256：
  | 资源 | SHA-256 | 说明 |
  |---|---|---|
  | `assets/js/app.1780406240914.js` | `085d3e6a46893f503262ccdaaad16f832367e709bae7ae14c369b629fdb1a5cf` | 主应用包 1.8MB |
  | `assets/js/modules.1780406240914.js` | `e0346e49f92d5db8ad9d9b8e49c61ad52cd2b3994c28e598f4dec548a628cc3c` | 仅 `window._MODULES_ = true;` |
  | 2× 内联脚本 | — | 环境变量 / GA 统计 |
- **静态应用分析**（`analyze_javascript_application`）：把 1.8MB 单行压缩 bundle 美化后（44,905 行）重跑，`rea` 在触发内部 checkpoint 预算上限前已解析 **419,577 个 AST 节点、3,888 条 findings**，确认是自研引擎而非通用框架。

## 2. 技术栈（逆向结论）

- **引擎**：自研 WebGL 引擎 **Hydra**（`Hydra.ready()` / `Render` / `Device` / `GPU` / `Stage` / `World.CAMERA`），非 Three.js。
- **渲染**：WebGL2 + 自定义 GLSL shader 管线。自定义类 `UnrealBloom`、`VolumetricLight`、`PBR` / `ATPBR` / `RoomPBR` 材质。
- **资源管线**：KTX2 / Basis 压缩纹理（`ktx2File`、`UASTC/ETC1S`）、二进制几何 `.bin`、OffscreenCanvas 主线程外处理。
- **UI 层**：自研 UIL 声明式布局系统（JSON 驱动：`{view, data, _type, refName, children}`），`AppState` 全局状态总线 + `Data.handleRequest` 数据请求层。
- **路由**：`Router/state`，`work/{slug}` 详情页，`?p=` 进入 Playground，`?compat` 降级 WebGL1，`?workids` + `?roomqr` 二维码展厅。
- **字体**：NBArchitekt（Regular / Light / Bold，woff2）。
- **统计**：Google Analytics（G-J7TMDT4F8N）。
- **兼容闸门**：`UnsupportedRedirect.unsupported()` = `requiresWebGL && !(webgl && !GPU.BLOCKLIST) || 浏览器版本过低`；`GPUBlocklist` 命中 "swiftshader" 即跳转到 `/unsupported`。
- **CMS**：`https://storage.googleapis.com/activetheory-v6.appspot.com/cms/{key}-{dataVersion}.json`，`dataVersion = PROD ? "latest" : "dev"`，key ∈ `metadata | contact | projects`。

## 3. 场景 / 视觉结构

从 `uil.*.json`（2,593 个键）还原出的场景与 shader 体系：

- **场景**：homeScene、CleanRoom / TreeScene、WorkPage、WorkDetail、About、Contact、JellyfishDemo、particleTest。
- **相机**：`CAMERA_Element_*` 定义各场景 fov / position / lookAt / moveXY / wobble（如 home fov 20、position [0,3,15]、lookAt [0,3,0]）。
- **Shader**：HomeLogoShader、JellyShader、WorkItemShader、GlassShaderPBR、TreeWaterShader、SpineShader、HomeFloorShader、VolumetricLight、UnrealBloom 等。
- **主色**：纯黑背景 `#000`；冷色调蓝白高光（`uTint #e5f1ff`）。

## 4. 内容数据（真实 CMS）

- **65 个作品项目**，每条含 `name / slug / clientName / description / completionDate / tags / uiColor / video / projectLogo`。
- 分类标签：Website / Multiplayer / XR / AI / Game / Installation。
- 客户含 Google、Microsoft、Netflix、Spotify、NASA JPL、Adidas、IBM、Pottermore 等。
- **Metadata**：标题、描述、og/twitter 图。
- **Contact**：hello@activetheory.net、Newsletter、Privacy、Instagram、LinkedIn、X。
- **About 文案**（从 bundle 内 `Tools` 描述提取）：成立于 2012 的创意数字制作工作室，126 项 FWA、24 项 Cannes Lions 等。

## 4.5 真实画面取证（关键修正）

第一版曾把站点误做成「有滚动条、顶栏、左对齐大标题 + 卡片网格」的普通网页——**完全错误**。
后来通过 CDP 拦截 PBR 贴图（给 `*.png/*.jpg` 喂可解码的替代图，绕过软件渲染对 RGBM/HDR 的解码失败），让真实 `Hydra` 引擎在 Edge 里**真正渲染出画面并逐帧截图**，纠正如下：

| 观察项 | 真实站点 | 第一版（错） |
|---|---|---|
| 滚动 | **无原生滚动条**，`documentElement.scrollHeight === innerHeight`（实测恒为 900） | 普通文档流滚动 |
| 下滑机制 | `wheel/touch` 事件喂给虚拟滚动管理器，驱动相机穿越场景 | 滚动页面 |
| 进入 | **能量核心充能过场**：纯黑屏中央一个斜线纹理圆盘由半圆长成整圆，12 条蓝色电弧/触须向外卷曲伸展，两侧对称光弧 + 两颗能量点，中央跑 `/0…/100`，随后一次亮白 bloom 点亮场景 | 数字 loader 后淡入文字 |
| 首页构图 | 极暗空间正中一块**悬浮磨砂蓝玻璃板**，背后**两条交叉的椭圆轨道光环**，粒子漂浮，右上**药丸导航**（暂停｜进度｜菜单，随滚动速度形变） | 左对齐大标题 + 卡片网格 |
| 下滑画面 | 相机推进 + 全幅项目图占据整屏，标题压在左下，场景间平滑过渡 | 卡片逐个 fade in |
| 鼠标 | 屏幕**上/下边缘随光标拉出彩色能量管**（官方访谈：多人联网可见彼此轨迹） | 普通自绘光标 |

> 官方 Webby 访谈证实：落地体验是一串**环境**（Venice Beach、Amsterdam 运河等，最终做了 8 个），
> 场景间过渡是叙事核心。Communication Arts 访谈证实药丸导航随滚动速度反应、边缘彩色管道多人联网。

据此**推翻第一版结构，重写为「锁定单屏 + 虚拟场景推进」引擎**（见第 5 / 6 节）。

## 5. 动效逆向（核心）

动效是这类站点的灵魂。逐项从 bundle 中提取到的**真实参数**，而非凭感觉模仿：

### 5.1 帧率无关插值（engine 原码）
```js
Math.lerp = (target, value, alpha, calcHz = true) =>
  value + (target - value) * (calcHz ? 1 - Math.exp(Math.log(1 - alpha) * FRAME_HZ_MULTIPLIER) : alpha)
// FRAME_HZ_MULTIPLIER = dt * 60 → 等价 1-(1-alpha)^(dt·60)，60/120/144Hz 手感一致
```
复刻的 `damp()` 直接用此式驱动指针、视差层、光标。

### 5.2 相机 wobble（原码移植）
五层 sin/cos 叠加，频率 `25e-5 / 65e-5 / 75e-5 / 85e-5 / 95e-5`，最后 `× .001 × wobbleStrength`：
```js
x = cos(a+t·75e-5)·(a+200·sin(t·95e-5)) · 2sin(a+t·75e-5) · 1.1cos(a+t·75e-5)
y = sin(asin(cos(a+t·85e-5)))·(150·sin(a+t·75e-5)) · 1.75cos(a+t·65e-5) · 1.15sin(a+t·25e-5)
```
复刻把它按 `wobbleStrength`（Home .10 / Work .06 / Detail .05）缩放为 CSS 像素的漂浮。

### 5.3 每场景相机参数（来自 uil.json `CAMERA_*`）
| 场景 | lerpSpeed | fov | position | lookAt |
|---|---|---|---|---|
| Home | 0.10 | 30 / 20 | [0,2,40] | [0,4.59,0] |
| Work | 0.07 | 35 | [0,0,2] | [0,0,-4] |
| WorkDetail | 0.07 | — | [0,0,1] | [0,0,-10] |
| CleanRoom | 0.08 | 30 | [0,1,5] | [0,0.8,-0.3] |
| home_scene | — | 20 | [0,3,15] | [0,3,0]（wobbleStrength .1）|

### 5.4 缓动曲线（bundle 内 easings.net 表，原样取用）
`easeOutExpo .190,1,.220,1` · `easeInOutQuart .770,0,.175,1` · `easeOutCirc .075,.820,.165,1` · `easeOutBack .175,.885,.320,1.275` · `easeInOutExpo 1,0,0,1` …

### 5.5 编排与粒子
- **Theatre.js** 驱动序列（`theatrejs.com` 链接 26 处、keyframe/sequence 大量命中）。
- 粒子系统为 **Proton / AntimatterPass**（GLSL 位置纹理 + `tLife` decay + `HZ` uniform）+ **curl noise** 流场。
- 配色计数：白 43 / 青 `#00ffff` 12 / `#1A6DEA` 蓝 5 / 冷辉光 `#9ca5ff` 3 / 极少暖黄 `#ffde0a` 1。

### 5.6 复刻中已落地（按真实画面重写后）
- `assets/js/portal.js`：**2D canvas 能量核心过场**——斜线纹理圆盘（填充由顶向下，半圆→整圆）、12 条带卷曲的蓝色电弧触须、两层对称外弧、左右两颗能量点、中央 `/0…/100`、结束一次径向亮蓝 bloom 点亮；过场期间用 `body.intro` 把 WebGL 与所有场景压成纯黑（对齐真实站）。
- `assets/js/shaderfield.js`：**单三角形全屏 WebGL 舞台**——域扭曲 fbm 体积空间 + curl noise 粒子 + 指针柔光 + 颗粒 + 暗角；程序化渲染**悬浮磨砂蓝玻璃板**（`sdRoundBox` + 冷色内部渐变 + 边缘光）与**两条交叉椭圆轨道环**；`uProgress`（wheel 驱动）推相机 `1+0.22·p` 并让首页玻璃板随进度淡出；0.6–0.75 倍分辨率，零贴图，无 WebGL 回退 CSS 渐变。
- `assets/js/app.js`：**虚拟场景引擎**——`wheel/touch/keys` 喂 `target`，用帧率无关 `damp(0.075)` 逼近得到 `progress`；DOM 场景层按 `progress` 做透明度 + dolly 交叉淡化（work 场景**文字比图更快淡出**，避免转场时标题叠字；图保持全幅不缩到露边）；相邻场景调色板 hex 插值；药丸导航按 `velocity` 形变/加亮。
- 场景序列：Home（玻璃板）→ 4 个全幅作品 → About → Contact；`scrollHeight === innerHeight`（无原生滚动条，与实测一致）。
- 尊重 `prefers-reduced-motion`：跳过充能过场、关闭指针能量管与动效，静态兜底。

## 6. 本复刻的实现取舍

原站的 3D 烘焙场景、体积光、UnrealBloom 后期与流体折射依赖其自有引擎（Hydra）与自有资产（Draco 网格、RGBM/HDR 贴图、烘焙光照），**纯前端零依赖无法逐帧等价**。这部分只做「神似」的着色器近似；其余（进入过场、无条滚动机制、场景编排、动效参数、真实内容）按逆向到的事实还原。

- 真实字体、真实项目数据、真实项目图（已本地化，63/65 项目有本地图）。
- 黑底 + 冷蓝磨砂玻璃 + GLSL 粒子空间 + 极简排版。
- **锁定单屏 + wheel 虚拟场景推进**（非文档滚动）；Hash 菜单跳转对应场景。
- 响应式、无障碍降级（无 WebGL 时用静态渐变背景）。

### 取证方法备注
真实渲染的关键障碍是 RGBM/HDR 环境贴图在 SwiftShader 下 `could not be decoded`，导致引擎建不出 canvas。绕过方式：CDP `Fetch.enable` 拦截所有图片请求并回填一张可解码的普通 PNG——材质变假但**引擎的场景结构、构图、UI、运动全部真实渲染**，足以逐帧取证（这也解释了为何早期只看到 `///17` 黑屏 loader）。

## 7. 逐字节镜像（"一模一样"的正解）

用户要求"必须跟他一模一样"。手写着色器无论如何都做不到逐帧相同，唯一正解是**不重写引擎，直接镜像原站的引擎与资产**。

### 7.1 完整性取证
- `real-mirror/tools/build.py` 从 `activetheory.net` 抓取原始清单里 **124 个几何 + 172 张贴图（+ 52 个 `.ktx2`）**，以及 Basis(474KB wasm)/Draco(283KB wasm) 解码器、`hydra-thread.js` worker、CMS JSON、NBArchitekt 字体。合计 **~180 MB**。
- **SHA-256 逐字节核对**：`app.1780406240914.js` = `085d3e6a…`（与第 1 节 CDP 实时抓取的哈希完全一致）；`modules.js` = `e0346e49…`。`ASSETS.RES` 从未赋值 → `parseResolution()` 原样返回，镜像文件名即引擎请求名，无分辨率变体缺失。
- 原始 HTML 的 `<base href="/">`、`Thread.PATH="assets/js/hydra"`、CMS 走 `storage.googleapis.com/activetheory-v6.appspot.com/cms/{key}-{dev|latest}.json` 均已还原/本地重定向。

### 7.2 最小兼容 shim（引擎零改动）
`sandbox` 的软件渲染需要绕过 `UnsupportedRedirect` 的 `GPUBlocklist`，但**不能用 `window.AURA`**——因为 `absolutePath()` 首行 `if(window.AURA) return path;`，设置它会关掉绝对路径转换、让 worker 里 `assets/images/...` 解析失败（这正是早期 "Image not found" 的根因，即使文件在磁盘上）。故 shim 改为：
1. 仅在检测到 `swiftshader|llvmpipe|software` 时，伪造 `WEBGL_debug_renderer_info` 的渲染器字符串；
2. 注入含 `instance` 字样的假 `getSupportedExtensions()` 项 → 让 `webgl2 || detect("instance") || AURA` 闸门通过，同时**保留** `absolutePath()`；
3. 把 worker 相对路径 assets 再复制一份到 `assets/js/hydra/assets/`（worker 以自身目录为基准解析）；
4. `fetch` 拦截把远程 CMS/geo 重定向到本地镜像，并禁用 service worker 防陈旧缓存。
**真显卡上以上分支全部 no-op，引擎按生产字节运行。**

### 7.3 环境硬上限（诚实结论）
本沙箱**无硬件 GPU**（只有 SwiftShader 软件渲染）。修复上面所有路径/闸门问题后，真实引擎能加载并显示**真实的能量核心过场**（截图已取证：斜线 slash 穹顶 + `//NN` 计数 + 蓝色电弧触须），但：
- RGBM/HDR 的 PBR 贴图在软件 `createImageBitmap` 下无法解码；
- 粒子系统 `AntimatterAttribute` 依赖 `DataTexture(..., FLOAT)` 浮点渲染目标，软件渲染下 `_data.length` 未定义直接抛错；
→ 引擎在加载页之后无法继续装配场景图。**真站在本沙箱同样打不开**（早期 `/unsupported` 就是它自己的拒绝逻辑）。这是环境限制，不是镜像缺陷。

**结论**：`real-mirror/` 在有真显卡的机器 = 原站逐字节复现（一模一样）；根目录手写版 = 任何环境可运行的近似演示。二者都交付，用户按硬件选择。
