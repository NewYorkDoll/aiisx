import type { GameShareReport } from '../../shared/types'

export async function createGamePoster(report: GameShareReport): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持生成海报')
  const mono = '"DM Mono", "Microsoft YaHei", monospace'
  const sans = '"Space Grotesk", "Microsoft YaHei", system-ui, sans-serif'
  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))])
  const covers = new Map<string, HTMLImageElement>()
  await Promise.allSettled([...new Set(report.platforms.flatMap((group) => group.games.map((game) => game.cover)).filter((url): url is string => Boolean(url)))].map((url) => new Promise<void>((resolve) => {
    const image = new Image()
    const done = () => { clearTimeout(timer); image.onload = null; image.onerror = null; resolve() }
    const timer = setTimeout(() => { image.src = ''; done() }, 12_000)
    image.onload = () => { covers.set(url, image); done() }
    image.onerror = done
    image.src = url
  })))
  const wrap = (value: string) => {
    ctx.font = `400 32px ${sans}`
    const lines: string[] = []
    let line = ''
    for (const character of value) {
      if (line && ctx.measureText(line + character).width > 636) { lines.push(line); line = '' }
      line += character
    }
    lines.push(line)
    return lines
  }
  const groups = report.platforms.map((platform) => ({ ...platform, rows: platform.games.map((game) => ({ ...game, lines: wrap(game.title) })) }))
  const rowHeight = (lines: string[]) => Math.max(220, 116 + lines.length * 42)
  canvas.width = 1080
  canvas.height = 650 + groups.reduce((height, group) => height + 128 + (group.rows.length ? group.rows.reduce((sum, row) => sum + rowHeight(row.lines), 0) : 80), 0) + 230
  const text = (value: string, x: number, y: number, size = 22, color = '#a0a6ad', font = mono) => {
    ctx.font = `400 ${size}px ${font}`
    ctx.fillStyle = color
    ctx.fillText(value, x, y)
  }
  const line = (y: number, color = '#2b3035') => { ctx.fillStyle = color; ctx.fillRect(64, y, 952, 1) }
  const date = (value: string) => value.slice(0, 10).replaceAll('-', '.')
  const playedDate = (value: string) => value.length === 10 ? date(value) : date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)))
  const hours = (minutes: number) => minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`
  const { summary } = report
  const colors = { Switch: '#ff7968', PC: '#79c8f2', Xbox: '#bde985' }

  ctx.fillStyle = '#111519'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#c8f278'
  ctx.fillRect(0, 0, canvas.width, 8)
  ;['#ff7968', '#dfbd69', '#bde985'].forEach((color, index) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(72 + index * 26, 61, 6, 0, Math.PI * 2); ctx.fill() })
  text('aiisx / ~/life/games', 184, 69, 21)
  text('14D RECAP', 844, 69, 20, '#c8f278')
  line(98)
  text('$ games --recent=14d --share', 64, 153, 23, '#c8f278')
  text('PLAY. SAVE. REPEAT.', 60, 225, 65, '#f4f3ee', sans)
  text(`${date(report.from)} — ${date(report.to)}`, 66, 271, 25)
  ctx.fillStyle = '#1a2025'
  ctx.fillRect(64, 310, 952, 164)
  text(summary.periodGameCount ? hours(summary.periodMinutes) : '—', 88, 390, 64, '#c8f278', sans)
  text('近两周已知时长', 90, 439, 23)
  text(String(summary.gameCount).padStart(2, '0'), 544, 390, 64, '#f4f3ee', sans)
  text('游戏记录', 546, 439, 23)
  text(String(summary.platformCount).padStart(2, '0'), 828, 390, 64, '#f4f3ee', sans)
  text('游戏平台', 830, 439, 23)
  text(`${summary.periodGameCount} / ${summary.gameCount} 条记录提供近两周时长 · 不计入累计时长`, 66, 512, 21)
  let barX = 64
  ctx.fillStyle = '#2b3035'
  ctx.fillRect(barX, 549, 952, 8)
  groups.forEach((group, index) => {
    const minutes = group.games.reduce((sum, game) => sum + (game.timeScope === 'period' ? game.minutes || 0 : 0), 0)
    const width = summary.periodMinutes ? minutes / summary.periodMinutes * 952 : 0
    ctx.fillStyle = colors[group.name]
    ctx.fillRect(barX, 549, width, 8)
    barX += width
    text(`${group.name}  ${group.games.length ? minutes ? hours(minutes) : '时长未计入' : '无记录'}`, 64 + index * 328, 599, 20, colors[group.name])
  })
  line(637)

  let y = 650
  for (const [index, group] of groups.entries()) {
    const color = colors[group.name]
    text(`0${index + 1}`, 64, y + 59, 20, color)
    text(group.name.toUpperCase(), 120, y + 61, 30, '#f4f3ee')
    const subtitle = group.name === 'Xbox' ? 'LAST PLAYED / LIFETIME STATS' : group.name === 'PC' ? 'STEAM + PC / DECK LIBRARY' : 'PLAYTIME / RECENT TWO WEEKS'
    text(subtitle, 120, y + 96, 16, color)
    text(`${String(group.games.length).padStart(2, '0')} GAMES`, 863, y + 59, 18)
    y += 128
    if (!group.rows.length) {
      text(group.syncedAt ? '这两周暂无已同步的游戏记录' : '等待首次同步', 120, y + 35, 24)
      y += 80
    }
    for (const [rank, row] of group.rows.entries()) {
      const height = rowHeight(row.lines)
      ctx.fillStyle = '#1a2025'
      ctx.fillRect(64, y, 952, height - 12)
      ctx.fillStyle = color
      ctx.fillRect(64, y, 3, height - 12)
      ctx.fillStyle = '#111519'
      ctx.fillRect(84, y + 16, 176, 176)
      const cover = row.cover ? covers.get(row.cover) : undefined
      if (cover) {
        const scale = Math.min(176 / cover.naturalWidth, 176 / cover.naturalHeight)
        const width = cover.naturalWidth * scale
        const imageHeight = cover.naturalHeight * scale
        ctx.drawImage(cover, 84 + (176 - width) / 2, y + 16 + (176 - imageHeight) / 2, width, imageHeight)
      } else {
        text(Array.from(row.title).slice(0, 2).join('').toUpperCase(), 107, y + 108, 48, color, sans)
        text('NO COVER', 116, y + 145, 13, '#727d86')
      }
      text(String(rank + 1).padStart(2, '0'), 966, y + 35, 16, color)
      row.lines.forEach((value, i) => text(value, 292, y + 49 + i * 42, 32, '#f4f3ee', sans))
      const metaY = y + 67 + row.lines.length * 42
      const time = row.minutes === null ? '时长未提供' : `${hours(row.minutes)} · ${row.timeScope === 'period' ? '近两周' : '累计'}`
      const achievement = row.achievements === undefined ? '' : `  /  ${row.achievements} 成就（累计）`
      text(time + achievement, 292, metaY, 21, color)
      text(`${playedDate(row.playedAt)}${row.sharedWithPc ? ' · Xbox / PC 共享记录' : ''}`, 292, metaY + 32, 17)
      y += height
    }
  }
  line(y + 10)
  text('Switch：Nintendo 逐日记录；Steam：同步时的近两周统计', 64, y + 55, 19)
  text('Xbox：近两周玩过的游戏，时长与成就为累计；共用版本不区分设备', 64, y + 87, 19)
  const stamps = groups.map((group) => `${group.name} ${group.syncedAt ? date(group.syncedAt) : '--'}`).join('  /  ')
  text(`SYNC  ${stamps}`, 64, y + 126, 16, '#727d86')
  text('aiisx.com', 64, y + 192, 31, '#c8f278')
  text('NO GAME. NO LIFE.', 698, y + 192, 22, '#f4f3ee')
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('海报导出失败，请重试')), 'image/png'))
}
