import {createHash} from 'node:crypto'
import {readdir, readFile, writeFile} from 'node:fs/promises'
import {join, relative, resolve, sep} from 'node:path'

const root = resolve(process.argv[2] || 'build')
const sha = process.env.GITHUB_SHA
if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('GITHUB_SHA must identify the exact checkout')
const files = {}
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (entry.isFile()) {
      const name = relative(root, file).split(sep).join('/')
      if (name === 'hosted-return-manifest.json') throw new Error('manifest already exists')
      files[name] = createHash('sha256').update(await readFile(file)).digest('hex')
    } else throw new Error('unexpected non-regular build artifact')
  }
}
await walk(root)
if (!files['index.html'] || !files['AuthCallbackHandler.js']) throw new Error('incomplete frontend artifact')
await writeFile(join(root, 'hosted-return-manifest.json'), JSON.stringify({sourceCommit:sha, runId:process.env.GITHUB_RUN_ID, runAttempt:process.env.GITHUB_RUN_ATTEMPT, providerFixture:true, realWechatVerified:false, files}, null, 2)+'\n')
