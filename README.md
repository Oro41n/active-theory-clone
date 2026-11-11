# 41n — Personal Portfolio

个人作品集站点：无原生滚动条的单屏沉浸体验，能量核心过场 → 悬浮玻璃板首页 → 滚轮推进的精选作品（几何占位封面）→ 关于 → 联系。动效语法取自对 Active Theory 的逆向研究，但**全部内容已替换为 41n 自己的**，无一处原文案/原图。

> 从 `activetheory.net` 的逆向研究演变而来，原创动效实现，仅用于个人学习展示。`real-mirror/` 保留了一份逐字节研究镜像（见文末附录）。

## 本地运行

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

纯静态、零依赖、零构建。支持 `prefers-reduced-motion`；无 WebGL 时回退静态渐变。

## 交互

| 操作 | 行为 |
|---|---|
| 等待 ~2.6s | 能量核心充能 → 亮蓝 bloom → 点亮玻璃板首页 |
| 滚轮 / 上滑触摸 / ↑↓ / PgUp·PgDn / 空格 | 推进/回退虚拟场景（Home → 6 作品 → About → Contact，共 9 屏）|
| 右上药丸 ▶/❚❚ | 暂停/恢复全部动效 |
| 右上药丸 ☰ | 打开全屏 41n 菜单，点 Work/About/Contact 跳转场景 |
| 左上 Toggle Audio | 音频开关（占位 UI）|
| 移动鼠标 | 粒子场视差 + 上下边缘拉出彩色能量管 + 磁吸光标 |

## ✏️ 替换成你自己的内容（只需改 2 个文件）

**1. `assets/js/data.js`** — 站点文案，全部集中在这里：

- `meta.title` / `meta.description`：浏览器标题和描述
- `home.kicker` / `home.tagline`：首页顶部小字与底部标语
- `about.headline`：三行大标题，中间那行（`<em>`）会高亮成品牌色
- `about.lede`：关于正文
- `about.stats`：数据，格式 `["显示值", "标签"]`，可增删
- `about.capabilities`：能力三组（当前未在场景展示，预留扩展）
- `contact.headline`：三行联系大标题，最后一行是可点击邮箱链接
- `contact.email` / `contact.links` / `contact.note`：邮箱、社交链接、备注

**2. `assets/data/projects.json`** — 作品列表，一个作品一个对象：

```json
{
  "slug": "aurora-lab",          // 英文短名，唯一标识
  "name": "Aurora Lab",          // 作品名（大标题）
  "client": "Self-initiated",    // 客户 / 归属
  "description": "一句话介绍",   // 描述
  "date": "2025",                // 年份
  "tags": "WebGL,Generative",    // 逗号分隔的标签
  "uiColor": "3aa0ff",           // 主题色（无图时决定占位框的描边/辉光色）
  "priority": 1,                 // 排序（越小越前）
  "image": null                  // 有图就填相对路径如 "assets/img/xxx.jpg"
}
```

**换成你自己的作品图**：把图片放进 `assets/img/`，把对应作品的 `"image": null` 改成 `"image": "assets/img/你的图.jpg"`。有图的作品显示全幅照片，无图的显示几何占位框——两种可以混排。建议图片比例 16:9 或更宽、分辨率 ≥ 1600px。

场景数量、HUD 页码（如 `01 / 09`）、药丸进度都会随作品数量**自动更新**，不用手改。

改完刷新浏览器即可，无需构建。

## 结构

```
index.html                 单屏骨架（两个 canvas + 药丸 + 场景层 + 菜单 + 41n 字标）
assets/css/style.css       锁定视口、场景层、几何占位框、药丸、菜单、响应式、无障碍
assets/js/portal.js        2D 能量核心过场 + 边缘能量管
assets/js/shaderfield.js   WebGL 舞台（玻璃板 + 轨道环 + fbm 粒子，uProgress 推相机）
assets/js/app.js           虚拟场景引擎（wheel→progress、交叉淡化、调色板插值、占位框）
assets/js/data.js          ★ 站点文案（改这里）
assets/data/projects.json  ★ 作品列表（改这里）
assets/fonts/              NBArchitekt Regular / Light / Bold
assets/img/                作品图（当前已清空 Active Theory 原图，可直接放你的图）
REVERSE_ENGINEERING.md     逆向与取证报告
real-mirror/               附录：逐字节研究镜像（见下）
```

## 动效参数（来自逆向，非手调）

- 帧率无关插值 `1-(1-α)^(dt·60)`（引擎 `1-exp(log(1-α)·dt·60)`）
- 每场景 lerpSpeed：Home .10 / Work .07 / Detail .07 / CleanRoom .08
- 相机 wobble 五层 sin/cos（25e-5…95e-5 × wobbleStrength）
- easings.net 贝塞尔（easeOutExpo `.190,1,.220,1`；easeInOutQuart `.770,0,.175,1`…）
- 调色板：青 `#00ffff` / 蓝 `#1A6DEA` / 冷辉光 `#9ca5ff` on near-black
- curl noise 粒子 + 域扭曲 fbm（零贴图，降分辨率渲染）

---

## 附录：逐字节研究镜像 `real-mirror/`

保留了一份 Active Theory 原站**原始引擎 + 全部真实资产**的本地镜像（SHA-256 逐字节核对，`app.js` = `085d3e6a…`），供技术研究。**需要真显卡**（硬件 WebGL）；无 GPU 的软件渲染会卡在加载页（原站同样）。这不是作品集的一部分，端口与本站点独立。

```bash
cd real-mirror && ./start.sh      # macOS/Linux
cd real-mirror && start.bat       # Windows
# 或：python tools/build.py && python tools/serve.py
```

先打开 `http://127.0.0.1:8080/check-gpu.html` 自检显卡。详见 [`real-mirror/README.md`](./real-mirror/README.md)。

**Hydra 开源吗？不。** Active Theory 的 Hydra 是内部自研专有引擎，官方 GitHub 只开源了小工具，网上同名开源项目（`hydra-synth`、`facebookresearch/hydra`、`HydraJS`）都无关。`real-mirror/` 用的是它编译后的生产 bundle，无法 `npm install` 或拿到源码。完整查证见 `REVERSE_ENGINEERING.md` 第 8 节。
