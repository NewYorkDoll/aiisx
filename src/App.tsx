import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { ArrowUpRight, Command, Cpu, Radio, Terminal } from 'lucide-react'
import Journal from './routes/Journal'
import Write from './routes/Write'
import Games from './routes/Games'
import Fitness from './routes/Fitness'
import Manage from './routes/Manage'
import Article from './routes/Article'
import Login from './routes/Login'
import './App.css'

function Shell() {
  return <div className="site-frame"><header className="site-header"><Link to="/" className="brand" aria-label="回到首页"><span className="brand-signal" /><span>aiisx / personal system</span></Link><nav className="command-nav" aria-label="主导航"><Link to="/" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>journal</Link><Link to="/game-are-life" activeProps={{ className: 'active' }}>games</Link><Link to="/fitness" activeProps={{ className: 'active' }}>training</Link></nav><a className="icon-button" href="https://github.com/NewYorkDoll" target="_blank" rel="noreferrer" aria-label="打开 GitHub"><ArrowUpRight size={16} strokeWidth={1.8} /></a></header><main className="console-wrap"><div className="console-window"><div className="window-chrome"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><span className="window-title"><Terminal size={13} /> ~/life</span><span className="window-meta">utf-8 / zsh</span></div><div className="console-body"><Outlet /></div><div className="status-bar"><span><Radio size={13} /> online</span><span><Cpu size={13} /> node / local</span><span className="status-spacer" /><span><Command size={13} /> 2026.08</span></div></div></main><footer className="site-footer"><span>yiziluoying</span><span className="dim">a quiet place for loud ideas</span></footer></div>
}

const rootRoute = createRootRoute({ component: Shell })
const journalRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Journal })
const writeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/write', component: Write })
const editRoute = createRoute({ getParentRoute: () => rootRoute, path: '/write/$slug', component: Write })
const manageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/journal/manage', component: Manage })
const articleRoute = createRoute({ getParentRoute: () => rootRoute, path: '/journal/$slug', component: Article })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: Login })
const gamesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/game-are-life', component: Games })
const fitnessRoute = createRoute({ getParentRoute: () => rootRoute, path: '/fitness', component: Fitness })
const routeTree = rootRoute.addChildren([journalRoute, writeRoute, editRoute, manageRoute, articleRoute, loginRoute, gamesRoute, fitnessRoute])
const router = createRouter({ routeTree })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
export default function App() { return <RouterProvider router={router} /> }
