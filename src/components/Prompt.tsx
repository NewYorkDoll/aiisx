import type { ReactNode } from 'react'

export function Prompt({ command, children }: { command: string; children: ReactNode }) {
  return <section className="prompt-block"><div className="prompt-line"><span className="prompt-user">aiisx@yiziluoying</span><span className="prompt-path">:~$</span><span className="prompt-command">{command}</span></div>{children}</section>
}

export function PromptInput() {
  return <div className="prompt-input"><span className="prompt-user">aiisx@yiziluoying</span><span className="prompt-path">:~$</span><span className="blink-line" /></div>
}
