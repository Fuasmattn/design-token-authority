// @ts-check
// The docs sidebar (Starlight). Every group starts collapsed except the first, Start
// (TICKET-149): Starlight still opens the group that holds the current page, and on wide
// screens it remembers the groups a reader opened.
export const SIDEBAR = [
  { label: 'Start', items: [{ autogenerate: { directory: 'start' } }] },
  { label: 'Learn', collapsed: true, items: [{ autogenerate: { directory: 'learn' } }] },
  { label: 'Guides', collapsed: true, items: [{ autogenerate: { directory: 'guides' } }] },
  { label: 'Reference', collapsed: true, items: [{ autogenerate: { directory: 'reference' } }] },
  {
    label: 'Design system',
    collapsed: true,
    items: [
      { label: 'DTA Drafting Table', link: '/design-system/' },
      { label: 'Motion', link: '/design-system/motion/' },
      { label: 'Status colours', link: '/design-system/status-colours/' },
      {
        label: 'Tokens',
        collapsed: true,
        items: [{ autogenerate: { directory: 'design-system/tokens' } }],
      },
      {
        label: 'Components',
        collapsed: true,
        items: [{ autogenerate: { directory: 'design-system/components' } }],
      },
    ],
  },
  { label: 'Playground', link: '/playground/' },
  { label: 'Contribute', collapsed: true, items: [{ autogenerate: { directory: 'contribute' } }] },
]
