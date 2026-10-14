import type { JSX } from 'react'

import { profileSections, socialLinks } from '../profile.ts'
import type { ProfileSection, SocialLink } from '../profile.ts'

export interface OverlayProps {
  expanded: boolean
  // the scene has drawn its first complete frame
  ready: boolean
  onToggle: () => void
}

function MailIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function LinkIcon({ link }: { link: SocialLink }): JSX.Element {
  if (link.iconPath === null) {
    return <MailIcon />
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={link.iconPath} />
    </svg>
  )
}

export function Overlay({ expanded, ready, onToggle }: OverlayProps): JSX.Element {
  const classes: string[] = ['overlay']
  if (ready) {
    classes.push('overlay--ready')
  }
  if (expanded) {
    classes.push('overlay--expanded')
  }
  return (
    <div className={classes.join(' ')}>
      <header className="overlay__header">
        <h1 className="overlay__title">veydlin.com</h1>
      </header>
      <button
        type="button"
        className="overlay__toggle"
        aria-expanded={expanded}
        aria-controls="profile"
        onClick={onToggle}>
        {expanded ? 'Hide profile' : 'Show profile'}
      </button>
      {/* the bubble draws this text on the GPU; screen readers and search engines read it from here */}
      <section id="profile" className="visually-hidden" aria-label="Profile">
        {profileSections.map((section: ProfileSection): JSX.Element => (
          <div key={section.flag}>
            <h2>profile --{section.flag}</h2>
            <ul>
              {section.lines.map((line: string): JSX.Element => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <footer className="overlay__footer">
        <nav className="overlay__links" aria-label="Links">
          {socialLinks.map((link: SocialLink): JSX.Element => (
            <a
              key={link.label}
              className="overlay__link"
              href={link.href}
              aria-label={link.label}
              target={link.href.startsWith('mailto:') ? undefined : '_blank'}
              rel="noreferrer">
              <LinkIcon link={link} />
            </a>
          ))}
        </nav>
      </footer>
      {!ready && <div className="loading">Loading.</div>}
    </div>
  )
}
