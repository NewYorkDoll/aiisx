import { useEffect, useRef, useState } from 'react'
import { Download, Share2, X } from 'lucide-react'
import { getGameShareReport } from '../lib/api'
import { createGamePoster } from '../lib/game-poster'
import styles from './GameShare.module.css'

export function GameShare() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [poster, setPoster] = useState<{ url: string; file: File } | null>(null)
  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster.url) }, [poster])

  async function generate() {
    if (busy) return
    dialog.current?.showModal()
    setBusy(true)
    setError('')
    setPoster(null)
    try {
      const report = await getGameShareReport()
      const blob = await createGamePoster(report)
      setPoster({ url: URL.createObjectURL(blob), file: new File([blob], `aiisx-games-${report.from}-${report.to}.png`, { type: 'image/png' }) })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '海报生成失败，请重试') }
    finally { setBusy(false) }
  }

  async function share() {
    if (!poster) return
    try { await navigator.share({ files: [poster.file], title: '我的近两周游戏记录' }) }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('无法打开系统分享，请使用下载 PNG') }
  }

  return <>
    <button className={styles.trigger} type="button" onClick={() => void generate()} disabled={busy}><Share2 size={16} /><span>{busy ? 'generating…' : 'share --last-14d'}</span><small>分享近两周</small></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="game-share-title">
      <header><div><span>EXPORT / PLAY LOG</span><h2 id="game-share-title">最近两周的游戏记录</h2></div><button type="button" aria-label="关闭海报" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
      <div className={styles.preview} aria-busy={busy}>
        {busy && <p role="status">rendering poster…<br /><small>正在读取记录并生成 PNG</small></p>}
        {poster && <img src={poster.url} alt="最近两周游戏详情海报，按 Switch、PC、Xbox 分组展示游戏、时长与最后游玩日期" />}
        {error && <p role="alert">{error}</p>}
      </div>
      <footer><p>可下载原图，也可在手机上长按保存。</p><div>
        {poster && <a href={poster.url} download={poster.file.name}><Download size={16} />下载 PNG</a>}
        {poster && navigator.canShare?.({ files: [poster.file] }) && <button type="button" onClick={() => void share()}><Share2 size={16} />系统分享</button>}
        {error && !busy && !poster && <button type="button" onClick={() => void generate()}>重新生成</button>}
      </div></footer>
    </dialog>
  </>
}
