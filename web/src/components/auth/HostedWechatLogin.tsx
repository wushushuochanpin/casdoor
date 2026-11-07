import {HostedBrand} from "./HostedBrand";
import * as React from "react";
import {LoginLegalDialog, type LoginLegalDocument} from "./LoginLegal";
import * as Provider from "@/auth/Provider";
import * as Setting from "@/lib/setting";
import "./hosted-wechat-login.css";
import {getHostedContext, hostedAction} from "./hosted-context";
import {isHostedApplication} from "./hosted-applications";

// Pilot rollout is selected from the server-validated application, never query branding.
export function getHostedWechatProvider(application: any) {
  if (!isHostedApplication(application)) return null;
  const providers = (application.providers ?? []).filter(Setting.isProviderVisibleForSignIn);
  const provider = providers.length === 1 ? providers[0].provider : null;
  return provider?.type === "WeChat" && provider.clientId && !provider.clientId2 ? provider : null;
}

type WidgetOptions = {
  id: string; appid: string; scope: string; redirect_uri: string; state: string;
  self_redirect: false; href: string;
};
type Widget = new(options: WidgetOptions) => unknown;
const scriptUrl = "https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js";
// Reuse the shared SDK's official href customization. No frame scaling or QR cropping.
const widgetStyle = "body{margin:0!important;background:#fff!important;font:16px/1.6 system-ui,sans-serif!important;color:#000!important}.impowerBox{width:100%!important}.impowerBox .title,.impowerBox .status_normal,.impowerBox .status_browser{display:none!important}.impowerBox .qrcode{width:200px!important;height:200px!important;margin:12px auto 0!important;border:0!important}.impowerBox .info{width:100%!important;height:240px;display:grid;place-items:center;margin:0!important}.impowerBox .status{text-align:center!important;padding:12px!important;font:16px/1.6 system-ui,sans-serif!important;box-shadow:none!important;background:none!important}.impowerBox .status p{font:inherit!important;margin:8px 0!important}.status_icon{display:none!important}.impowerBox:has(.status_succ:not([style*=\"display: none\"]):not([style*=\"display:none\"])) .wrp_code,.impowerBox:has(.status_fail:not([style*=\"display: none\"]):not([style*=\"display:none\"])) .wrp_code{display:none!important}";
let widgetPromise: Promise<Widget> | undefined;
function loadWidget() {
  const getWidget = () => (window as Window & {WxLogin?: Widget}).WxLogin;
  if (getWidget()) return Promise.resolve(getWidget()!);
  if (widgetPromise) return widgetPromise;
  widgetPromise = new Promise<Widget>((resolve, reject) => {
    const script = document.createElement("script");
    const finish = (failed = false) => {
      clearTimeout(timer);
      const widget = getWidget();
      if (failed || !widget) {
        script.remove();
        widgetPromise = undefined;
        reject(new Error("widget_unavailable"));
      } else resolve(widget);
    };
    const timer = setTimeout(() => finish(true), 12000);
    script.src = scriptUrl;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.onload = () => finish();
    script.onerror = () => finish(true);
    document.head.append(script);
  });
  return widgetPromise;
}

