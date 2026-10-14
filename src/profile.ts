import { siGithub, siInstagram, siTelegram } from 'simple-icons'

export interface ProfileSection {
  flag: string
  lines: string[]
}

export interface SocialLink {
  label: string
  href: string
  // SVG path in a 24x24 box, null for links drawn with the built-in mail icon
  iconPath: string | null
}

export const profileSections: ProfileSection[] = [
  {
    flag: 'main',
    lines: [
      'Languages: C#, C++',
      'Technologies: Altium, Unreal Engine 5',
      'Embedded: PCB high-speed routing | low-power design | STM32, ESP32, Nordic',
    ],
  },
  {
    flag: 'secondary',
    lines: ['Languages: Python | TypeScript/JavaScript | Vue', 'Technologies: Unity 6'],
  },
  {
    flag: 'interests',
    lines: ['Piano, Guitar | Astrophysics | Fantasy Literature | Sandbox Games'],
  },
  {
    flag: 'specialization',
    lines: ['Classless Player'],
  },
]

export const socialLinks: SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/VeyDlin', iconPath: siGithub.path },
  { label: 'Instagram', href: 'https://www.instagram.com/veydlin/', iconPath: siInstagram.path },
  { label: 'Telegram', href: 'https://t.me/veydlin', iconPath: siTelegram.path },
  { label: 'Email', href: 'mailto:nekto@veydlin.com', iconPath: null },
]
