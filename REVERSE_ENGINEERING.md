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

## 5. 本复刻的实现取舍

原站是重型 WebGL 体验（自研引擎 + 烘焙 PBR 场景 + 二进制几何），无法在纯前端逐帧复刻其 3D 场景。本复刻聚焦**结构、内容、视觉语言与交互**的还原：

- 真实字体、真实项目数据、真实项目图（已本地化，63/65 项目有本地图）。
- 黑底 + 冷色高光 + 网格/Hex 纹理 + 大标题排版，还原 Active Theory 的视觉调性。
- 单页路由：Home / Work / Work Detail / About / Contact，Hash 路由模拟 `Router/state`。
- 自绘 WebGL/Canvas 粒子与鼠标视差，模拟原站的动态氛围（不依赖自研引擎）。
- 响应式、无障碍降级（无 WebGL 时用静态渐变背景）。
