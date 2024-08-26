import crypto from 'crypto'
export function decodeTimestamp(ts: number, UTC: number =  7 * 60 * 60 * 1000): string {
    const date = new Date(ts + UTC);
    return date.toISOString(); // Returns date in ISO 8601 format (e.g., '2023-08-23T12:34:56.789Z')
}
export function decodeTimestampAgo(timestamp: number, clean = false): string {
    const currentTime = Date.now();
    const difference = currentTime - timestamp;


    const millisecondsPerMinute = 60 * 1000;
    const millisecondsPerHour = 60 * millisecondsPerMinute;


    const hours = Math.floor(difference / millisecondsPerHour);
    const minutes = Math.floor(
        (difference % millisecondsPerHour) / millisecondsPerMinute
    );
    const hoursText = hours > 0 ? `${hours}${clean ? 'h' : ` hour${hours !== 1 ? "s" : ""}`}` : "";
    const minutesText =
        minutes > 0 ? `${minutes}${clean ? 'm' : ` min${minutes !== 1 ? "s" : ""}`}` : "";


    if (hours > 0 && minutes > 0) {
        return `${hoursText} ${minutesText} ago`;
    } else {
        return `${hoursText}${minutesText} ago`;
    }
}
export function createSignature(timestamp: string, method: string, requestPath: string, body?: string, SECRET_KEY?: string): string {
    const prehashString = `${timestamp}${method}${requestPath}${body}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY || '');
    hmac.update(prehashString);
    return hmac.digest('base64');
}

export const zerofy = (_value: number | string, minZeroDecimal: number = 4): string => {
  const value = Number(Number(_value).toFixed(2))
  const countZeroAfterDot = -Math.floor(Math.log10(value) + 1)
  if (
    Number.isFinite(countZeroAfterDot) &&
    countZeroAfterDot >= minZeroDecimal
  ) {
    const ucZeros = String.fromCharCode(
      parseInt(`+208${countZeroAfterDot}`, 16)
    )
    return value
      .toLocaleString('fullwide', {
        maximumSignificantDigits: 4,
        maximumFractionDigits: 18
      })
      .replace(/[.,]{1}0+/, `.0${ucZeros}`)
  }
  return value.toLocaleString('fullwide', {
    maximumSignificantDigits: 4,
    maximumFractionDigits: 18
  })
}
