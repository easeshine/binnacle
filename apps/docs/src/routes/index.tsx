import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="prose">
      <h1>binnacle</h1>
      <p>A terminal app for DeepSeek Harness (dsh). Everything it draws and answers is a plugin that you can change.</p>
      <ul>
        <li>
          <a href="/docs/use">Using binnacle</a>: what you can do with it.
        </li>
        <li>
          <a href="/docs/author">Changing binnacle</a>: how a plugin changes it.
        </li>
      </ul>
      <p>
        An agent reads every page at <a href="/llms-full.txt">/llms-full.txt</a>, and the index at <a href="/llms.txt">/llms.txt</a>.
      </p>
    </div>
  )
}
