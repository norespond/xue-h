# 雪花档案馆

一个本地测试中的 Galgame 视听档案站，用于按游戏整理封面、简介、CG 和 BGM。当前项目是静态页面 + JSON 数据驱动；BGM 已基本迁移到 Cloudflare R2/Worker，CG 展示图开始使用 PicX 图床，游戏封面暂时保留在项目目录中。

项目定位是个人整理与回看用的“视听档案馆”，不是资源分发站。CG 与 BGM 只收录想保留的精选内容，不追求完整；CG 明确不收录 R18 内容；页面只提供预览和在线播放，不规划 CG、BGM 或游戏本体下载入口。

## 当前状态

- 首页：封面墙 + 游戏名 + 导航栏搜索；统计中的作品数不包含 `000` 未归档资源池；从详情页返回时会保留搜索和滚动位置。
- 详情页：封面、标题、简介、CG、BGM、返回键和底部播放器。
- 未归档资源：`assets/game/000` 会作为“未归档资源池”出现在页面中，用于展示暂未确定作品归属的资源；CG 可为空，不计入缺 CG。
- 简介：长简介支持展开/收起，自动分段脚本已可用。
- CG：详情页会按数量自动切换展示布局，支持点击大图预览、加载状态、上一张/下一张、Esc 关闭、方向键切换；图片加载失败时会使用默认封面兜底。
- BGM：详情页以试听卡片展示，底部播放器支持播放/暂停、上一首/下一首、关闭、进度条、时间显示、播放结束自动下一首；播放失败时会在播放器中提示。
- 主题：日间/夜间切换，保存在浏览器本地。
- 数据报告：生成脚本会输出 `assets/json/report.json`。

## 目录约定

```text
assets/
  game/
    000/
      cover.png|cover.json # 默认封面配置
      未分类.json        # 未归档资源索引
      bgm/               # 未确定出处的旧音频资源
        song.json         # 未在已归档作品中使用的云端歌曲
      cg/                # 未确定出处的旧图片资源，可为空
    001/
      game.json          # 游戏基础信息
      *.jpg|*.png|*.webp # 根目录图片作为游戏封面，暂时本地保留
      cg/
        cg.json          # CG 展示图链接
      bgm/
        bgm.json         # BGM 云端链接
  json/
    games.json           # 首页索引，由脚本生成
    report.json          # 数据检查报告，由脚本生成
    games/
      001.json           # 详情页数据，由脚本生成
scripts/
  generate_game_json.py
  import_song_links.py
  preview_summary_breaks.py
  validate_assets.py
```

`assets/game/000` 作为公共/未归档资源池，会以“未归档资源池”出现在首页和详情页中，用于暂存、试听或预览暂未确定作品归属的旧资源。它是特殊目录：CG 可以为空，生成报告不会把它计入缺 CG；确认资源归属后，再移动到对应 `assets/game/{id}` 目录并重新生成数据。

`cover.png` / `cover.json` 用作站点默认封面；BGM 没有封面时，会优先使用 `assets/game/000/cover.png` 兜底，如果不存在，也支持读取 `assets/game/000/cover.json` 里的 `src`。前端图片加载失败时也会读取 `assets/game/000/cover.json` 作为默认封面。

`assets/game/000/未分类.json` 用来记录暂未确定出处的旧资源。当前约定格式：

```json
{
  "id": "000",
  "name": "未归档资源池",
  "description": "用于暂存、试听或预览暂未确定出处的旧资源。",
  "items": [
    {
      "name": "资源名",
      "type": "bgm",
      "path": "assets/game/000/bgm/example.mp3",
      "note": "未确定"
    }
  ]
}
```

`note` 字段统一写为 `未确定`。

`assets/game/000/bgm/song.json` 用来保存根目录 `song.json` 中尚未被已归档作品使用的云端歌曲。当前只保留 `title`、`cover`、`url`，不保留专辑信息。

## 数据格式

### game.json

```json
{
  "id": "001",
  "title": "游戏标题",
  "summary": "游戏简介"
}
```

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

修改 `assets/game/*/game.json`、封面、`cg.json` 或 `bgm.json` 后运行：

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

- 收录条目总数，包含特殊的 `000` 未归档资源池
- 已有简介、封面、BGM、CG 的数量
- 缺简介、缺封面、缺 BGM、缺 CG 的游戏
- 使用默认 BGM 封面的游戏

