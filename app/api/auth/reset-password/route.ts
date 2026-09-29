import { NextResponse } from "next/server";
import { getSupabasePublicAuthConfig } from "@/lib/supabase-server";

type ResetPasswordRequest = {
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenHash?: string;
};

function readAuthError(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.msg === "string"
    ? payload.msg
    : typeof payload.message === "string"
      ? payload.message
      : typeof payload.error_description === "string"
        ? payload.error_description
        : fallback;
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function normalizeAuthSession(payload: Record<string, unknown>) {
  const session = payload.session && typeof payload.session === "object" ? (payload.session as Record<string, unknown>) : payload;
  return {
    accessToken: typeof session.access_token === "string" ? session.access_token : "",
    refreshToken: typeof session.refresh_token === "string" ? session.refresh_token : "",
    expiresIn: typeof session.expires_in === "number" ? session.expires_in : 3600,
    user: session.user && typeof session.user === "object" ? (session.user as Record<string, unknown>) : payload.user
  };
}

async function verifyRecoveryTokenHash(tokenHash: string) {
  const { url, anonKey } = getSupabasePublicAuthConfig();
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey
    },
    body: JSON.stringify({
      token_hash: tokenHash,
      type: "recovery"
    })
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readAuthError(payload, "重置链接已失效，请重新申请。"));
  }

  return normalizeAuthSession(payload);
}

async function getAuthUser(accessToken: string) {
  const { url, anonKey } = getSupabasePublicAuthConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readAuthError(payload, "重置链接已失效，请重新申请。"));
  }

  return payload;
}

async function updatePassword(accessToken: string, password: string) {
  const { url, anonKey } = getSupabasePublicAuthConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ password })
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readAuthError(payload, "密码修改失败，请稍后再试。"));
  }

  return payload;
}

export async function POST(request: Request) {
  try {
    const input = (await request.json().catch(() => ({}))) as ResetPasswordRequest;
    const password = typeof input.password === "string" ? input.password : "";
    const tokenHash = typeof input.tokenHash === "string" ? input.tokenHash.trim() : "";
    const providedAccessToken = typeof input.accessToken === "string" ? input.accessToken.trim() : "";

    if (password.length < 8) {
      return NextResponse.json({ code: "WEAK_PASSWORD", error: "新密码至少需要 8 位。" }, { status: 400 });
    }

    const recoverySession = tokenHash
      ? await verifyRecoveryTokenHash(tokenHash)
      : {
          accessToken: providedAccessToken,
          refreshToken: typeof input.refreshToken === "string" ? input.refreshToken : "",
          expiresIn: typeof input.expiresIn === "number" ? input.expiresIn : 3600,
          user: null
        };

    if (!recoverySession.accessToken) {
      return NextResponse.json({ code: "MISSING_RECOVERY_TOKEN", error: "重置链接无效或已过期，请重新申请密码重置。" }, { status: 400 });
    }

    const updatedUser = await updatePassword(recoverySession.accessToken, password);
    const user = recoverySession.user ?? updatedUser ?? (await getAuthUser(recoverySession.accessToken));

    return NextResponse.json({
      session: {
        access_token: recoverySession.accessToken,
        refresh_token: recoverySession.refreshToken,
        expires_in: recoverySession.expiresIn,
        user
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "密码修改失败，请稍后再试。";
    const isExpired = message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid") || message.includes("失效");
    return NextResponse.json(
      {
        code: isExpired ? "RECOVERY_LINK_EXPIRED" : "PASSWORD_RESET_FAILED",
        error: isExpired ? "重置链接已失效，请重新申请。" : message
      },
      { status: isExpired ? 400 : 500 }
    );
  }
}
