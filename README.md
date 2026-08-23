# 雪华的小廟

这是一个个人收藏与分享用的 Galgame / 视听档案站（单页静态站 + JSON 数据驱动）。

设计目标

- 以“按游戏整理”的视听档案为中心：每个作品收录封面、简介、展示用 CG（预览）以及 BGM（在线播放）。
- 个人收藏为主，不作分发站：不提供游戏本体、原图下载或批量资源下载入口；CG 为预览尺寸，BGM 以在线播放为主。
- 易于维护：数据由仓库内的 JSON 与少量脚本生成，便于离线编辑和批量更新。

重要说明

- 站点名称：『雪华的小廟』（页面标题、页眉与运行时 document.title 已替换）。
- Favicon、PWA 图标、site.webmanifest 已迁移到 `assets/favicon/`（HTML head 已指向该目录）。

当前状态（概要）

- 首页（封面墙）与详情页均在 `index.html` 单页路由内实现；详情可通过 `index.html?id={id}` 访问。
- 详情页支持：封面、标题、简介（可折叠）、CG 画廊（点击预览）、BGM 列表与底部常驻播放器。
- 播放器：圆形封面、顶部进度条、播放/暂停、上一/下一、播放列表覆盖、进度拖拽与错误提示。
- 主题：日间/夜间切换，用户偏好保存在 localStorage。
- 默认兜底封面来自 `assets/game/000/cover.json`（当图片加载失败或条目无封面时使用）。

目录约定（简要）

```
assets/
  game/
    000/                  # 未分类与站点兜底资源
      cover.json          # 默认封面链接配置（远程链接形式）
      未分类.json         # 描述文本
      cg/
        cg.json           # CG 列表（展示图）
      bgm/
        bgm.json          # BGM 列表（在线链接）
    001/
      game.json           # 单个作品元数据
      cg/
        cg.json
      bgm/
        bgm.json
  json/
    games.json            # 首页索引（由脚本生成）
    report.json           # 数据报告（由脚本生成）
    games/
      001.json            # 详情页数据（由脚本生成）
assets/favicon/          # favicon、PWA 图标与 site.webmanifest
scripts/                 # 管理与生成脚本（见下）
```

数据格式（摘要）

- game.json（每个作品）

```json
{
  "id": "001",
  "title": "游戏标题",
  "cover": "https://.../cover.jpg",
  "summary": "游戏简介（可多行）"
}
```

- bgm/bgm.json（每个作品的 BGM 列表）

```json
{
  "cover": "https://.../album.jpg",
  "tracks": [
    { "name": "曲名", "src": "https://.../track.mp3" }
  ]
}
```

- cg/cg.json（展示图）

```json
{ "images": [ "https://.../cg1.jpg", "https://.../cg2.jpg" ] }
```

脚本（清晰的操作步骤与示例）

先决条件

- Python 3.x 可执行（建议 3.8+）。
- 可选：Node.js（用于 `node --check` 快速静态语法检查）。

常用脚本位置：`scripts/`。常见脚本：
- `generate_game_json.py`：生成首页索引（assets/json/games.json）、逐条详情（assets/json/games/{id}.json）与数据报告（assets/json/report.json）。
- `validate_assets.py`：校验 JSON 格式、空链接、重复链接与重复曲名，输出 `assets/json/validation.json`。
- `import_song_links.py`：根据本地 bgm/ 目录的文件名与 Worker 的基地址生成/合并 `bgm/bgm.json`（用于将本地文件名映射到已上传的云端链接）。
- `preview_summary_breaks.py`：自动为长简介计算段落拆分并可选择写回。

快速示例（Windows PowerShell）

1) 生成首页索引与报告（单次更新后执行）

```powershell
# 在仓库根目录运行
python scripts\generate_game_json.py
```

运行后会更新：
- `assets/json/games.json`
- `assets/json/games/{id}.json`（按游戏生成/更新）
- `assets/json/report.json`（简单统计与问题提示）

2) 校验资源（生成后强烈建议运行）

```powershell
python scripts\validate_assets.py
# 输出 assets/json/validation.json（含错误/警告）
```

3) 导入 / 生成 BGM 云端链接（示例）

