import type { Meeting, MeetingType, ActionItem } from '../types';

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateMinutes(meeting: Meeting): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      return await generateWithClaude(meeting, apiKey);
    } catch (error) {
      console.error('Claude API failed, falling back to basic generator:', error);
    }
  }

  return generateBasicMinutes(meeting);
}

// ============================================================================
// CLAUDE AI GENERATION
// ============================================================================

async function generateWithClaude(meeting: Meeting, apiKey: string): Promise<string> {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText } = meeting;

  const attendeeList = attendees.map(a => `${a.name} (${a.role})`).join(', ');
  const meetingTypeLabel = formatMeetingType(type);
  const formattedDate = formatDate(date);
  const confidentiality = getConfidentialityLevel(type);

  const prompt = `You are a professional minute-taker based in the UK. Always use British English spelling and conventions (e.g. "organisation" not "organization", "recognised" not "recognized", "behaviour" not "behavior", "summarise" not "summarize", dates in DD/MM/YYYY format).

MEETING DETAILS:
- Title: ${title}
- Date: ${formattedDate}
- Time: ${startTime || 'Not stated'}
- Type: ${meetingTypeLabel}
- Location: ${location || 'Not stated'}
- Attendees: ${attendeeList || 'Not stated'}
${caseRef ? `- Case Reference: ${caseRef}` : ''}

TRANSCRIPT:
"${transcriptText}"

OUTPUT INSTRUCTIONS:
Produce meeting minutes in this EXACT markdown format. Do not deviate from the structure.

# ${formatMeetingTypeHeader(type)} MINUTES

[One sentence executive summary: meeting title, topics covered, number of actions]

## Meeting Information

| Field | Details |
|:------|:--------|
| **Date** | ${formattedDate} |
| **Time** | ${startTime || 'Not stated'} |
| **Type** | ${meetingTypeLabel} |
| **${type === 'disciplinary' || type === 'investigation' ? 'Location' : 'Venue'}** | ${location || 'Not stated'} |
| **Subject** | ${title} |
${caseRef ? `| **Case Ref** | ${caseRef} |` : ''}

## Attendees (${attendees.length})

${attendees.map(a => `- **${a.name}** – ${a.role}`).join('\n') || 'No attendees recorded.'}

## Discussion Summary

[Group discussion points under bold topic headings. Each point as a bullet. Be professional and concise. Ignore filler words, greetings, and noise. Interpret speech errors — for example "Baja cells" likely means "Baja sales". Topics might include: Sales & Business Development, Attendance & Scheduling, Performance & Development, etc.]

## Decisions

[List any formal decisions made, or write: No formal decisions recorded.]

## Action Items ([count])

| Action | Owner | Deadline |
|:-------|:-----:|:---------|
[One row per action. Owner is Team/Manager/HR/All. Deadline is TBC if not stated. Strip trailing noise like "have a coffee". Convert "make sure you're not late" into "Arrive punctually for all scheduled shifts".]

## Follow-up

- Complete [n] action items listed above
${type === '1:1' ? '- Next 1:1 to be scheduled per regular cadence\n- Development actions to be reviewed at next session' : ''}
${type === 'team' ? '- Action progress to be reviewed at next team meeting' : ''}
${type === 'disciplinary' ? '- HR to process formal documentation within 48 hours\n- Written outcome to be issued within 5 working days\n- Employee rights to appeal to be confirmed in writing' : ''}
${type === 'investigation' ? '- Investigation findings to be compiled\n- Decision on next steps within 10 working days' : ''}
- Minutes to be circulated to all attendees within 24 hours
${type === 'disciplinary' || type === 'investigation' ? `
## HR Documentation

