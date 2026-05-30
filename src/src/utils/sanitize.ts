const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<script[\s\S]*?\/>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[\s\S]*?>/gi,
  /<object[\s\S]*?>/gi,
  /<embed[\s\S]*?>/gi,
  /<link[\s\S]*?>/gi,
  /<meta[\s\S]*?>/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /<style[\s\S]*?>[\s\S]*?<\/style>/gi,
];

export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let result = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

export function sanitizeMessageContent(content: string): string {
  if (!content || typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.length === 0) return '';
  return sanitizeText(trimmed);
}

export function containsXSS(input: string): boolean {
  const lc = input.toLowerCase();
  return (
    lc.includes('<script') ||
    lc.includes('javascript:') ||
    lc.includes('onerror=') ||
    lc.includes('onload=') ||
    lc.includes('onclick=') ||
    lc.includes('onmouseover=') ||
    lc.includes('<iframe') ||
    lc.includes('vbscript:') ||
    lc.includes('expression(')
  );
}

export function sanitizeForDB(input: string): string {
  return sanitizeText(input).slice(0, 4000);
}
