export type SmsProvider = "africastalking" | "twilio" | "custom" | "safravo";

export interface SmsConfig {
  provider: SmsProvider;
  apiKey?: string;
  username?: string;
  senderId?: string;
  accountSid?: string;
  authToken?: string;
  from?: string;
  partnerId?: string;
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

  // Format phone number for Safravo (Kenya format: 254XXXXXXXXX)
  let phoneNumber = message.to.replace(/\D/g, '');
  if (phoneNumber.startsWith('0')) {
    phoneNumber = '254' + phoneNumber.substring(1);
  } else if (!phoneNumber.startsWith('254') && phoneNumber.length === 9) {
    phoneNumber = '254' + phoneNumber;
  }

  try {
    const res = await fetch(`${config.baseUrl}/sms/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "*/*" },
      body: JSON.stringify({
        apikey: config.apiKey,
        partnerID: config.partnerId,
        mobile: phoneNumber,
        message: message.body,
        shortcode: config.senderId || "DrumvaleSec",
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    
    console.log('[Safravo] Response:', res.status, data);
    
    if (res.ok && (data.success || data.message_id || data.id || data.MessageId || data.messageId)) {
      return { success: true, messageId: data.message_id || data.id || data.MessageId || data.messageId || "sent" };
    }
    return { success: false, error: data.message || data.error || data.Message || data.details || `Safravo error: ${res.status} - ${text}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
