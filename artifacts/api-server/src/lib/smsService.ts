export type SmsProvider = "africastalking" | "twilio" | "custom" | "safravo";

export interface SmsConfig {
  provider: SmsProvider;
  apiKey?: string;
  username?: string;
  senderId?: string;
  accountSid?: string;
  authToken?: string;
  from?: string;
  baseUrl?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(config: SmsConfig, message: SmsMessage): Promise<SmsResult> {
  if (config.provider === "africastalking") {
    return sendAfricasTalking(config, message);
  }
  if (config.provider === "twilio") {
    return sendTwilio(config, message);
  }
  if (config.provider === "safravo") {
    return sendSafravo(config, message);
  }
  return sendCustom(config, message);
}

async function sendAfricasTalking(config: SmsConfig, message: SmsMessage): Promise<SmsResult> {
  if (!config.apiKey || !config.username || !config.senderId) {
    return { success: false, error: "Missing Africa's Talking credentials" };
  }

  const form = new FormData();
  form.append("username", config.username);
  form.append("to", message.to);
  form.append("message", message.body);
  form.append("from", config.senderId);

  try {
    const res = await fetch("https://api.africastalking.com/restless/send", {
      method: "POST",
      headers: { apikey: config.apiKey },
      body: form,
    });

    const text = await res.text();
    const match = text.match(/<string[^>]*>([^<]*)<\/string>/);
    const body = match ? match[1] : text;

    if (res.ok && body.includes("Sent")) {
      return { success: true, messageId: body };
    }
    return { success: false, error: body };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendTwilio(config: SmsConfig, message: SmsMessage): Promise<SmsResult> {
  if (!config.accountSid || !config.authToken || !config.from) {
    return { success: false, error: "Missing Twilio credentials" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
      },
      body: new URLSearchParams({
        To: message.to,
        From: config.from,
        Body: message.body,
        ...(message.mediaUrl ? { MediaUrl: message.mediaUrl } : {}),
      }),
    });

    const data = (await res.json()) as any;
    if (res.ok && data.sid) {
      return { success: true, messageId: data.sid };
    }
    return { success: false, error: data.message || "Twilio error" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendCustom(config: SmsConfig, message: SmsMessage): Promise<SmsResult> {
  if (!config.baseUrl) {
    return { success: false, error: "Missing custom SMS base URL" };
  }

  try {
    const res = await fetch(`${config.baseUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: message.to,
        message: message.body,
        mediaUrl: message.mediaUrl,
        from: config.from,
      }),
    });

    const data = (await res.json()) as any;
    if (res.ok) {
      return { success: true, messageId: data.id || data.messageId };
    }
    return { success: false, error: data.error || data.message || "Custom provider error" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendSafravo(config: SmsConfig, message: SmsMessage): Promise<SmsResult> {
  if (!config.baseUrl) {
    return { success: false, error: "Missing Safravo base URL" };
  }
  if (!config.apiKey) {
    return { success: false, error: "Missing Safravo API key" };
  }

  try {
    const res = await fetch(`${config.baseUrl}/sms/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        to: message.to,
        body: message.body,
        sender_id: config.senderId || "DrumvaleSec",
      }),
    });

    const data = (await res.json()) as any;
    if (res.ok && (data.success || data.message_id || data.id)) {
      return { success: true, messageId: data.message_id || data.id || "sent" };
    }
    return { success: false, error: data.message || data.error || `Safravo error: ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
