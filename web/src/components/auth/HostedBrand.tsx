import * as React from "react";

export function HostedBrand() {
  React.useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    const previous = link?.getAttribute("href");
    if (link) link.href = "/brand/xenzify-favicon-32.png";
    return () => {if (link && previous) link.href = previous;};
  }, []);
  return <header className="idc-hosted__brand">
    <img src="/brand/xenzify-logo.svg" width="220" height="86" alt="鲜知科技 Xenzify · 鲜知认证中心" />
  </header>;
}
