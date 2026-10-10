export interface ScopableModule {
  moduleKey: string
  routePath: string
  permissionKey: string
}

export const SCOPABLE_MODULES: ScopableModule[] = [
  { moduleKey: 'sports', routePath: '/sports', permissionKey: 'sports.view' },
  { moduleKey: 'pool', routePath: '/pool', permissionKey: 'pool.view' },
  { moduleKey: 'youth-camp', routePath: '/youth-camp', permissionKey: 'youth-camp.view' },
  { moduleKey: 'scout-camp', routePath: '/scout-camp', permissionKey: 'scout-camp.view' },
  { moduleKey: 'science-center', routePath: '/science-center', permissionKey: 'science-center.view' },
  { moduleKey: 'accessible-life', routePath: '/accessible-life', permissionKey: 'accessible-life.view' },
  { moduleKey: 'women-family', routePath: '/women-family', permissionKey: 'women-family.view' },
  { moduleKey: 'travels', routePath: '/travels', permissionKey: 'travels.view' },
  { moduleKey: 'library', routePath: '/library', permissionKey: 'library.view' },
  { moduleKey: 'events', routePath: '/events', permissionKey: 'events.view' },
  { moduleKey: 'emergency-areas', routePath: '/emergency-areas', permissionKey: 'emergency-areas.view' },
  { moduleKey: 'halls', routePath: '/halls', permissionKey: 'halls.view' },
  { moduleKey: 'muhtarlik', routePath: '/muhtarlik?tab=panelim', permissionKey: 'muhtarlik.view' },
]

export const SCOPABLE_MODULE_KEYS = SCOPABLE_MODULES.map((m) => m.moduleKey)
