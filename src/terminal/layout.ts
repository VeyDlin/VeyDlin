import type { ProfileSection } from '../profile.ts'

export type SegmentKind = 'prompt' | 'command' | 'prefix' | 'output'

export interface Segment {
  kind: SegmentKind
  text: string
}

export interface TerminalRow {
  segments: Segment[]
  // columns of leading space before the first segment
  indent: number
  // commands are typed character by character, output appears at once
  typed: boolean
}

export interface RowSchedule {
  start: number
  duration: number
}

const outputIndent: number = 2
const prefix: string = '> '

export function rowLength(row: TerminalRow): number {
  let length: number = 0
  for (const segment of row.segments) {
    length += segment.text.length
  }
  return length
}

export function commandRow(flag: string | null): TerminalRow {
  const segments: Segment[] = [{ kind: 'prompt', text: '$ ' }]
  if (flag !== null) {
    segments.push({ kind: 'command', text: `profile --${flag}` })
  }
  return { segments, indent: 0, typed: true }
}

// Wraps on spaces and keeps "|" separators at the end of a row, so continuation rows never start with one
export function wrapWords(text: string, width: number): string[] {
  const tokens: string[] = []
  for (const word of text.split(' ')) {
    if (word === '|' && tokens.length > 0) {
      tokens[tokens.length - 1] += ' |'
    } else {
      tokens.push(word)
    }
  }
  const rows: string[] = []
  let current: string = ''
  for (const token of tokens) {
    const candidate: string = current.length === 0 ? token : `${current} ${token}`
    if (candidate.length <= width || current.length === 0) {
      current = candidate
    } else {
      rows.push(current)
      current = token
    }
  }
  if (current.length > 0) {
    rows.push(current)
  }
  return rows
}

export function layoutProfile(sections: ProfileSection[], columns: number): TerminalRow[] {
  const rows: TerminalRow[] = []
  const textWidth: number = Math.max(8, columns - outputIndent - prefix.length)
  sections.forEach((section: ProfileSection, index: number): void => {
    if (index > 0) {
      rows.push({ segments: [], indent: 0, typed: false })
    }
    rows.push(commandRow(section.flag))
    for (const line of section.lines) {
      wrapWords(line, textWidth).forEach((part: string, partIndex: number): void => {
        if (partIndex === 0) {
          rows.push({
            segments: [
              { kind: 'prefix', text: prefix },
              { kind: 'output', text: part },
            ],
            indent: outputIndent,
            typed: false,
          })
        } else {
          rows.push({
            segments: [{ kind: 'output', text: part }],
            indent: outputIndent + prefix.length,
            typed: false,
          })
        }
      })
    }
  })
  rows.push({ segments: [], indent: 0, typed: false })
  rows.push(commandRow(null))
  return rows
}

export function longestRow(rows: TerminalRow[]): number {
  let longest: number = 0
  for (const row of rows) {
    longest = Math.max(longest, row.indent + rowLength(row))
  }
  return longest
}

export function scheduleRows(rows: TerminalRow[], charsPerSecond: number, outputDelay: number): RowSchedule[] {
  const schedule: RowSchedule[] = []
  let time: number = 0
  for (const row of rows) {
    if (row.typed) {
      const duration: number = rowLength(row) / charsPerSecond
      schedule.push({ start: time, duration })
      time += duration + outputDelay
    } else {
      schedule.push({ start: time, duration: 0 })
      time += row.segments.length > 0 ? outputDelay : 0
    }
  }
  return schedule
}

export function visibleCharacters(row: TerminalRow, schedule: RowSchedule, elapsed: number): number {
  if (elapsed < schedule.start) {
    return 0
  }
  if (schedule.duration === 0) {
    return rowLength(row)
  }
  const progress: number = Math.min(1, (elapsed - schedule.start) / schedule.duration)
  return Math.floor(progress * rowLength(row))
}
