import { env } from '../config/env.js';
import { AppError } from './errors.js';

export interface WeChatSession {
  openid: string;
}

interface WeChatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

export async function exchangeCodeForOpenid(code: string): Promise<WeChatSession> {
  if (env.WX_MOCK) {
    return { openid: `mock_openid_${code}` };
  }

  if (!env.WX_APPID || !env.WX_SECRET) {
    throw new AppError(500, 'INTERNAL_ERROR', '微信 AppID 或 Secret 未配置');
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', env.WX_APPID);
  url.searchParams.set('secret', env.WX_SECRET);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AppError(502, 'UPSTREAM_ERROR', '微信登录服务暂不可用');
  }

  const body = (await response.json()) as WeChatCode2SessionResponse;
  if (body.errcode || !body.openid) {
    throw new AppError(401, 'WECHAT_AUTH_FAILED', '微信登录失败，请重试');
  }

  return { openid: body.openid };
}
