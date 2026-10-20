// one place that decides how heavy a scene may be
export function getTier(params = new URLSearchParams()) {
  const forced = params.get('tier');
  const fine = window.matchMedia('(pointer: fine)').matches;
  const desktop = forced ? forced === 'desktop' : fine && window.innerWidth >= 900;
  // ?mirror=0 switches the planar reflection off for comparison runs, ?mirror=1 forces it on for compact
  const mirrorParam = params.get('mirror');
  if (desktop) {
    return { name: 'desktop', desktop: true, mirror: mirrorParam !== '0', mirrorRatio: 0.5, shadowSize: 1536, cascades: 2, bloomKernel: 64, crowd: 1 };
  }
  return { name: 'compact', desktop: false, mirror: mirrorParam === '1', mirrorRatio: 0.35, shadowSize: 1024, cascades: 2, bloomKernel: 32, crowd: 0.5 };
}
