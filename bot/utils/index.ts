import crypto from 'crypto'
export function decodeTimestamp(ts: number, UTC: number =  7 * 60 * 60 * 1000): string {
    const date = new Date(ts + UTC);
    return date.toISOString(); // Returns date in ISO 8601 format (e.g., '2023-08-23T12:34:56.789Z')
  }

export function createSignature(timestamp: string, method: string, requestPath: string, body?: string, SECRET_KEY?: string): string {
    const prehashString = `${timestamp}${method}${requestPath}${body}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY || '');
    hmac.update(prehashString);
    return hmac.digest('base64');
}
