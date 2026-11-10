# Active Theory — Study Rebuild

一个基于对 [activetheory.net](https://activetheory.net) 逆向分析后的**个人学习用**前端复刻。使用公开可访问的静态资源与公开 CMS 数据重建其视觉语言、信息结构与交互体验。

> ⚠️ 仅用于个人学习与技术研究，非官方项目，请勿用于商业用途。原始设计与内容版权归 Active Theory 所有。

## 它是如何构建的

通过 `rea` 工具（实时 CDP + 静态应用分析）逆向出原站的技术栈与结构，详见 **[REVERSE_ENGINEERING.md](./REVERSE_ENGINEERING.md)**。核心结论：

- 自研 WebGL 引擎 **Hydra**（非 Three.js），WebGL2 + 自定义 GLSL shader 管线
- 声明式 **UIL** 布局系统（JSON 驱动）+ `AppState` 状态总线
- 内容来自公开 CMS：`storage.googleapis.com/activetheory-v6.appspot.com/cms/{metadata,contact,projects}-dev.json`
- 已本地化：真实字体（NBArchitekt）、65 个真实项目数据、63+ 张真实项目图

本复刻以**纯静态前端**（无构建步骤、无依赖）重现其黑底冷调、大字号建筑感排版、六边形网格与粒子氛围，以及 Home / Work / 项目详情 / About / Contact 的 Hash 路由。

## 本地运行

```bash
# 任意静态服务器均可
python -m http.server 8080
# 打开 http://localhost:8080
```

## 结构

```
index.html                 入口
assets/css/style.css       样式（响应式 + 无 WebGL 降级）
assets/js/app.js           粒子画布、路由、视图渲染、交互
assets/js/data.js          站点文案（About / 能力 / 联系方式）
assets/data/projects.json  65 个真实项目数据
assets/fonts/              NBArchitekt Regular / Light / Bold
assets/img/                项目图 + favicon + OG 图
REVERSE_ENGINEERING.md     逆向分析报告
```

## 特性

- 环境粒子场 + 六边形网格视差（Canvas 2D，尊重 `prefers-reduced-motion`）
- 自定义光标、加载动画、滚动入场、悬停放大等微交互
- 作品按标签（Website / Multiplayer / XR / AI / Game / Installation）筛选
- 项目详情页含客户 / 年份 / 领域 / 描述 / 前后项目导航
- 移动端菜单、响应式栅格、无障碍降级
