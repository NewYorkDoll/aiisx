import { useEffect, useRef, useState, type WheelEvent } from 'react'
import type { GameRecord } from '../../shared/types'
import styles from './SwitchConsole.module.css'

type SwitchConsoleProps = {
  games: GameRecord[]
  loading: boolean
}

export function SwitchConsole({ games, loading }: SwitchConsoleProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const [booted, setBooted] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const currentIndex = games.length ? activeIndex % games.length : 0

  useEffect(() => {
    const timer = window.setTimeout(() => setBooted(true), 1600)
    return () => window.clearTimeout(timer)
  }, [])

  const move = (direction: number) => {
    if (!games.length) return
    const next = (currentIndex + direction + games.length) % games.length
    const rail = railRef.current
    const card = rail?.children.item(next) as HTMLElement | null
    rail?.scrollTo({ left: card?.offsetLeft || 0, behavior: 'smooth' })
    setActiveIndex(next)
  }

  const scrollGames = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    event.currentTarget.scrollBy({ left: event.deltaY * 2, behavior: 'smooth' })
  }

  return <section className={styles.archive} aria-label="Nintendo Switch archive">
    <div className={styles.heading}>
      <div><p className="kicker">SWITCH / ARCHIVE</p><h2>game-are-life</h2></div>
      <span>{games.length ? `${String(currentIndex + 1).padStart(2, '0')} / ${String(games.length).padStart(2, '0')}` : '-- / --'}</span>
    </div>

    <div className={styles.consoleStage}>
      <div className={styles.switch}>
        <div className={styles.body}>
          <div className={styles.volume} />
          <div className={styles.screen}>
            {!booted && <div className={styles.logo}>
              <div className={styles.icon}><div className={`${styles.iconPart} ${styles.left}`} /><div className={`${styles.iconPart} ${styles.right}`} /></div>
              <h3><span>Nintendo</span>Switch</h3>
            </div>}

            {booted && loading && <p className={styles.screenMessage}>querying save data...</p>}
            {booted && !loading && !games.length && <p className={styles.screenMessage}>no switch sync yet<br /><small>run npm run sync:platforms</small></p>}
            {booted && !loading && games.length > 0 && <div className={styles.gameRail} ref={railRef} onWheel={scrollGames}>
              {games.map((game, index) => <article className={styles.gameCard} key={game.id} aria-label={`${index + 1}. ${game.title}`}>
                {game.cover ? <img draggable={false} src={game.cover} alt="" /> : <div className={styles.gameFallback}>N</div>}
                <div className={styles.cardBody}>
                  <h3>{game.title}</h3>
                  <p>最后游玩时间</p>
                  <time>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(game.playedAt))}</time>
                  <p>游玩时长</p>
                  <strong>{(game.minutes / 60).toFixed(2)} 小时</strong>
                </div>
              </article>)}
            </div>}
          </div>
        </div>

        <div className={`${styles.joyCon} ${styles.left}`}>
          <div className={styles.buttonGroup}>
            <span className={`${styles.button} ${styles.arrow} ${styles.up}`} />
            <button className={`${styles.button} ${styles.arrow} ${styles.right}`} type="button" aria-label="Next Switch game" onClick={() => move(1)} />
            <span className={`${styles.button} ${styles.arrow} ${styles.down}`} />
            <button className={`${styles.button} ${styles.arrow} ${styles.left}`} type="button" aria-label="Previous Switch game" onClick={() => move(-1)} />
          </div>
          <span className={styles.stick} />
          <span className={styles.select} />
          <span className={styles.capture} />
          <span className={`${styles.shoulder} ${styles.l}`} />
        </div>

        <div className={`${styles.joyCon} ${styles.right}`} aria-hidden="true">
          <div className={styles.buttonGroup}>
            <span className={`${styles.button} ${styles.letter}`} data-letter="X" />
            <span className={`${styles.button} ${styles.letter}`} data-letter="A" />
            <span className={`${styles.button} ${styles.letter}`} data-letter="B" />
            <span className={`${styles.button} ${styles.letter}`} data-letter="Y" />
          </div>
          <span className={styles.stick} />
          <span className={styles.start} />
          <span className={styles.home} />
          <span className={`${styles.shoulder} ${styles.r}`} />
        </div>
      </div>
    </div>

  </section>
}
