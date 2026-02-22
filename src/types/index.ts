export type MeetingType = '1:1' | 'team' | 'disciplinary' | 'investigation';

export interface Attendee {
  id: string;
  name: string;
  role: string;
}

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  date: string;
  startTime: string;
  location?: string;
  caseRef?: string;
  consentConfirmed: boolean;
  attendees: Attendee[];
  transcriptText: string;
  minutesText: string;
  actions: ActionItem[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'completed';
}

export interface ActionItem {
  id: string;
  action: string;
  owner: string;
  deadline?: string;
}

export interface RecordingMarker {
  id: string;
  timestamp: number;
  type: 'decision' | 'action' | 'keypoint';
  note?: string;
}

export interface Settings {
  defaultLocation: string;
  useRoleTemplates: boolean;
  defaultExportFormat: 'pdf' | 'docx';
  autoDeleteDays?: number;
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  '1:1': '1:1 Meeting',
  'team': 'Team Meeting',
  'disciplinary': 'Disciplinary Hearing',
  'investigation': 'Investigation Meeting',
};

export const ROLE_TEMPLATES: Record<MeetingType, string[]> = {
  '1:1': ['Manager', 'Employee'],
  'team': ['Chair/Lead', 'Team Member', 'Note-taker'],
  'disciplinary': ['Chair', 'Note-taker', 'Employee', 'Companion', 'HR', 'Witness'],
  'investigation': ['Investigator', 'Note-taker', 'Employee', 'Witness', 'HR'],
};

export const MINUTES_PROMPT_TEMPLATE = `You are a professional HR meeting minute-taker. Produce accurate, neutral minutes based only on provided information. Do not add assumptions.

MEETING METADATA:
- Meeting Type: {type}
- Title: {title}
- Date: {date}
- Start Time: {startTime}
- Location: {location}
- Case Reference: {caseRef}

ATTENDEES (include total count):
{attendees}

TRANSCRIPT:
{transcript}

OUTPUT FORMAT (use headings exactly):

1. Meeting Overview
- Date:
- Time:
- Type:
- Location:
- Purpose/Subject:

2. Attendees
- Total attendees:
- Names and roles:

3. Key Points Discussed
- Provide structured bullet points summarising the main discussion points
- Use neutral, factual language
- Do not attribute direct quotes unless critical

4. Decisions Made
- List any decisions or conclusions reached
- If none, state "No decisions recorded"

5. Actions Agreed
| Action | Owner | Deadline |
|--------|-------|----------|
| [Action description] | [Name] | [Date or "Not stated"] |

6. Next Steps
- Outline any follow-up meetings or procedures

{hrSections}

IMPORTANT NOTES:
- Use neutral, professional language throughout
- Do not invent facts - if information is missing, write "Not stated"
- Maintain confidentiality and objectivity
- Do not include personal opinions or interpretations`;

export const HR_SECTIONS_TEMPLATE = `
7. Allegations (if applicable)
- Summary of allegations presented:
- Employee's response:

8. Evidence Presented
- Documents or evidence discussed:
- Witness statements (if any):

9. Mitigation Factors
- Any mitigating circumstances raised:

10. Outcome
- Decision reached:
- Reasoning:

11. Right of Appeal
- Appeal process explained:
- Deadline for appeal:`;