**Allegations:** Presented to employee and response recorded.
**Evidence:** Reviewed and acknowledged by employee.
**Mitigation:** ${meeting.consentConfirmed ? 'Employee provided response and mitigation.' : 'Pending employee response.'}
**Outcome:** To be confirmed in writing within 5 working days.
**Appeal Rights:** Employee has 5 working days from written confirmation date to lodge an appeal.` : ''}

---
Document prepared by MinuteMate | ${confidentiality} | Generated: ${new Date().toLocaleDateString('en-GB')}

IMPORTANT RULES:
- Never include raw transcript sentences verbatim
- Never include filler words (um, uh, like, you know)
- Never include greetings (hello, welcome, thanks for coming)
- Fix speech-to-text errors using context (e.g. "cells" → "sales", "Baja" is likely a place/brand)
- Strip trailing noise from actions (coffee, cigarettes, "if you want")
- Keep discussion points concise and professional (1-2 sentences max)
- If transcript is very short or unclear, still produce all sections with appropriate "not stated" placeholders
- Use only ASCII characters, no Unicode bullets or dashes`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ============================================================================
// BASIC FALLBACK (used if no API key)
// ============================================================================

function generateBasicMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees } = meeting;

  const attendeesSection = attendees.length > 0
    ? attendees.map(a => `- **${a.name}** – ${a.role}`).join('\n')
    : 'No attendees recorded.';

  return `# ${formatMeetingTypeHeader(type)} MINUTES

**${title}** – Meeting held. Please review transcript and edit minutes manually.

## Meeting Information

| Field | Details |
|:------|:--------|
| **Date** | ${formatDate(date)} |
| **Time** | ${startTime || 'Not stated'} |
| **Type** | ${formatMeetingType(type)} |
| **${type === 'disciplinary' || type === 'investigation' ? 'Location' : 'Venue'}** | ${location || 'Not stated'} |
| **Subject** | ${title} |
${caseRef ? `| **Case Ref** | ${caseRef} |` : ''}

## Attendees (${attendees.length})

${attendeesSection}

## Discussion Summary

No discussion points extracted. Please edit minutes manually.

## Decisions

No formal decisions recorded.

## Action Items (0)

| Action | Owner | Deadline |
|:-------|:-----:|:---------|
| No actions recorded | - | - |

## Follow-up

- Minutes to be circulated to all attendees within 24 hours

---
Document prepared by MinuteMate | ${getConfidentialityLevel(type)} | Generated: ${new Date().toLocaleDateString('en-GB')}
`;
}

// ============================================================================
// EXTRACTION FROM SAVED MINUTES TEXT
// ============================================================================

export function extractActionsFromMinutes(minutesText: string): ActionItem[] {
  const actions: ActionItem[] = [];

  const match = minutesText.match(
    /\|\s*Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|\n\|[-:| ]+\|\n([\s\S]*?)(?=\n##|\n---|$)/i
  );

  if (match) {
    const lines = match[1]
      .split('\n')
      .filter(l => l.startsWith('|') && !/Action\s*\|/i.test(l))
      .map(l => l.split('|').map(p => p.trim()).filter(Boolean));

    for (const parts of lines) {
      if (parts.length >= 2 && !parts[0].includes('No actions')) {
        actions.push({
          id: crypto.randomUUID(),
          action: parts[0],
          owner: parts[1],
          deadline: parts[2],
        });
      }
    }
  }

  return actions;
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMeetingType(type: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    '1:1': '1:1 Meeting', team: 'Team Meeting',
    disciplinary: 'Disciplinary Hearing', investigation: 'Investigation Meeting',
  };
  return labels[type] ?? type;
}

function formatMeetingTypeHeader(type: MeetingType): string {
  const headers: Record<MeetingType, string> = {
    '1:1': '1:1 MEETING', team: 'TEAM MEETING',
    disciplinary: 'DISCIPLINARY HEARING', investigation: 'INVESTIGATION MEETING',
  };
  return headers[type] ?? type.toUpperCase();
}

function getConfidentialityLevel(type: MeetingType): string {
  if (type === 'disciplinary' || type === 'investigation') return 'CONFIDENTIAL - HR Records';
  if (type === '1:1') return 'CONFIDENTIAL - Management';
  return 'Internal';
}
