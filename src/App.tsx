import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { ArrowUpRight, Command, Cpu, Radio, Terminal } from 'lucide-react'
import './App.css'

function Shell() {
  return (
    <div className="site-frame">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="回到首页"><span className="brand-signal" /><span>aiisx / personal system</span></Link>
        <nav className="command-nav" aria-label="主导航">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>journal</Link>
          <Link to="/game-are-life" activeProps={{ className: 'active' }}>games</Link>
          <Link to="/fitness" activeProps={{ className: 'active' }}>training</Link>
        </nav>
        <a className="icon-button" href="https://github.com/NewYorkDoll" target="_blank" rel="noreferrer" aria-label="打开 GitHub"><ArrowUpRight size={16} strokeWidth={1.8} /></a>
      </header>
      <main className="console-wrap">
        <div className="console-window">
          <div className="window-chrome"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><span className="window-title"><Terminal size={13} /> ~/life</span><span className="window-meta">utf-8 / zsh</span></div>
          <div className="console-body"><Outlet /></div>
          <div className="status-bar"><span><Radio size={13} /> online</span><span><Cpu size={13} /> node / local</span><span className="status-spacer" /><span><Command size={13} /> 2026.08</span></div>
        </div>
      </main>
      <footer className="site-footer"><span>yiziluoying</span><span className="dim">a quiet place for loud ideas</span></footer>
    </div>
  )
}

function Prompt({ command, children }: { command: string; children: React.ReactNode }) {
  return <section className="prompt-block"><div className="prompt-line"><span className="prompt-user">aiisx@yiziluoying</span><span className="prompt-path">:~$</span><span className="prompt-command">{command}</span></div>{children}</section>
}

function JournalRoute() {
  return (
    <div className="route-stack">
      <Prompt command="journal --today"><div className="journal-hero"><div><p className="kicker">08.28.2026 / FRIDAY</p><h1>Life is a work<br /><em>in progress.</em></h1><p className="lede">我是 yiziluoying。这里记录正在玩的、正在练的，以及值得留下的一点点想法。</p></div><span className="cursor" aria-hidden="true">▋</span></div></Prompt>
      <div className="terminal-grid">
        <Prompt command="tail -n 3 journal.log"><div className="log-list"><LogEntry date="08.28" title="把博客重新装回自己的 Shell" detail="architecture / notes" /><LogEntry date="08.24" title="今天的训练比计划多做了一组" detail="body / discipline" /><LogEntry date="08.19" title="有些游戏适合慢慢玩" detail="games / after hours" /></div></Prompt>
        <Prompt command="status --now"><div className="status-readout"><div><span className="readout-label">sessions / 30d</span><strong>08</strong></div><div><span className="readout-label">last save</span><strong>2.4h</strong></div><div><span className="readout-label">mood</span><strong className="mood">curious</strong></div></div></Prompt>
      </div>
      <div className="prompt-input"><span className="prompt-user">aiisx@yiziluoying</span><span className="prompt-path">:~$</span><span className="blink-line" /></div>
    </div>
  )
}

function LogEntry({ date, title, detail }: { date: string; title: string; detail: string }) {
  return <article className="log-entry"><time>{date}</time><div><h2>{title}</h2><p>{detail}</p></div><span className="log-arrow">↗</span></article>
}

function PlaceholderRoute({ command, title }: { command: string; title: string }) {
  return <div className="route-stack"><Prompt command={command}><div className="placeholder"><p className="kicker">MODULE / READY</p><h1>{title}</h1><p className="lede">The data layer is waiting for its first sync.</p></div></Prompt><div className="prompt-input"><span className="prompt-user">aiisx@yiziluoying</span><span className="prompt-path">:~$</span><span className="blink-line" /></div></div>
}

const rootRoute = createRootRoute({ component: Shell })
const journalRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: JournalRoute })
const gamesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/game-are-life', component: () => <PlaceholderRoute command="games --recent" title="No Game No Life" /> })
const fitnessRoute = createRoute({ getParentRoute: () => rootRoute, path: '/fitness', component: () => <PlaceholderRoute command="training --status" title="Training log" /> })
const routeTree = rootRoute.addChildren([journalRoute, gamesRoute, fitnessRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' { interface Register { router: typeof router } }

export default function App() { return <RouterProvider router={router} /> }
