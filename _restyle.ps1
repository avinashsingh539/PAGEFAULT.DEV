# One-shot literal restyle: dark slate/sky Lesson+Learn surfaces -> light design tokens.
# Literal ([string]::Replace) token swaps only. No structural edits, no text edits,
# no testid/aria/data-* edits. Run once, then delete this file.
$ErrorActionPreference = 'Stop'
$files = @(
  'ui/src/components/LessonPanels.tsx',
  'ui/src/components/Pipeline.tsx',
  'ui/src/components/Timeline.tsx',
  'ui/src/components/Panels.tsx',
  'ui/src/screens/LearnScreen.tsx'
)
$pairs = @(
  @('text-slate-950', 'text-surface'),
  @('bg-sky-500/15', 'bg-primary-soft'),
  @('bg-sky-500/10', 'bg-primary-soft'),
  @('bg-sky-500/5', 'bg-primary-soft'),
  @('bg-sky-500', 'bg-primary-strong'),
  @('bg-sky-400/10', 'bg-primary-soft'),
  @('bg-sky-400', 'bg-primary'),
  @('border-sky-500/30', 'border-primary/30'),
  @('border-sky-400/60', 'border-primary/40'),
  @('border-sky-500/60', 'border-primary/40'),
  @('hover:border-sky-400/70', 'hover:border-primary/60'),
  @('hover:border-sky-400/60', 'hover:border-primary/60'),
  @('focus:border-sky-400', 'focus:border-primary'),
  @('ring-sky-400/40', 'ring-primary/40'),
  @('hover:bg-sky-400', 'hover:bg-primary'),
  @('hover:text-sky-200', 'hover:text-primary-strong'),
  @('hover:text-sky-100', 'hover:text-primary-strong'),
  @('text-sky-300', 'text-primary-strong'),
  @('text-sky-200', 'text-primary-strong'),
  @('text-sky-100', 'text-primary-strong'),
  @('bg-emerald-400/10', 'bg-hit-soft'),
  @('bg-emerald-400/5', 'bg-hit-soft'),
  @('border-emerald-400/70', 'border-hit/50'),
  @('border-emerald-400/50', 'border-hit/50'),
  @('border-emerald-500/30', 'border-hit/40'),
  @('text-emerald-100', 'text-hit'),
  @('text-emerald-200', 'text-hit'),
  @('text-emerald-300', 'text-hit'),
  @('bg-rose-500/10', 'bg-error-soft'),
  @('border-rose-400/70', 'border-error/60'),
  @('border-rose-500/60', 'border-error/60'),
  @('border-rose-400/50', 'border-error/60'),
  @('text-rose-100', 'text-error'),
  @('text-rose-200', 'text-error'),
  @('text-rose-300', 'text-error'),
  @('bg-amber-400/10', 'bg-fault-soft'),
  @('bg-amber-400/5', 'bg-fault-soft'),
  @('border-amber-400/60', 'border-fault/50'),
  @('border-amber-400/50', 'border-fault/50'),
  @('text-amber-100', 'text-fault'),
  @('text-amber-200', 'text-fault'),
  @('border-violet-500/40', 'border-info/40'),
  @('bg-violet-500/5', 'bg-info-soft'),
  @('text-violet-100', 'text-info'),
  @('text-violet-200', 'text-info'),
  @('text-violet-300', 'text-info'),
  @('bg-slate-900/60', 'bg-surface'),
  @('bg-slate-950/60', 'bg-surface-soft'),
  @('bg-slate-950/40', 'bg-surface-soft'),
  @('bg-slate-950', 'bg-surface-soft'),
  @('bg-slate-900', 'bg-surface-soft'),
  @('bg-slate-800', 'bg-line'),
  @('border-slate-800', 'border-line'),
  @('border-slate-700', 'border-line'),
  @('text-slate-100', 'text-ink'),
  @('text-slate-200', 'text-ink'),
  @('text-slate-300', 'text-ink'),
  @('text-slate-400', 'text-muted'),
  @('text-slate-500', 'text-muted'),
  @('text-slate-600', 'text-muted')
)
foreach ($f in $files) {
  $s = [System.IO.File]::ReadAllText($f)
  foreach ($p in $pairs) { $s = $s.Replace($p[0], $p[1]) }
  $s = $s.Replace('rounded-2xl border border-line bg-surface', 'rounded-card border border-line bg-surface shadow-raised')
  [System.IO.File]::WriteAllText($f, $s)
  Write-Output "restyled $f"
}
Write-Output '--- leftover dark tokens (expect none) ---'
Select-String -Path $files -Pattern '(slate|sky)-(50|100|200|300|400|500|600|700|800|900|950)' | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
