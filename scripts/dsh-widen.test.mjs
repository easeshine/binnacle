import { test } from 'vite-plus/test'
import assert from 'node:assert/strict'
import { newest, onDsh, tested, widen } from './dsh-widen.mjs'

const PKG = {
  name: '@easeshine/binnacle',
  peerDependencies: {
    '@deepseek-ai/cordis': '4.0.5-alpha.1',
    '@deepseek-ai/dsh-agent': '0.2.1-alpha.1',
    '@deepseek-ai/dsh-llm': '0.2.1-alpha.1',
    '@deepseek-ai/cordis-plugin-loader': '1.0.6-alpha.1',
  },
  devDependencies: {
    '@deepseek-ai/cordis': '4.0.5-alpha.1',
    '@deepseek-ai/cordis-plugin-loader': '1.0.6-alpha.1',
    '@deepseek-ai/dsh-agent': '0.2.1-alpha.1',
    '@deepseek-ai/dsh-llm': '0.2.1-alpha.1',
    typescript: '^7.0.2',
  },
}

test('binnacle tests on one dsh, the version of its dsh packages in devDependencies', () => {
  assert.equal(tested(PKG), '0.2.1-alpha.1')
  assert.throws(
    () => tested({ devDependencies: { '@deepseek-ai/dsh-agent': '0.2.1', '@deepseek-ai/dsh-llm': '0.2.2' } }),
    /more than one dsh/,
  )
})

test('the newest dsh is the highest version newer than the one tested, prereleases ordered as semver orders them', () => {
  assert.equal(newest(['0.2.0', '0.2.1-alpha.1', '0.2.1-alpha.10', '0.2.1-alpha.2'], '0.2.1-alpha.1'), '0.2.1-alpha.10')
  assert.equal(newest(['0.2.0', '0.2.1-alpha.1'], '0.2.1-alpha.1'), undefined)
})

test('a range widens from its lowest version to the new one, and a range that holds it stays', () => {
  assert.equal(widen('0.2.1-alpha.1', '0.2.1-alpha.2'), '>=0.2.1-alpha.1 <=0.2.1-alpha.2')
  assert.equal(widen('>=0.2.1-alpha.1 <=0.2.1-alpha.2', '0.2.2'), '>=0.2.1-alpha.1 <=0.2.2')
  assert.equal(widen('>=0.2.1-alpha.1 <=0.2.2', '0.2.2'), '>=0.2.1-alpha.1 <=0.2.2')
})

test('on a new dsh, binnacle tests each dsh package at it and each cordis package at what it takes, and its peers widen to them', () => {
  const moved = onDsh(PKG, '0.2.1-alpha.2', {
    '@deepseek-ai/cordis': '4.0.5-alpha.3',
    '@deepseek-ai/cordis-plugin-loader': '1.0.6-alpha.1',
  })
  assert.deepEqual(moved.devDependencies, {
    '@deepseek-ai/cordis': '4.0.5-alpha.3',
    '@deepseek-ai/cordis-plugin-loader': '1.0.6-alpha.1',
    '@deepseek-ai/dsh-agent': '0.2.1-alpha.2',
    '@deepseek-ai/dsh-llm': '0.2.1-alpha.2',
    typescript: '^7.0.2',
  })
  assert.deepEqual(moved.peerDependencies, {
    '@deepseek-ai/cordis': '>=4.0.5-alpha.1 <=4.0.5-alpha.3',
    '@deepseek-ai/dsh-agent': '>=0.2.1-alpha.1 <=0.2.1-alpha.2',
    '@deepseek-ai/dsh-llm': '>=0.2.1-alpha.1 <=0.2.1-alpha.2',
    '@deepseek-ai/cordis-plugin-loader': '1.0.6-alpha.1',
  })
  assert.equal(moved.name, PKG.name)
})
