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
  const millisecondsPerDay = 24 * millisecondsPerHour;

  const days = Math.floor(difference / millisecondsPerDay);
  const hours = Math.floor((difference % millisecondsPerDay) / millisecondsPerHour);
  const minutes = Math.floor((difference % millisecondsPerHour) / millisecondsPerMinute);

  const daysText = days > 0 ? `${days}${clean ? 'd' : ` day${days !== 1 ? "s" : ""}`}` : "";
  const hoursText = hours > 0 ? `${hours}${clean ? 'h' : ` hour${hours !== 1 ? "s" : ""}`}` : "";
  const minutesText = minutes > 0 ? `${minutes}${clean ? 'm' : ` min${minutes !== 1 ? "s" : ""}`}` : "";

  if (days > 0) {
      return `${daysText} ${hoursText} ago`;
  } else if (hours > 0) {
      return `${hoursText} ${minutesText} ago`;
  } else {
      return `${minutesText} ago`;
  }
}

export function createSignature(timestamp: string, method: string, requestPath: string, body?: string, SECRET_KEY?: string): string {
    const prehashString = `${timestamp}${method}${requestPath}${body}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY || '');
    hmac.update(prehashString);
    return hmac.digest('base64');
}

export function toFixed(x: any): string {
  if (Math.abs(x) < 1.0) {
    // eslint-disable-next-line no-var
    var e = parseInt(x.toString().split('e-')[1]);
    if (e) {
      x *= Math.pow(10, e - 1);
      x = String('0.' + (new Array(e)).join('0') + x.toString().substring(2));
    }
  } else {
    // eslint-disable-next-line no-var
    var e = parseInt(x.toString().split('+')[1]);
    if (e > 20) {
      e -= 20;
      x /= Math.pow(10, e);
      x = String(x + (new Array(e + 1)).join('0'));
    }
  }
  return x;
}
export const zerofy = (_value: number | string, minZeroDecimal: number = 4): string => {
  const value = Number(toFixed(_value))
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

export const formatU = (u: string | number): string => {
  const num = typeof u === 'string' ? parseFloat(u) : u;
  return num < 0 ? `-$${zerofy(Math.abs(num))}` : `+$${zerofy(num)}`;
};
export const decodeSymbol = (symbol:string) => {
  return symbol.split('-').slice(0,2).join('/')
}
export function getRandomElementFromArray<T>(array: T[]): T {
  if (!Array.isArray(array) || array.length === 0) {
      throw new Error('Input should be a non-empty array.');
  }

  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}
