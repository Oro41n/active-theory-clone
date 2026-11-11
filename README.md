# Active Theory — Study Rebuild

对 [activetheory.net](https://activetheory.net) 做逆向分析后的**个人学习用**复刻。仓库里有**两条路径**，按需选:

| 路径 | 是什么 | 运行条件 | 相似度 |
|---|---|---|---|
| **[`real-mirror/`](./real-mirror/README.md)** | 真站**原始引擎 + 全部真实资产**的本地镜像（SHA-256 逐字节核对），不重写引擎 | 需要**真显卡**（硬件 WebGL） | **逐字节一致 = 一模一样** |
| **根目录 `index.html`** | 从零手写的近似演示（能量核心过场 + 玻璃板场景 + 虚拟滚动） | 任何环境，含无 GPU 的机器 | 视觉/交互接近，非逐帧 |

> ⚠️ 仅用于个人学习与技术研究，非官方项目，请勿用于商业用途。原始设计、引擎、字体、shader、贴图与内容版权归 Active Theory 所有。

**为什么分两条**:真站的粒子系统依赖 GPU 浮点渲染目标，在没有硬件显卡的环境（如本沙箱的 SwiftShader 软件渲染）会直接崩溃、卡在加载页——真站本身在那种环境也打不开。所以「一模一样」只有在**有真显卡的机器**上跑原始镜像才能实现;根目录的手写版是给无 GPU 环境的降级演示。

## 为什么重做

第一版误做成「有滚动条 + 顶栏 + 左对齐大标题 + 卡片网格」的普通网页。通过 CDP 拦截贴图让真实 Hydra 引擎渲染出画面后发现，真站是：

- **没有原生滚动条**（`scrollHeight === innerHeight`），下滑是 wheel/touch 驱动的虚拟场景推进
- **进入是能量核心充能过场**（斜线圆盘 + 蓝色电弧触须 + 百分比 → 亮蓝 bloom 点亮）
- **主页是极暗空间里的悬浮磨砂蓝玻璃板 + 交叉轨道光环**，右上是随滚动速度形变的药丸导航
- 下滑是相机推进、全幅项目图占据整屏、场景间平滑过渡

详见 **[REVERSE_ENGINEERING.md](./REVERSE_ENGINEERING.md)**（第 4.5 节真实画面取证 + 第 5 节动效参数 + 第 6 节取舍）。

## 交互

| 操作 | 行为 |
|---|---|
| 等待 ~2.6s | 能量核心充能 → 亮蓝 bloom → 点亮玻璃板首页 |
| 滚轮 / 上滑触摸 / ↑↓ / PgUp·PgDn / 空格 | 推进/回退虚拟场景（Home → 4 作品 → About → Contact）|
| 右上药丸 ▶/❚❚ | 暂停/恢复全部动效 |
| 右上药丸 ☰ | 打开全屏 AT 菜单，点 Work/About/Contact 跳到对应场景 |
| 左上 Toggle Audio | 音频开关（占位 UI）|
| 移动鼠标 | 粒子场视差 + 上下边缘拉出彩色能量管 + 磁吸光标 |

## 本地运行

**想要一模一样(推荐,需真显卡):**
```bash
cd real-mirror
python tools/build.py     # 首次下载 ~180MB 真实资产(幂等,可中断续跑)
python tools/serve.py     # 打开 http://127.0.0.1:8080
```
`build.py` 会抓取原始 `app.js`、场景数据、几何、贴图(含 `.ktx2`)、Basis/Draco 解码器、worker 与 CMS,并生成带最小兼容 shim 的 `index.html`。引擎本身**零改动**。

**只要能跑的演示(无 GPU 也能看):**
```bash
python -m http.server 8080   # 根目录,打开 http://localhost:8080
```

## 结构

```
real-mirror/               逐字节镜像(需真显卡)
  tools/build.py           一键重建脚本(下载真实资产 + 注入 shim)
  tools/serve.py           带 KTX2/wasm MIME 的本地服务器
  index.src.html           原站未改动的引导 HTML
  README.md                镜像说明与 GPU 限制
  site/                    构建产物(gitignore,~180MB,本地生成)
index.html                 根目录手写演示入口(无 GPU 可用)

```
index.html                 单屏骨架（两个 canvas + 药丸 + 场景层 + 菜单）
assets/css/style.css       锁定视口、场景层、药丸、菜单、响应式、无障碍
assets/js/portal.js        2D 能量核心过场 + 边缘能量管
assets/js/shaderfield.js   WebGL 舞台（玻璃板 + 轨道环 + fbm 粒子，uProgress 推相机）
assets/js/app.js           虚拟场景引擎（wheel→progress、交叉淡化、调色板插值、药丸速度反应）
assets/js/data.js          About / 能力 / 联系方式文案
assets/data/projects.json  65 个真实项目数据
assets/fonts/              NBArchitekt Regular / Light / Bold
assets/img/                项目图 + favicon + OG 图
REVERSE_ENGINEERING.md     逆向与取证报告
```

## 动效参数（来自逆向，非手调）

- 帧率无关插值 `1-(1-α)^(dt·60)`（引擎 `1-exp(log(1-α)·dt·60)`）
- 每场景 lerpSpeed：Home .10 / Work .07 / Detail .07 / CleanRoom .08
- 相机 wobble 五层 sin/cos（25e-5…95e-5 × wobbleStrength）
- easings.net 贝塞尔（easeOutExpo `.190,1,.220,1`；easeInOutQuart `.770,0,.175,1`…）
- 调色板：青 `#00ffff` / 蓝 `#1A6DEA` / 冷辉光 `#9ca5ff` on near-black
- curl noise 粒子 + 域扭曲 fbm（零贴图，降分辨率渲染）

尊重 `prefers-reduced-motion`；无 WebGL 时回退静态渐变。
