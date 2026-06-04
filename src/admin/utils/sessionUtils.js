export const parseSessionAgent = (userAgent) => {
  const agent = String(userAgent || '');
  let browser = 'Browser';
  let os = 'Unknown OS';
  let deviceType = 'Desktop';
  let deviceIcon = 'laptop';

  if (/Edg\//i.test(agent)) browser = 'Edge';
  else if (/Chrome\//i.test(agent)) browser = 'Chrome';
  else if (/Firefox\//i.test(agent)) browser = 'Firefox';
  else if (/Safari\//i.test(agent) && !/Chrome/i.test(agent)) browser = 'Safari';

  if (/Windows/i.test(agent)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(agent)) os = 'macOS';
  else if (/Android/i.test(agent)) os = 'Android';
  else if (/iPhone|iPad/i.test(agent)) os = /iPad/i.test(agent) ? 'iPadOS' : 'iOS';
  else if (/Linux/i.test(agent)) os = 'Linux';

  if (/Mobile|Android|iPhone/i.test(agent)) {
    deviceType = 'Mobile';
    deviceIcon = 'mobile';
  } else if (/iPad|Tablet/i.test(agent)) {
    deviceType = 'Tablet';
    deviceIcon = 'mobile';
  }

  return { browser, os, deviceType, deviceIcon };
};
