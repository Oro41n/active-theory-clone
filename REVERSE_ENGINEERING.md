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

### 5.6 复刻中已落地的动效
- `assets/js/shaderfield.js`：单三角形全屏片元着色器——域扭曲 fbm「空气」+ **curl noise 粒子**呼吸 + 指针柔光 + 颗粒 + 暗角；0.55–0.7 倍分辨率渲染，零贴图，WebGL 不可用回退 CSS 渐变。
- `assets/js/app.js`：帧率无关 `damp()`、原码 wobble、`data-depth` 分层视差、词级错峰揭示（`.wd`）、遮罩上推（`.clip`）、路由擦除转场（`.wipe`）、项目 `uiColor` 实时着色氛围、磁吸光标、滚动驱动 shader uniform。
- 尊重 `prefers-reduced-motion`：关闭擦除/视差/粒子动画，静态兜底。

## 6. 本复刻的实现取舍

原站的 3D 烘焙场景、体积光、UnrealBloom 后期与流体折射依赖其自有引擎与资产，**纯前端无法逐帧等价**。这部分只做“神似”的着色器氛围近似；其余（动效参数、结构、内容、排版、交互）尽量按逆向到的真实值还原。

- 真实字体、真实项目数据、真实项目图（已本地化，63/65 项目有本地图）。
- 黑底 + 冷色高光 + GLSL 粒子场 + 大标题排版。
- 单页路由：Home / Work / Work Detail / About / Contact，Hash 路由模拟 `Router/state`。
- 响应式、无障碍降级（无 WebGL 时用静态渐变背景）。
