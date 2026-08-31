import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GameRecord } from '../../shared/types'
import styles from './SwitchConsole.module.css'

type SwitchConsoleProps = {
  games: GameRecord[]
  loading: boolean
}

export function SwitchConsole({ games, loading }: SwitchConsoleProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const currentIndex = games.length ? activeIndex % games.length : 0
  const game = games[currentIndex]
  const move = (direction: number) => {
    if (!games.length) return
    setActiveIndex((current) => (current + direction + games.length) % games.length)
  }

  return <section className={styles.archive} aria-label="Nintendo Switch archive">
    <div className={styles.heading}>
      <div><p className="kicker">SWITCH / ARCHIVE</p><h2>game-are-life</h2></div>
      <span>{games.length ? `${String(currentIndex + 1).padStart(2, '0')} / ${String(games.length).padStart(2, '0')}` : '-- / --'}</span>
    </div>

    <div className={styles.console}>
      <div className={`${styles.joyCon} ${styles.leftJoy}`}>
        <span className={styles.minus} />
        <span className={`${styles.stick} ${styles.leftStick}`} />
        <div className={`${styles.buttonGroup} ${styles.dpad}`}>
          <span className={styles.roundButton} />
          <button className={styles.roundButton} type="button" aria-label="Previous Switch game" onClick={() => move(-1)}><ChevronLeft /></button>
          <span className={styles.roundButton} />
          <button className={styles.roundButton} type="button" aria-label="Next Switch game" onClick={() => move(1)}><ChevronRight /></button>
        </div>
        <span className={styles.capture} />
      </div>

      <div className={styles.body}>
        <span className={styles.volume} />
        <div className={styles.screen}>
          {loading ? <p className={styles.screenMessage}>querying save data...</p> : game ? <>
            <article className={styles.game} key={game.id}>
              {game.cover ? <img className={styles.gameImage} src={game.cover} alt="" /> : <div className={styles.gameFallback}>N</div>}
              <div className={styles.gameCopy}>
                <span className={styles.eyebrow}>RECENT PLAY</span>
                <h3>{game.title}</h3>
                <dl>
                  <div><dt>PLAY TIME</dt><dd>{(game.minutes / 60).toFixed(1)} h</dd></div>
                  <div><dt>LAST SAVE</dt><dd>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(game.playedAt))}</dd></div>
                </dl>
              </div>
            </article>
            <div className={styles.screenBar}><span>NINTENDO SWITCH</span><span>● online</span></div>
          </> : <p className={styles.screenMessage}>no switch sync yet<br /><small>run npm run sync:platforms</small></p>}
        </div>
      </div>

      <div className={`${styles.joyCon} ${styles.rightJoy}`} aria-hidden="true">
        <span className={styles.plus} />
        <div className={`${styles.buttonGroup} ${styles.letters}`}>
          <span className={styles.roundButton} data-letter="X" />
          <span className={styles.roundButton} data-letter="Y" />
          <span className={styles.roundButton} data-letter="B" />
          <span className={styles.roundButton} data-letter="A" />
        </div>
        <span className={`${styles.stick} ${styles.rightStick}`} />
        <span className={styles.home} />
      </div>
    </div>

    <p className={styles.hint}><span>◀ ▶</span> browse archive <span>{game?.title || 'waiting for sync'}</span></p>
  </section>
}
