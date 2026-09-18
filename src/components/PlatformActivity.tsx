import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Gamepad2, Library, Search, Settings, ShoppingBag, Trophy, Wifi } from 'lucide-react'
import type { SteamSnapshot, XboxGame, XboxSnapshot } from '../../shared/types'
import { mergePcGames } from '../../shared/pc-library'
import styles from './PlatformActivity.module.css'

export function SteamActivity({ data, pcGames = [] }: { data: SteamSnapshot | null; pcGames?: XboxGame[] }) {
  const games = mergePcGames(data?.games || [], pcGames)
  const [selectedId, setSelectedId] = useState('')
  const featured = games.find((game) => game.id === selectedId) || games[0]
  const online = data?.profile?.state === 1

  return <section className={styles.platformSection} aria-label="PC game library">
    <div className={styles.sectionHeading}>
      <div><p className="kicker">STEAM + PC / ACTIVITY</p><h2>deck-library</h2></div>
      <div className={styles.identity}>{data?.profile?.avatar && <img src={data.profile.avatar} alt="" />}<span>{data?.profile?.name || 'PC library'}<small className={online ? styles.online : ''}>{online ? 'online' : 'offline'}</small></span></div>
    </div>

    <div className={styles.steamDeck}>
      <div className={`${styles.deckGrip} ${styles.deckLeft}`} aria-hidden="true"><span className={styles.deckShoulder} /><span className={styles.deckStick} /><span className={styles.deckPad}><i /><i /><i /><i /></span><span className={styles.deckTrackpad} /><span className={styles.deckSpeaker} /><span className={styles.deckMenu} /></div>
      <div className={styles.deckScreen}>
        <header className={styles.steamBar}><span className={styles.steamMark}>S</span><strong>LIBRARY</strong><span><Wifi /> {online ? 'ONLINE' : 'OFFLINE'}</span></header>
        {featured ? <div className={styles.steamFeature}>
          {featured.cover ? <img src={featured.cover} alt="" /> : <div className={styles.steamPlaceholder}><Gamepad2 /><span>PC LIBRARY</span></div>}
          <div className={styles.steamFeatureCopy}>
            <small>{featured.source.toUpperCase()} / RECENTLY PLAYED</small>
            <h3>{featured.title}</h3>
            <div><span><Clock3 />{featured.timeScope === 'period' ? '2 WEEKS' : 'LIFETIME'}<strong>{featured.minutes === null ? 'unavailable' : `${(featured.minutes / 60).toFixed(1)} h`}</strong></span></div>
          </div>
        </div> : <p className={styles.platformMessage}>{data?.message || 'no recent PC games'}</p>}
        <footer className={styles.steamFooter}><span>STEAM</span><span>SELECT</span><span>•••</span></footer>
      </div>
      <div className={`${styles.deckGrip} ${styles.deckRight}`} aria-hidden="true"><span className={styles.deckShoulder} /><span className={styles.deckButtons}><i data-key="Y" /><i data-key="X" /><i data-key="B" /><i data-key="A" /></span><span className={styles.deckStick} /><span className={styles.deckTrackpad} /><span className={styles.deckSpeaker} /><span className={styles.deckMenu} /></div>
    </div>
    {games.length > 1 && <div className={styles.pcLibrary} aria-label="选择 PC 游戏">{games.map((game) => <button type="button" key={game.id} aria-pressed={game.id === featured?.id} onClick={() => setSelectedId(game.id)}><small>{game.source}</small><span>{game.title}</span></button>)}</div>}
  </section>
}

export function XboxActivity({ data }: { data: XboxSnapshot }) {
  const gamesRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const online = data.state === 'Online'
  const currentIndex = data.games.length ? activeIndex % data.games.length : 0
  const featured = data.games[currentIndex]

  const selectGame = (index: number) => {
    if (!data.games.length) return
    const next = (index + data.games.length) % data.games.length
    const rail = gamesRef.current
    const tile = rail?.children.item(next) as HTMLElement | null
    if (rail && tile) rail.scrollTo({ left: tile.offsetLeft - (rail.clientWidth - tile.clientWidth) / 2, behavior: 'smooth' })
    setActiveIndex(next)
  }

  return <section className={styles.platformSection} aria-label="Xbox activity">
    <div className={styles.sectionHeading}>
      <div><p className="kicker">XBOX / ACTIVITY</p><h2>achievement-feed</h2></div>
      <div className={styles.identity}>{data.profile?.avatar && <img src={data.profile.avatar} alt="" />}<span>{data.profile?.gamertag || 'xbox account'}<small className={online ? styles.online : ''}>{data.state.toLowerCase()}</small></span></div>
    </div>

    <div className={styles.xboxDashboard}>
      {featured?.cover && <img className={styles.xboxBackdrop} src={featured.cover} alt="" />}
      <div className={styles.xboxHome}>
        <header className={styles.xboxQuickAccess}>
          <span className={styles.xboxMark}>X</span>
          <nav aria-label="Xbox quick access"><span title="Games"><Gamepad2 /></span><span title="Library"><Library /></span><span title="Store"><ShoppingBag /></span><span title="Search"><Search /></span><span title="Settings"><Settings /></span></nav>
          <div className={styles.xboxSwitcher}><button type="button" title="Previous game" aria-label="Previous Xbox game" onClick={() => selectGame(currentIndex - 1)}><ChevronLeft /></button><button type="button" title="Next game" aria-label="Next Xbox game" onClick={() => selectGame(currentIndex + 1)}><ChevronRight /></button></div>
          <div className={styles.xboxScore}><Wifi className={online ? styles.online : ''} /><strong>{data.profile?.gamerscore.toLocaleString() || '0'} G</strong></div>
        </header>
        {data.message ? <p className={styles.platformMessage}>{data.message}</p> : <>
          <div className={styles.xboxSpotlight}>
            <small>{featured?.devices?.some((device) => device === 'PC' || device === 'Win32') ? 'XBOX / PC · SHARED ACTIVITY' : 'RECENTLY PLAYED'}</small>
            <h3>{featured?.name || 'dashboard'}</h3>
            {featured && <p><Trophy /> {featured.achievements} achievements <span>/</span> {featured.gamerscore} G</p>}
          </div>
          <div className={styles.xboxGames} ref={gamesRef} onKeyDown={(event) => { if (event.key === 'ArrowLeft') selectGame(currentIndex - 1); if (event.key === 'ArrowRight') selectGame(currentIndex + 1) }}>{data.games.length ? data.games.map((game, index) => <button type="button" aria-pressed={index === currentIndex} className={`${styles.xboxGame} ${index === currentIndex ? styles.selected : ''}`} key={game.titleId} onClick={() => selectGame(index)}>
            <div className={styles.xboxCover}>{game.cover ? <img src={game.cover} alt="" /> : <span>XB</span>}</div>
            <h3>{game.name}</h3>
            <div className={styles.xboxMeta}><span><Trophy />{game.achievements}</span><span>{game.gamerscore} G</span><span>{game.minutes === null ? '-- h' : `${(game.minutes / 60).toFixed(1)} h`}</span></div>
          </button>) : <p className={styles.platformMessage}>no Xbox title history</p>}</div>
        </>}
      </div>
    </div>
  </section>
}
