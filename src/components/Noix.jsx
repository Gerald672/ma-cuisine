// Logo : une noix (clin d'œil à la ferme), coque crème sur fond vert feuille
export default function Noix({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Ma cuisine" style={{ display: 'block' }}>
      <rect width="64" height="64" rx="16" fill="#2F6B4A" />
      <path d="M32 14c10.5 0 17 7 17 17 0 10-7 18-17 19.5C22 49 15 41 15 31c0-10 6.5-17 17-17Z" fill="#F3E6CC"/><path d="M32 14c-2.5 12-2.5 24 0 36" fill="none" stroke="#C98A3A" stroke-width="2" stroke-linecap="round"/><path d="M21 22c2 3 2.5 7 1.5 11M24 38c1.5 2 3.5 3.5 6 4M43 22c-2 3-2.5 7-1.5 11M40 38c-1.5 2-3.5 3.5-6 4" fill="none" stroke="#C98A3A" stroke-width="1.5" stroke-linecap="round" opacity=".55"/><path d="M32 14c1-4.5 4.5-7 9-7-.5 4.5-4 7.5-9 7Z" fill="#9DC2A8"/>
    </svg>
  )
}
