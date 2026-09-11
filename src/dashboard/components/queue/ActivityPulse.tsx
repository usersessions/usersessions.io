export function ActivityPulse({ active }: { active: boolean }) {
  if (!active) return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'rgba(52,211,153,0.25)', marginLeft: 8, verticalAlign: 'middle' }} />
  return (
    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'rgba(52,211,153,0.85)', marginLeft: 8, verticalAlign: 'middle', boxShadow: '0 0 0 0 rgba(52,211,153,0.4)', animation: 'us-pulse 1.6s ease-out' }} />
  )
}