- 说明：上传音频到 Cloudflare R2（或其它对象存储）并通过 Worker 暴露为可访问链接后，把同名文件临时放到对应游戏的 `assets/game/{id}/bgm/` 目录，运行脚本以生成 `bgm/bgm.json`。

```powershell
# 预览匹配（不会写入）
python scripts\import_song_links.py --game 020 --worker-base-url https://www.xuehua-media.cc.cd

# 写入 bgm/bgm.json（合并写入，不覆盖已有条目）
python scripts\import_song_links.py --game 020 --worker-base-url https://www.xuehua-media.cc.cd --write
# 之后建议立即重新生成索引与校验
python scripts\generate_game_json.py
python scripts\validate_assets.py
```

脚本行为要点：
- 如果不传 `--worker-base-url`，脚本会尝试从已有 `bgm/bgm.json` 或历史记录推断 Worker 的基地址。
- `--write` 会把生成结果写回到 `assets/game/{id}/bgm/bgm.json`，但脚本设计为“合并而非完全覆盖”以避免丢失手工调整过的条目。

4) 简介分段（预览与批量写入）

```powershell
# 仅预览单文件的自动段落拆分
python scripts\preview_summary_breaks.py assets\game\001\game.json

# 写回单个文件
python scripts\preview_summary_breaks.py assets\game\001\game.json --write

# 批量写回（排除 000）
$paths = Get-ChildItem -Path assets\game -Directory |
  Where-Object { $_.Name -ne '000' } |
  ForEach-Object { Join-Path $_.FullName 'game.json' } |
  Where-Object { Test-Path $_ }

python scripts\preview_summary_breaks.py --write @paths
python scripts\generate_game_json.py
```

5) 批量流程建议（新增或大量变动后）

```powershell
# 1. 更新或新增 assets/game/{id}/ 下的 game.json / cg/cg.json / bgm/bgm.json
# 2. （如需要）把本地音频放入对应 bgm/ 并运行 import_song_links.py --write
python scripts\import_song_links.py --game {id} --worker-base-url https://www.xuehua-media.cc.cd --write
# 3. 生成索引与报告
python scripts\generate_game_json.py
# 4. 校验
python scripts\validate_assets.py
# 5. （可选）快速检查前端 JS 语法
node --check assets\js\app.js
```

本地预览

- 建议使用简单静态服务器（避免 file:// 导致 fetch 被阻止）：

```powershell
# Python 内置（任意端口，如 8000）
python -m http.server 8000
# 打开浏览器：
# http://localhost:8000/
# 直接访问某条作品：
# http://localhost:8000/index.html?id=000
```

或使用 Node 的 http-server：

```powershell
npx http-server -p 8000
```

部署

- 当前部署目标：Cloudflare Pages（静态站点，无额外构建步骤）。
- 发布流程简要：在分支上完成资源更新并运行脚本、校验无错误后提交并推送，创建 PR 合并到主干并让 CI/Pages 自动部署（本仓库已配置为直接从仓库根部署静态内容）。

提交检查（建议）

1. 运行数据生成与校验：

```powershell
python scripts\generate_game_json.py
python scripts\validate_assets.py
node --check assets\js\app.js
```

2. 本地预览并确认页面无明显错误；确保 favicon/manifest 已正确加载（浏览器可能缓存旧 favicon，请清缓存或使用无痕）。

3. 提交：

```powershell
git add -A
git commit -m "Update content / assets and regenerate JSON indexes"
# 推送到远端分支
git push origin <branch>
```

（如果需要，我可以帮你把这些更改打成一次 commit，并自动加入 Co-authored-by trailer。）

开发者备注

- `assets/json/` 目录为生成产物，不必手工编辑（除非确知所为）。
- 站点脚本会优先读取每个游戏目录下的 `game.json` 的 `cover` 字段作为封面；当封面加载失败时会使用 `assets/game/000/cover.json` 中配置的兜底链接。
- 若需替换或新增 favicon，请把文件放到 `assets/favicon/` 并同时更新 `index.html` / `game.html` head 中的引用（当前已更新）。

欢迎反馈具体希望改进的点（UI、配色、播放器交互或静态资源管理），可逐项迭代。 
