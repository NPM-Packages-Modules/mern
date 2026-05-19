interface SecretRule { name: string; regex: RegExp }

const RULES: SecretRule[] = [
  { name: "AWS Access Key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub Token", regex: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "GitHub Token (fine-grained)", regex: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { name: "Slack Token", regex: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Stripe Secret Key", regex: /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/ },
  { name: "Google API Key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: "Private Key", regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/ },
  { name: "JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

export function scanForSecrets(content: string): string[] {
  const findings: string[] = [];
  for (const rule of RULES) {
    if (rule.regex.test(content)) findings.push(rule.name);
  }
  return findings;
}