export function HostedWechatLogin({application, provider, accountPending, signedIn, busy, error, onContinue}: {
  application: any; provider: any; accountPending: boolean; signedIn: boolean;
  busy: boolean; error: string | null; onContinue: () => void;
}) {
  const [legalDocument, setLegalDocument] = React.useState<LoginLegalDocument | null>(null);
  const [motionPaused, setMotionPaused] = React.useState(false);
  const [phase, setPhase] = React.useState<"loading" | "scan" | "error" | "expired" | "cancelled">("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [useAnotherAccount, setUseAnotherAccount] = React.useState(false);
  const [transactionState, setTransactionState] = React.useState("pending");
  const hosted = getHostedContext();
  const mount = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/:/g, "");
  const existingSession = signedIn && !useAnotherAccount;
  const paused = accountPending || busy || existingSession || phase === "cancelled" || transactionState !== "pending";
  const inWechat = navigator.userAgent.includes("MicroMessenger");
  const blocked = !!(application.ipRestriction || application.organizationObj?.ipRestriction);

  React.useEffect(() => {
    document.title = `鲜知认证中心 · ${application.displayName}`;
  }, [application.displayName]);

  React.useEffect(() => {
    if (!hosted) return;
    let active = true, checking = false;
    const check = async() => {
      if (checking) return;
      checking = true;
      try {
        const result = await hostedAction("status");
        if (active) setTransactionState(result.status);
      } catch (error) {
        if (active) setTransactionState(error instanceof Error && error.message === "invalid_hosted_transaction" ? "expired" : "unavailable");
      } finally {checking = false;}
    };
    const expire = setTimeout(() => {if (active) setTransactionState("expired");}, Math.max(0, hosted.expiresAt - Date.now()));
    const interval = setInterval(() => {if (!document.hidden) void check();}, 3000);
    const focus = () => {void check();};
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {active = false; clearTimeout(expire); clearInterval(interval); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus);};
  }, [hosted]);

  React.useEffect(() => {
    if (paused || blocked || inWechat) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const target = mount.current;
    setPhase("loading");
    void (async() => {
      try {
        const Widget = await loadWidget();
        if (disposed || !target) return;
        // Keep upstream state, callback issuer, nonce and PKCE construction intact.
        const authUrl = new URL(Provider.getAuthUrl(application, provider, "signin"));
        if (authUrl.origin !== "https://open.weixin.qq.com" || authUrl.pathname !== "/connect/qrconnect") throw new Error("invalid_provider");
        target.replaceChildren();
        new Widget({
          id: target.id, appid: authUrl.searchParams.get("appid")!, scope: "snsapi_login",
          redirect_uri: encodeURIComponent(authUrl.searchParams.get("redirect_uri")!),
          state: authUrl.searchParams.get("state")!, self_redirect: false,
          href: encodeURIComponent("data:text/css;base64," + btoa(widgetStyle)),
        });
        const frame = target.querySelector("iframe");
        if (!frame) throw new Error("widget_unavailable");
        frame.title = "使用微信扫码登录";
        frame.referrerPolicy = "no-referrer";
        frame.addEventListener("load", () => {
          if (disposed) return;
          clearTimeout(loadTimer);
          setPhase("scan");
        }, {once: true});
        loadTimer = setTimeout(() => {
          if (!disposed) { target.replaceChildren(); setPhase("error"); }
        }, 15000);
        timer = setTimeout(() => {
          if (!disposed) { target.replaceChildren(); setPhase("expired"); }
        }, Math.min(240000, hosted ? Math.max(0, hosted.expiresAt - Date.now()) : 240000));
      } catch {
        if (!disposed) { target?.replaceChildren(); setPhase("error"); }
      }
    })();
    return () => { disposed = true; clearTimeout(timer); clearTimeout(loadTimer); target?.replaceChildren(); };
  }, [application, provider, attempt, paused, blocked, inWechat, hosted]);

  const retry = async() => {
    if (hosted) {
      setPhase("cancelled");
      try {await hostedAction("cancel"); window.location.assign(hosted.restartUrl);}
      catch {setTransactionState("unavailable");}
      return;
    }
    setPhase("loading"); setAttempt(value => value + 1);
  };
  const cancel = async() => {
    setPhase("cancelled");
    if (hosted) {
      try {await hostedAction("cancel"); setTransactionState("cancelled");}
      catch {setTransactionState("unavailable");}
    }
  };
  const message = blocked ? "当前访问受限，请联系管理员。"
    : inWechat ? "请在电脑或外部浏览器打开此页面，使用微信扫码登录。"
      : transactionState === "unavailable" ? "暂时无法确认登录状态，请刷新登录。"
        : transactionState !== "pending" ? "本次登录已失效，请刷新登录。"
          : accountPending ? "正在检查登录状态…"
            : busy ? `正在返回 ${application.displayName}…`
              : existingSession ? "已登录鲜知认证中心"
                : phase === "error" ? "二维码暂时无法加载，请检查网络后重试。"
                  : phase === "expired" ? "二维码已过期，请重新开始登录。"
                    : phase === "cancelled" ? "登录已取消"
                      : phase === "loading" ? "正在加载二维码…" : "使用微信扫描二维码，在手机上确认登录。";
  const showQr = !blocked && !inWechat && !paused && (phase === "loading" || phase === "scan");
  return (
    <main className="idc-hosted" data-hosted-center={application.clientId} data-motion-paused={motionPaused}>
      <div className="idc-hosted__ambient" aria-hidden="true">
        {["{ }", "const", "< >", "01", "return", "/ /", "await", "( )", "=>", ";"].map((text, index) => <span key={index} style={{"--i": index} as React.CSSProperties}>{text}</span>)}
      </div>
      <div className="idc-hosted__shell">
        <section className="idc-hosted__content" aria-labelledby="idc-hosted-title">
          <HostedBrand />
          <h1 id="idc-hosted-title">登录到 <strong>{application.displayName}</strong></h1>
          <div className="idc-hosted__stage" data-qr={showQr}>
            <div id={`idc-wechat-${id}`} ref={mount} className="idc-hosted__qr" hidden={!showQr} />
            <p role="status" aria-live="polite">{message}</p>
            {error ? <p role="alert">登录未完成，请重新尝试。</p> : null}
            {!blocked && !inWechat && !accountPending && !busy ? (
              <div className={`idc-hosted__actions${showQr ? " idc-hosted__actions--quiet" : ""}`}>
                {transactionState !== "pending" ? <button onClick={retry}>刷新登录</button>
                  : existingSession ? <><button onClick={onContinue}>继续进入 {application.displayName}</button><button className="secondary" onClick={() => setUseAnotherAccount(true)}>使用其他账号</button></>
                    : phase === "expired" ? <button onClick={retry}>刷新登录</button>
                      : phase === "cancelled" ? <button onClick={retry}>重新登录</button>
                        : <><button onClick={retry}>{phase === "error" ? "重试" : "刷新二维码"}</button><button className="secondary" onClick={() => void cancel()}>取消登录</button></>}
              </div>
            ) : null}
          </div>
          <div className="idc-hosted__footer"><p>登录前请阅读 <button type="button" className="idc-hosted__legal-link" onClick={() => setLegalDocument("terms")}>用户服务协议</button> 和 <button type="button" className="idc-hosted__legal-link" onClick={() => setLegalDocument("privacy")}>隐私政策</button></p></div>
        </section>
      </div>
      <footer className="idc-hosted__company">
        <span>鲜知（北京）科技有限公司</span><span>Copyright © 2026 Xenzify Inc. 保留所有权利</span>
        <button type="button" className="idc-hosted__legal-link" onClick={() => setLegalDocument("terms")}>服务协议</button>
        <button type="button" className="idc-hosted__legal-link" onClick={() => setLegalDocument("privacy")}>隐私政策</button>
        <a href="https://www.xenzify.com/#contact" target="_blank" rel="noopener noreferrer">公司官网</a>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">官网备案：京ICP备2026022111号-1</a>
        <a href="https://beian.mps.gov.cn/#/query/webSearch?code=11010502060395" target="_blank" rel="noopener noreferrer">官网备案：京公网安备11010502060395号</a>
      </footer>
      <LoginLegalDialog document={legalDocument} onClose={() => setLegalDocument(null)}/>
      <button className="idc-hosted__motion" type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? "播放背景动效" : "暂停背景动效"}</button>
    </main>
  );
}
