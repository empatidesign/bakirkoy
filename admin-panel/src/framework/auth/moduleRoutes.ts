export interface ModuleRoute {
  moduleKey: string
  routePath: string
  permissionKey: string
}

export const MODULE_ROUTES: ModuleRoute[] = [
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
  { moduleKey: 'muhtarlik', routePath: '/muhtarlik', permissionKey: 'muhtarlik.view' },
  { moduleKey: 'quiz', routePath: '/quiz', permissionKey: 'quiz.view' },
  { moduleKey: 'wheel', routePath: '/wheel', permissionKey: 'wheel.view' },
  { moduleKey: 'survey', routePath: '/survey', permissionKey: 'survey.view' },
  { moduleKey: 'companies', routePath: '/companies', permissionKey: 'companies.view' },
  { moduleKey: 'device-monitor', routePath: '/device-monitor', permissionKey: 'device-monitor.view' },
  { moduleKey: 'mobile-config', routePath: '/mobile-config', permissionKey: 'mobile-config.view' },
]

export const CROSS_MODULE_PERMISSION_KEYS = [
  'admins.view',
  'permissions.view',
  'departments.view',
  'reports.view',
  'participants.view',
  'service-facilities.view',
]
