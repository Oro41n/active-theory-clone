# Active Theory — Study Rebuild

对 [activetheory.net](https://activetheory.net) 做逆向分析后的**个人学习用**前端复刻。第二版基于**真实渲染逐帧取证**推翻了第一版错误的结构，重建为「锁定单屏 + 虚拟场景推进」引擎。

> ⚠️ 仅用于个人学习与技术研究，非官方项目，请勿用于商业用途。原始设计、字体、shader、影片与内容版权归 Active Theory 所有。

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

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

## 结构

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
