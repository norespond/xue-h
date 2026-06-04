# 雪蕐档案馆

一个个人收藏与分享用的 Galgame 视听档案站，用于按游戏整理封面、简介、CG 和 BGM；站名中的“雪蕐”是游戏角色名。当前项目是单页静态应用 + JSON 数据驱动，已部署到 Cloudflare Pages。

项目定位是个人收藏、分享与回看用的“视听档案馆”，不是资源分发站。CG 与 BGM 只收录想保留的内容，不追求完整；CG 明确不收录 R18 内容；页面只提供 CG 预览和 BGM 在线播放，不提供游戏本体、CG 或 BGM 下载入口。

## 当前状态

- 首页：封面墙 + 游戏名 + 导航栏搜索；搜索支持游戏标题和 BGM 曲名。
- 单页路由：`index.html` 内完成首页/详情切换，详情 URL 使用 `index.html?id=001`；旧 `game.html?id=001` 会跳转到新路由。
- 详情页：封面、标题、简介、CG、BGM、返回键和底部播放器。
- `000`：作为“未分类资源与私货”出现在页面中，用于放置暂未分类的资源，以及不适合归入单个作品档案的个人收藏内容；它可以包含 CG 和 BGM，但不计入普通游戏作品数。
- 简介：长简介支持展开/收起，自动分段脚本已可用。
- CG：详情页按数量自动切换展示布局，支持点击大图预览、加载状态、上一张/下一张、Esc 关闭、方向键切换；图片加载失败时使用默认封面兜底。
- BGM：详情页以“专辑封面 + 曲名”的试听卡片展示；底部播放器支持圆形封面、顶部进度线、播放/暂停、上一首/下一首、关闭、进度拖动、时间显示、浮层播放列表和错误提示；播放器在单页路由切换时保持常驻。
- 主题：日间/夜间切换，保存在浏览器本地。
- 数据报告：生成脚本会输出 `assets/json/report.json`。

## 目录约定

```text
assets/
  game/
    000/
      cover.json          # 默认封面链接配置
      未分类.json         # 未分类资源与私货的基础说明
      cg/
        cg.json           # 未分类/私货 CG 展示图链接
      bgm/
        bgm.json          # 未分类/私货 BGM 云端链接
    001/
      game.json           # 游戏基础信息，cover 字段填写封面图床链接
      cg/
        cg.json           # CG 展示图链接
      bgm/
        bgm.json          # BGM 云端链接
  json/
    games.json            # 首页索引，由脚本生成
    report.json           # 数据检查报告，由脚本生成
    games/
      001.json            # 详情页数据，由脚本生成
scripts/
  generate_game_json.py      # 生成首页索引、详情 JSON 和数据报告
  import_song_links.py       # 根据本地 BGM 文件名写入/合并 bgm.json
  preview_summary_breaks.py  # 预览或写回简介自动分段
  validate_assets.py         # 校验 JSON、空链接、重复链接和重复曲名
```

`assets/game/000/cover.json` 是站点默认封面配置。当前默认封面已改为链接形式，不再使用 `assets/game/000/cover.png`。当前端图片加载失败、BGM 没有独立封面、或生成脚本需要兜底封面时，会读取 `cover.json` 中的链接。

普通游戏封面统一写在对应目录的 `game.json` 的 `cover` 字段中。封面图床迁移已完成，后续不需要保留本地封面迁移流程。

## 数据格式

### game.json

```json
{
  "id": "001",
  "title": "游戏标题",
  "cover": "https://example.com/game-cover.jpg",
  "summary": "游戏简介"
}
```

`cover` 为游戏封面图床链接，是首页和详情页封面的优先来源。

### bgm/bgm.json

```json
{
  "cover": "https://example.com/cover.jpg",
  "tracks": [
    {
      "name": "曲名",
      "src": "https://example.com/song.mp3"
    }
  ]
}
```

`cover` 是该游戏 BGM 的统一封面。`tracks` 中只保留曲名和音频链接。

### cg/cg.json

当前采用轻量格式，只保存页面展示图链接：

```json
{
  "images": [
    "https://example.com/cg-001.jpg",
    "https://example.com/cg-002.jpg"
  ]
}
```

生成脚本也兼容对象格式，便于给图片写名称：

