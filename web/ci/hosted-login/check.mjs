import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve, extname} from 'node:path'
import {strict as assert} from 'node:assert'

const {chromium} = createRequire(process.env.HOSTED_PLAYWRIGHT_PACKAGE || import.meta.url)('@playwright/test')
const root = resolve(process.argv[2] || 'build')
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://fixture').pathname
  if (pathname === '/callback') {
    res.setHeader('Content-Type', 'text/html')
    return res.end('<!doctype html><div id="callback-status"></div><script src="/AuthCallbackHandler.js"></script><script>window.CasdoorAuthCallback.run()</script>')
  }
  const staticPath = pathname.startsWith('/assets/') || pathname.startsWith('/brand/') || pathname === '/AuthCallbackHandler.js'
  const file = resolve(root, '.' + (staticPath ? pathname : '/index.html'))
  if (!file.startsWith(root + '/')) return res.writeHead(400).end()
  try {
    const data = await readFile(file)
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(file)] || 'application/octet-stream')
    res.end(data)
  } catch { res.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({headless:true, executablePath:process.env.HOSTED_BROWSER_EXECUTABLE || undefined})
const cases = [
  {name:'app-prism', displayName:'Prism', clientId:'prism-wechat-pilot', redirect:'https://prism.superchat.help/api/identity/callback'},
  {name:'app-docmost', displayName:'Xenzify 知识库', clientId:'docmost-book', redirect:'https://book.superchat.help/api/identity/callback'},
]
try {
  for (const [index, item] of cases.entries()) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const id = (index ? 'b' : 'a').repeat(43)
    const query = new URLSearchParams({client_id:item.clientId, redirect_uri:item.redirect, response_type:'code', scope:'openid profile', state:id, nonce:'fixture-nonce', code_challenge:'c'.repeat(43), code_challenge_method:'S256'})
    const application = {owner:'admin', name:item.name, displayName:item.displayName, clientId:item.clientId, organization:'identity', organizationObj:{name:'identity',languages:['zh'],countryCodes:['CN']}, homepageUrl:new URL(item.redirect).origin, enablePassword:false, enableAutoSignin:true, enableSigninSession:true, signinMethods:[], signinItems:[{name:'Providers',visible:true}], providers:[{name:'wechat-web',canSignIn:true,provider:{name:'wechat-web',type:'WeChat',category:'OAuth',clientId:'wx0000000000000000'}}]}
    let productCallback, loginRequest
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin === new URL(item.redirect).origin && url.pathname === new URL(item.redirect).pathname) {
        productCallback = url
        return route.fulfill({status:200, contentType:'text/html', body:'product callback fixture'})
      }
      if (url.pathname.startsWith('/delegation/hosted/requests/')) return route.fulfill({json:{status:'pending',query:query.toString(),expiresAt:Date.now()+300000,restartUrl:origin+'/restart'}})
      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        let body = {status:'ok',data:null}
        if (url.pathname === '/api/get-app-login') body = {status:'ok',data:application}
        else if (url.pathname === '/api/get-account') body = {status:'error',data:'Please login first',msg:''}
        else if (url.pathname === '/api/login') { loginRequest = url; body = {status:'ok',data:'fixture-authorization-code'} }
        return route.fulfill({json:body})
      }
      if (url.href === 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js') return route.fulfill({contentType:'text/javascript',body:"window.WxLogin=function(o){window.widgetOptions=o;const f=document.createElement('iframe');f.srcdoc='<html></html>';document.getElementById(o.id).append(f)}"})
      if (url.origin !== origin) return route.abort()
      return route.continue()
    })
    await page.goto(origin+'/login/t/'+id)
    await page.getByRole('heading',{name:'登录到 '+item.displayName,exact:true}).waitFor({timeout:15000})
    await page.waitForFunction(() => !!window.widgetOptions)
    const options = await page.evaluate(() => window.widgetOptions)
    assert.equal(options.self_redirect, false)
    const state = new URLSearchParams(Buffer.from(options.state,'base64').toString('utf8'))
    for (const key of ['client_id','redirect_uri','state','nonce','code_challenge','code_challenge_method']) assert.equal(state.get(key),query.get(key),`${item.name}: ${key}`)
    assert.equal(new URL(page.url()).search,'', 'authorization data stays out of the short URL')
    await page.goto(origin+'/callback?code=fixture-wechat-code&state='+encodeURIComponent(options.state),{waitUntil:'domcontentloaded'})
    await page.waitForURL(url => url.origin === new URL(item.redirect).origin,{timeout:10000})
    assert.equal(productCallback?.origin+productCallback?.pathname,item.redirect)
    assert.equal(productCallback?.searchParams.get('code'),'fixture-authorization-code')
    assert.equal(productCallback?.searchParams.get('state'),id)
    assert.equal(productCallback?.searchParams.get('iss'),origin)
    assert.equal(loginRequest?.searchParams.get('clientId'),item.clientId)
    assert.deepEqual(errors,[])
    console.log(`PASS ${item.name}: short transaction, provider state and callback`)
    await context.close()
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
