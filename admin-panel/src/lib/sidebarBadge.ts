export const SIDEBAR_BADGE_EVENT = 'sidebar:badge-refresh'

export const refreshSidebarBadges = () => {
  window.dispatchEvent(new Event(SIDEBAR_BADGE_EVENT))
}
