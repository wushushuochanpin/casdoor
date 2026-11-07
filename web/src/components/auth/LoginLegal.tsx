import {useEffect, useId, useRef} from "react";

export type LoginLegalDocument = "terms" | "privacy"
const documents:Record<LoginLegalDocument,{title:string;sections:readonly (readonly [string,string])[]}>={
  terms:{title:"用户服务协议",sections:[
    ["服务提供方与适用范围","本服务由鲜知（北京）科技有限公司提供，向已接入的产品提供统一账号登录、身份验证和会话安全能力。本协议适用于认证中心；接入产品的业务功能、收费和内容规则，以相应产品的说明和协议为准。联系邮箱：support@xenzify.com。"],
    ["登录与账号使用","请使用你本人合法持有或经授权使用的账号。选择微信登录时，需要在微信提供的页面确认授权。你可以在授权前停止登录。请妥善保护账号和登录设备，不向他人提供验证码、授权凭证或会话信息；发现异常请及时退出并联系我们。"],
    ["产品访问与数据边界","完成身份验证不代表自动获得所有产品、组织或资源的访问权限；具体权限由接入产品核验。统一登录不自动合并不同账号，不替代产品的额外安全验证，也不解锁或恢复密码库。请在目标产品中确认本次登录结果。"],
    ["合理使用与安全处置","不得利用本服务冒用身份、绕过权限、窃取账号、攻击系统或从事违法活动。发现异常登录或安全风险时，我们可能要求补充验证、限制相关请求或撤销有风险的会话。对限制有异议时，可联系我们核实。"],
    ["服务中断与责任","网络、微信等第三方服务或系统维护可能影响登录。我们会合理处理故障并提供必要的恢复指引。法律规定的责任不因本协议免除；我们不会通过本协议排除因故意或重大过失应承担的责任。"],
    ["停止使用、变更与争议","你可以停止使用本服务，并通过联系邮箱提出账号或个人信息处理请求。账号注销可能影响使用该身份登录的产品，请先确认业务数据的处理方式。涉及你重要权益的协议调整会通过适当方式告知，依法需要同意的另行征求同意。争议可先协商解决，协商不成可向有管辖权的人民法院提起诉讼。"],
  ]},
  privacy:{title:"隐私政策",sections:[
    ["适用范围与联系方式","鲜知（北京）科技有限公司是本认证服务的运营主体。本政策说明统一登录中的个人信息处理，不覆盖接入产品独立提供的业务服务。有关个人信息的问题或权利请求，请发送至 support@xenzify.com。"],
    ["登录时处理的信息","为识别账号和完成微信登录，我们处理微信返回的用户标识，以及在授权范围内返回的昵称、头像等基本资料；并处理必要的授权校验信息。我们不通过此登录页面获取你的微信密码、聊天记录、通讯录或支付信息。实际授权内容以微信展示的授权页面为准。"],
    ["会话与安全信息","为维持登录、识别异常请求、排查故障和执行退出撤销，我们处理登录时间、来源应用、会话标识、认证结果，以及服务请求中必要的 IP 地址、浏览器或客户端信息和安全日志。浏览器会使用必要的 Cookie 或存储保存登录状态、关联认证请求；禁用必要存储可能导致登录失败或无法保持登录。"],
    ["用途与接收方","上述信息用于身份验证、展示必要的账号资料、建立或撤销登录会话和保障服务安全。微信是你选择的第三方身份验证服务，扫码及授权环节同时适用微信自身的规则。当前接入产品会接收完成登录所需的身份标识、基本资料和认证结果，用于建立该产品自己的会话与核验访问权限；不会因一次登录而向所有接入产品开放你的资料。"],
    ["产品数据边界","认证中心不接收 BrowseMate 密码库的明文内容和未封装密钥，账号恢复不能恢复或解密密码库。接入产品中的文档、业务内容和访问权限由各产品负责，使用相应功能前请阅读该产品的隐私说明。"],
    ["保存与保护","我们将信息保存期限限制在完成登录、维护账号、安全审计以及履行法定义务所需的范围内，按信息用途、会话有效期、账号状态及法定要求确定期限。目的完成或期限届满后依法删除或匿名化；依法须保留的信息限制用途。我们采用访问控制、传输保护和会话校验等措施降低泄露及未经授权访问的风险。"],
    ["你的权利与选择","你可以停止本次登录、退出已有会话，并联系我们申请查阅、复制、更正、删除个人信息、撤回授权或注销账号。我们会在核实必要身份后依法处理并反馈；撤回授权不影响撤回前合法进行的处理，必要信息无法继续处理时相关登录能力可能不可用。请勿在邮件中发送密码、验证码或密码库内容。"],
    ["未成年人、变更与其他处理","未成年人请在监护人指导下使用；涉及不满十四周岁未成年人个人信息时，须依法取得监护人同意并采取专门保护措施。本政策未说明的新用途、新接收方或依法需要单独同意的处理，应在发生前另行告知并依法履行相应程序。重要政策变更会通过适当方式通知。"],
  ]},
};

export function LoginLegalDialog({document,onClose}:{document:LoginLegalDocument|null;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
  useEffect(()=>{if(document){dialog.current?.showModal();if(dialog.current)dialog.current.scrollTop=0;}else if(dialog.current?.open)dialog.current.close();},[document]);
  const content=documents[document??"terms"];
  return <dialog className="idc-hosted__legal" ref={dialog} aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>
    <header className="idc-hosted__legal-head"><h2 id={titleId}>{content.title}</h2><button type="button" className="idc-hosted__legal-close" onClick={onClose} autoFocus>关闭</button></header>
    <div className="idc-hosted__legal-body"><p className="idc-hosted__legal-date">更新日期：2026年10月27日</p>{content.sections.map(([heading,body])=><section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}</div>
  </dialog>;
}
