import { wedding } from './data.js'

// Downloads an .ics file so guests can add the wedding to their calendar
export function downloadICS() {
  const start = new Date(wedding.dateISO)
  const end = new Date(start.getTime() + 4 * 36e5)
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InviteCraft//Wedding//EN',
    'BEGIN:VEVENT',
    `UID:${start.getTime()}@invitecraft`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Wedding of ${wedding.groom} & ${wedding.bride}`,
    `LOCATION:${wedding.venue.name}\\, ${wedding.venue.address}`,
    'DESCRIPTION:We would love to celebrate with you.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'wedding-invitation.ics'
  a.click()
  URL.revokeObjectURL(url)
}
