export function isComplianceEnabled(): boolean {
  return process.env.COMPLIANCE_ENABLED === 'true';
}
