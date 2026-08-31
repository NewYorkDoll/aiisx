# aiisx 生产运维手册

生产站点使用 Vercel 承载应用，使用 Turso `aiisx-prod` 保存文章、游戏、训练、认证和同步记录。本文命令不包含任何访问令牌。

## 日常检查

部署后执行：

```bash
npm run verify:production -- https://aiisx.com
```

管理页 `/manage` 的 `syncctl history --limit=8` 区域会显示最近平台同步的开始时间、耗时和各平台结果。计划任务在北京时间约 12:00 和 20:00 执行。

## 创建 Turso 快照

在发布数据库结构变更、批量导入或手工修复数据前创建一个独立快照：

```bash
turso db create aiisx-backup-YYYYMMDD-HHMM --from-db aiisx-prod --wait
```

Windows 上如果 Turso 安装在 WSL 的默认目录但没有加入 `PATH`，把命令中的 `turso` 替换为 `~/.turso/turso`。

快照是新的 Turso 数据库，不会暂停或修改 `aiisx-prod`。创建后立即校验关键表：

```bash
turso db shell aiisx-backup-YYYYMMDD-HHMM "SELECT 'journal_posts', COUNT(*) FROM journal_posts UNION ALL SELECT 'switch_games', COUNT(*) FROM dwd_switch_game_played_record UNION ALL SELECT 'steam_games', COUNT(*) FROM steam_game_activity UNION ALL SELECT 'xbox_games', COUNT(*) FROM xbox_game_activity UNION ALL SELECT 'fitness_actions', COUNT(*) FROM fitness_recent_action;"
```

记录快照名称、创建时间和创建原因。确认后再进行高风险数据操作。

## 按时间点恢复

不要直接覆盖生产库。先从事故发生前的时间点创建恢复库，时间必须使用 RFC3339：

```bash
turso db create aiisx-restore-YYYYMMDD-HHMM --from-db aiisx-prod --timestamp 2026-08-31T11:30:00+08:00 --wait
```

依次核对数据量和关键内容：

```bash
turso db shell aiisx-restore-YYYYMMDD-HHMM "SELECT status, COUNT(*) FROM journal_posts GROUP BY status;"
turso db shell aiisx-restore-YYYYMMDD-HHMM "SELECT platform, status, started_at FROM sync_runs ORDER BY started_at DESC LIMIT 8;"
turso db shell aiisx-restore-YYYYMMDD-HHMM "SELECT completed_at, action_name, sets FROM fitness_recent_action ORDER BY completed_at DESC LIMIT 10;"
```

如果某张新表在目标时间点还不存在，查询失败是预期结果；应用启动后会自动补建当前结构。

## 切换到恢复库

只有校验通过后才切换 Vercel：

1. 获取恢复库地址：`turso db show aiisx-restore-YYYYMMDD-HHMM --url`。
2. 为恢复库创建专用令牌：`turso db tokens create aiisx-restore-YYYYMMDD-HHMM`。
3. 在 Vercel Production 环境中更新 `DATABASE_URL` 和 `DATABASE_AUTH_TOKEN`。
4. 重新部署 Production。
5. 执行 `npm run verify:production -- https://aiisx.com`，并在管理页核对草稿与同步历史。

切换后先保留原 `aiisx-prod`，不要立即删除。若恢复库验证失败，将两个环境变量改回原生产库并重新部署即可回切。

## 本地 SQLite 备份

本地 `data/aiisx.db` 不在 Git 中。需要保留本地数据时，停止本地 API 后复制该文件到工作区外的备份目录；恢复时也应先保留当前文件，再用备份文件替换。不要把数据库、Turso 令牌、Xbox 凭证或 `.env` 提交到仓库。

## 故障处理顺序

1. 先访问 `/api/health`，确认应用和数据库连接状态。
2. 再查看 Vercel Function 日志，定位接口、数据库或外部平台错误。
3. 在 `/manage` 核对同步运行记录；单个平台失败不等于整站不可用。
4. 数据损坏时停止手工写入，记录事故时间，再按时间点创建恢复库。
5. 只有完成数据核对后才切换生产连接。
