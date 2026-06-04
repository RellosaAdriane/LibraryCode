export const appendStatusMessage = (baseMessage, nextMessage) => {
  const base = String(baseMessage || '').trim().replace(/[.!?]+$/, '');
  const next = String(nextMessage || '').trim().replace(/[.!?]+$/, '');
  if (!base) return next ? `${next}.` : '';
  if (!next) return `${base}.`;
  return `${base}. ${next}.`;
};

export const joinStatusParts = (parts) => {
  if (parts.length <= 1) return parts[0] || '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};
