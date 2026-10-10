export type AuthIcon2DKind = 'user' | 'lock'

const PATHS: Record<AuthIcon2DKind, React.ReactNode> = {
  user: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-5 0-8 2.5-8 5.25V21h16v-1.75C20 16.5 17 14 12 14Z" />,
  lock: <path d="M6 10V7a6 6 0 1 1 12 0v3h1.25A1.75 1.75 0 0 1 21 11.75v8.5A1.75 1.75 0 0 1 19.25 22H4.75A1.75 1.75 0 0 1 3 20.25v-8.5A1.75 1.75 0 0 1 4.75 10H6Zm3 0h6V7a3 3 0 0 0-6 0v3Zm3 3a2 2 0 0 0-1 3.73V19h2v-2.27A2 2 0 0 0 12 13Z" />,
}

export const AuthIcon2D = ({ kind, className = 'h-4 w-4' }: { kind: AuthIcon2DKind; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    {PATHS[kind]}
  </svg>
)
