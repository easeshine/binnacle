#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function bodyOf(request) {
  return new Promise((done, fail) => {
    let text = ''
    request.on('data', (chunk) => {
      text += chunk
    })
    request.on('end', () => done(text))
    request.on('error', fail)
  })
}

function send(response, code, type, body) {
  response.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  response.end(body)
}

// A thread waits for the agent when the person spoke last in it, resolved or not.
const lastBy = (comment) => (comment.replies.length > 0 ? comment.replies.at(-1).by : comment.by)

// Serves one markdown file on 127.0.0.1, behind a token. `done` gives the summary once the person hands over.
export async function openDoc(file, { home = join(homedir(), '.binnacle') } = {}) {
  const path = resolve(file)
  const name = `${createHash('sha1').update(path).digest('hex').slice(0, 8)}-${basename(path, '.md')}`
  const dir = join(home, 'docs', name)
  const commentsPath = join(dir, 'comments.json')
  const beforePath = join(dir, 'before.md')
  await mkdir(dir, { recursive: true })
  const source = await readFile(path, 'utf8')
  // Each pass keeps the file as the person first saw it, so the agent can diff the edits.
  await copyFile(path, beforePath)
  const comments = existsSync(commentsPath) ? JSON.parse(await readFile(commentsPath, 'utf8')) : []
  const token = randomBytes(12).toString('hex')
  const page = await readFile(join(here, 'page.html'), 'utf8')
  const marked = await readFile(join(here, 'marked.esm.js'), 'utf8')

  let handedOver
  const done = new Promise((ok) => {
    handedOver = ok
  })
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://doc')
    if (url.searchParams.get('t') !== token) return send(response, 403, 'text/plain', 'wrong token')
    if (request.method === 'GET' && url.pathname === '/') return send(response, 200, 'text/html', page)
    if (request.method === 'GET' && url.pathname === '/marked.js') return send(response, 200, 'text/javascript', marked)
    if (request.method === 'GET' && url.pathname === '/state')
      return send(response, 200, 'application/json', JSON.stringify({ path, name: basename(path), source, comments }))
    if (request.method === 'POST' && url.pathname === '/handover') {
      const out = JSON.parse(await bodyOf(request))
      const edited = out.source !== source
      if (edited) await writeFile(path, out.source)
      await writeFile(commentsPath, `${JSON.stringify(out.comments, undefined, 2)}\n`)
      send(response, 200, 'application/json', '{}')
      const open = out.comments.filter((comment) => !comment.resolved).length
      const waiting = out.comments.filter((comment) => lastBy(comment) === 'person').length
      server.close()
      return handedOver(
        [
          `HANDOVER ${path}`,
          `edited: ${edited ? `yes, diff with: git diff --no-index ${beforePath} ${path}` : 'no'}`,
          `comments: ${open} open, ${waiting} waiting for the agent, in ${commentsPath}`,
          ...(out.note ? [`note: ${out.note}`] : []),
        ].join('\n'),
      )
    }
    return send(response, 404, 'text/plain', 'not found')
  })
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  const link = `http://127.0.0.1:${server.address().port}/?t=${token}`
  return { path, link, done, close: () => server.close() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const file = args.find((arg) => !arg.startsWith('--'))
  if (file === undefined) {
    console.error('usage: doc.mjs <file.md> [--no-open]')
    process.exit(2)
  }
  const doc = await openDoc(file)
  console.log(`DOC ${doc.path}\n${doc.link}`)
  if (!args.includes('--no-open')) spawn('open', [doc.link], { stdio: 'ignore', detached: true }).unref()
  console.log(await doc.done)
}