```json
{
  "images": [
    {
      "name": "CG 001",
      "src": "https://example.com/cg-001.jpg"
    }
  ]
}
```

页面只使用展示图链接，不规划原图下载字段或下载入口。

## 生成数据

修改 `assets/game/*/game.json`、`cg.json` 或 `bgm.json` 后运行：

```powershell
python scripts\generate_game_json.py
```

脚本会生成：

```text
assets/json/games.json
assets/json/games/{id}.json
assets/json/report.json
```

报告包含：

- 收录条目总数，包含特殊的 `000`
- 已有简介、封面、BGM、CG 的数量
- 缺简介、缺封面、缺 BGM、缺 CG 的游戏
- 使用默认 BGM 封面的游戏

首页搜索支持游戏标题和 BGM 曲名，搜索词会同步到 URL 的 `?q=` 参数。首页列表当前按编号升序展示，特殊的 `000` 固定排在最后。

每次补完一批资源后，推荐固定执行：

```powershell
python scripts\generate_game_json.py
python scripts\validate_assets.py
node --check assets\js\app.js
```

## 资源校验

检查无效 JSON、空链接、重复链接和重复曲名：

```powershell
python scripts\validate_assets.py
```

脚本会生成：

```text
assets/json/validation.json
```

## 导入云端 BGM 链接

当前 BGM 流程为：

1. 先将音频上传到 Cloudflare R2，并由 Worker 下发。
2. 将已上传的同名音频文件临时放入对应游戏的 `bgm/` 目录。
3. 使用脚本根据目录中的本地文件名和 Worker 域名生成 `bgm/bgm.json`。

预览匹配/生成结果：

```powershell
python scripts\import_song_links.py --game 020 --worker-base-url https://www.xuehua-media.cc.cd
```

写入单个游戏目录：

```powershell
python scripts\import_song_links.py --game 020 --worker-base-url https://www.xuehua-media.cc.cd --write
python scripts\generate_game_json.py
python scripts\validate_assets.py
```

如果不传 `--worker-base-url`，脚本会尝试从已有 `bgm/bgm.json` 中推断 Worker 域名。导入脚本是合并写入：往已有目录追加本地 BGM 后再执行 `--write`，不会覆盖旧 `bgm.json` 里的已有曲目。

当前推荐的新增资源流程：

```powershell
# 1. 新建 assets\game\{id}，写 game.json；cover 填图床封面链接，CG 可直接写 cg\cg.json
# 2. 上传 BGM 到 R2/Worker，并把已上传的同名音频临时放入 bgm\
python scripts\import_song_links.py --game {id} --worker-base-url https://www.xuehua-media.cc.cd --write
python scripts\generate_game_json.py
python scripts\validate_assets.py
```

## 简介分段

预览单个文件：

```powershell
python scripts\preview_summary_breaks.py assets\game\001\game.json
```

写回单个文件：

```powershell
python scripts\preview_summary_breaks.py assets\game\001\game.json --write
```

批量写回所有普通游戏：

```powershell
$paths = Get-ChildItem -Path assets\game -Directory |
  Where-Object { $_.Name -ne '000' } |
  ForEach-Object { Join-Path $_.FullName 'game.json' } |
  Where-Object { Test-Path $_ }

python scripts\preview_summary_breaks.py --write @paths
python scripts\generate_game_json.py
```

## 本地预览

页面使用 `fetch` 读取 JSON，建议通过本地 HTTP 服务打开：

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/index.html?id=001
```

## 部署

项目已部署到 Cloudflare Pages。当前为静态站点，无构建步骤；部署入口为仓库根目录。

当前开发方式为：在当前分支继续修改，完成到一定阶段后再同步/合并到主线并部署。提交前建议运行：

```powershell
python scripts\generate_game_json.py
python scripts\validate_assets.py
node --check assets\js\app.js
```

## 后续任务

1. 继续补充资源校验规则，例如图片尺寸、音频时长等检查。
2. 继续微调播放器观感和移动端布局。
3. 后续新增资源时，按“生成数据 -> 校验资源 -> 本地预览 -> 部署”的流程检查即可。

## 说明

本站为个人收藏与分享用档案站，仅提供 CG 预览和 BGM 在线播放；不提供游戏本体，不提供 CG/BGM 下载入口。资源均来源于网络。
