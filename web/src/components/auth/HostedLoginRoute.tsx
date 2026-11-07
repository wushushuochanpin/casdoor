import {HostedBrand} from "./HostedBrand";
import * as React from "react";
import {getHostedContext, loadHostedContext} from "./hosted-context";
import LoginPage from "@/pages/auth/LoginPage";
import "./hosted-wechat-login.css";

export default function HostedLoginRoute() {
  const [state, setState] = React.useState("loading");
  const [selectedRestart, setSelectedRestart] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    void loadHostedContext().then(value => {if (active) setState(value.status);}).catch(error => {if (active) setState(error.message === "invalid_hosted_transaction" ? "expired" : "unavailable");});
    return () => {active = false;};
  }, [attempt]);
  if (state === "pending") return <LoginPage type="code" />;
  const restart = getHostedContext()?.restartUrl;
  const options = getHostedContext()?.restartOptions ?? [];
  return <main className="idc-hosted">
    <HostedBrand />
    <section className="idc-hosted__content">
      <h1>登录</h1>
      <div className="idc-hosted__stage">
        <p role="status">{state === "loading" ? "正在准备登录…" : state === "unavailable" ? "暂时无法确认登录状态，请重试。" : "本次登录已失效，请回到原产品重新登录。"}</p>
        {state !== "loading" && (restart ? <a href={restart}>返回原产品重新登录</a> : state === "unavailable" ? <button onClick={() => {setState("loading"); setAttempt(value => value + 1);}}>重试</button> : <>
          {options.length > 0 ? <>
            <label htmlFor="restart-product">选择刚才使用的产品</label>
            <select id="restart-product" value={selectedRestart} onChange={event => setSelectedRestart(event.target.value)}>
              <option value="" disabled>请选择产品入口</option>
              {options.map(option => <option key={option.url} value={option.url}>{option.label}</option>)}
            </select>
            <button disabled={!selectedRestart} onClick={() => window.location.assign(selectedRestart)}>返回所选产品重新登录</button>
          </> : <p>请返回发起登录的产品页面，再次点击登录。</p>}
        </>)}
      </div>
    </section>
    <footer>鲜知（北京）科技有限公司</footer>
  </main>;
}
