# 41n 设计集 — 内容替换清单

这一层**只换内容，不换壳**。原站 Hydra 引擎、几何模型、PBR 贴图、shader、UIL 场景图、
转场、粒子系统、鼠标能量管、玻璃面板、药丸导航、详情页框架与全部动效，
**一个字节都没改**（`app.js` SHA-256 仍为 `085d3e6a46893f5…`）。

## 已替换的内容（65 个作品 + 全站文案 + 全部媒体）

| 位置 | 原站内容 | 现在是 |
|---|---|---|
| 项目 `name` ×65 | Dream Portal / Kandinsky / Secret Sky… | 41n 设计集作品：Aurora Identity / Monolith Type / Drift Poster Series… |
| 项目 `description` ×65 | 原项目描述 | 41n 设计说明 |
| `clientName` / `tags` ×65 | Google / WSJ / Installation… | 41n Studio / Atlas Editions / Branding, Typography… |
| `completionDate` | 2014–2023 | 2015–2026 |
| `uiColor` ×65 | 原配色 | 41n 的 18 色调色板（仍驱动场景配色，效果保留） |
| `projectLogo` / `video.thumbnail` / `stats` 图片 | 768 处远程 GCS 图 | 本地 `assets/41n/work-00..17.jpg`（18 张由 6 张 AI 封面派生） |
| `video.url` | 远程 mp4 | 本地 `assets/41n/preview.mp4`（4 秒推近动效占位，可替换） |
| `projectURL` / `caseStudyURL` | 外链 | `#/work/{slug}` — **详情页跳转保留** |
| metadata `title`/`description` | Active Theory · Creative Digital Experiences | 41n — Design Collection |
| contact `links` | 原站邮箱/社交 | hello@41n.design / GitHub / Instagram / Behance / Are.na |
| UIL `text3d_text` ×8 | 场景里的 3D 大字 | 41n / Design / Collection、41N LAB、Scroll to explore… |
| `index.html` `<title>` / meta / og | 原站 | 41n branding |

**零外链**：4 个数据文件里 703 个 `url` 字段全部指向本地，HTTP 无 4xx/5xx。

## 刻意没动的部分（这就是你截图里要"保留一切"的东西）

- `app.js` / `modules.js`（引擎，与线上逐字节一致）
- `assets/geometry/` 123 个几何、`assets/images/` 228 张贴图（模型与材质）
- `assets/shaders/compiled.vs`、Basis/Draco 解码器、worker、BMFont 字体
- `uil.json` 里除 8 个文字字段外的 **2585 个配置项**（场景图、相机、粒子参数、转场时序、灯光）
- 全部交互：`work/{slug}` 路由、点击进详情页、滚轮/触摸虚拟滚动、药丸导航、音频开关、边缘能量管

## 怎么换成你自己的内容

编辑 **`tools/apply-41n.py`** 顶部的 `WORKS`（65 组：作品名 / 客户 / 标签 / 年份）和
`DESC`（65 段描述），其它想改的文案在 `apply()` 里（`meta`、`contact`、`TEXT`），然后：

```bash
python tools/apply-41n.py            # 重新生成内容层（幂等）
python tools/build.py                # 或重建镜像时自动应用
python tools/serve.py                # http://127.0.0.1:8080
```

换图片/视频：直接替换 `site/assets/41n/work-*.jpg` 和 `preview.mp4`（文件名保持不变），
刷新即可。想用更多素材，改 `MEDIA_COUNT` 并加文件。

切回原站内容：`python tools/apply-41n.py --restore`
查看映射表：`python tools/apply-41n.py --report`

> 原站内容基线保存在 `content/original/`（纯文本，约 460 KB），所以内容层可在任意
> 新建的镜像上复现；`site/` 里的 180 MB 第三方二进制资产仍由 `build.py` 本地重建、不入库。

## 运行前提

**需要真实显卡（硬件 WebGL）**。原站的 GPGPU 粒子系统依赖浮点渲染目标，
无 GPU 的软件渲染（SwiftShader）会卡在加载过场——这是原站自身的限制，不是内容层的问题。
先打开 `http://127.0.0.1:8080/check-gpu.html` 自检。

已在本环境验证：引擎运行时 `window.CMS_DATA` 中 65 个项目全部为 41n 内容
（引擎 reshape 后字段为 `title`/`subhead`/`clientName`/`thumbnailURL`/`perma`），
`document.title`、`metadata`、`contact` 均为 41n，786 处媒体全部本地命中、零 HTTP 错误。