首页搜索支持游戏标题、简介和编号，搜索词会同步到 URL 的 `?q=` 参数，方便刷新或分享当前筛选结果；从详情页返回首页时，也会恢复上次的搜索和滚动位置。首页列表当前按编号升序展示，特殊的 `000` 未归档资源池固定排在最后。

每次补完一批资源后，推荐固定执行：

```powershell
python scripts\generate_game_json.py
python scripts\validate_assets.py
```

确认生成数据和校验报告都正常后，再本地预览页面。

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

如果根目录存在 `song.json`，且其中包含之前上传到 Cloudflare R2 的 BGM 信息：

```json
{
  "title": "曲名",
  "album": "专辑名",
  "cover": "https://example.com/cover.jpg",
  "url": "https://example.com/song.mp3"
}
```

预览匹配结果：

```powershell
python scripts\import_song_links.py
```

写入各游戏目录下的 `bgm/bgm.json`：

```powershell
python scripts\import_song_links.py --write
python scripts\generate_game_json.py
```

只处理单个游戏目录时使用 `--game`：

```powershell
python scripts\import_song_links.py --game 020 --write
python scripts\generate_game_json.py
```

脚本会按本地 BGM 文件名匹配 `song.json` 中的曲名。匹配不到时，会从已有歌曲链接推断 Worker 域名，并用本地文件名生成 Worker 下发链接。即使根目录暂时没有 `song.json`，也会尝试从已有 `bgm/bgm.json` 里的链接推断 Worker 域名。也可以手动指定：

```powershell
python scripts\import_song_links.py --worker-base-url https://example.workers.dev --write
```

导入脚本现在是合并写入：往已有目录追加本地 BGM 后再执行 `--write`，不会覆盖旧 `bgm.json` 里的已有曲目。

当前推荐的新增资源流程：

```powershell
# 1. 新建 assets\game\{id}，写 game.json；CG 可直接写 cg\cg.json
# 2. 上传 BGM 到 R2/Worker，并把已上传的同名音频临时放入 bgm\
python scripts\import_song_links.py --game {id} --write
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

批量写回所有游戏：

```powershell
$paths = Get-ChildItem -Path assets\game -Directory |
  Where-Object { $_.Name -ne '000' } |
  ForEach-Object { Join-Path $_.FullName 'game.json' } |
  Where-Object { Test-Path $_ }

python scripts\preview_summary_breaks.py --write @paths
python scripts\generate_game_json.py
```

断句规则覆盖 `。`、`！`、`？`、`……`、`…`、`!!`、`??`、`!?`、`?!`、`？！`、`!？`，并会把 `故事简介：`、`剧情简介：`、`STORY：` 等小标题单独分行。

## 本地预览

页面使用 `fetch` 读取 JSON，建议通过本地 HTTP 服务打开：

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/game.html?id=001
```

## 新窗口接续

已完成：

1. CG 预览基础功能已完成：支持大图预览、上一张/下一张、Esc 关闭、方向键切换和加载状态。
2. 首页导航已简化：只保留品牌、主题切换和搜索框，排序与装饰导航已移除。
3. 详情页播放器已改成底部窄栏样式，并支持关闭播放器。

当前比较适合继续做的任务：

1. 继续补充资源校验规则：可增加远程链接可达性、图片尺寸、音频 MIME 类型等检查。
2. 继续微调播放器观感和移动端布局；确认稳定后再考虑是否做全局播放器。
3. 规划单页化和全局播放器。目前多页面跳转会中断播放；真正全局播放需要改成轻量 SPA，建议后置。

## Git 准备

当前目录还没有初始化 Git 仓库。已添加 `.gitignore`，用于排除 Python 缓存、`.vscode` 和本地音频文件；`bgm.json` 等云端链接数据仍会保留在仓库中。

提交前建议检查：

```powershell
python scripts\generate_game_json.py
python scripts\validate_assets.py
node --check assets\js\home.js
node --check assets\js\game.js
```

当前需要特别留意的大文件：

- `assets/game/011/Box_Front.png`，约 7.7 MB
- `assets/themes/image/moon.png`，约 5.0 MB
- `assets/themes/image/sun.png`，约 4.7 MB
- `assets/game/005/aboutdialog.png`，约 1.3 MB
- `assets/game/020/bgm/輝きのリメンブランス.mp3`，约 4.4 MB，已被 `.gitignore` 排除

## 说明

本站资源均来源于网络，仅作为个人整理与本地测试用途，不提供游戏本体，不提供 CG/BGM 下载。
