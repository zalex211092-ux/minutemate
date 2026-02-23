import type { Meeting } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  return generateStructuredMinutes(meeting);
}

function generateStructuredMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText } = meeting;
  const totalAttendees = attendees.length;

  // Parse and categorize transcript content
  const { keyPoints, decisions, actions } = parseTranscript(transcriptText);

  let minutes = `# MEETING MINUTES

## 1. Meeting Overview
- **Date:** ${date}
- **Time:** ${startTime}
- **Type:** ${type === '1:1' ? '1:1 Meeting' : type === 'team' ? 'Team Meeting' : type === 'disciplinary' ? 'Disciplinary Hearing' : 'Investigation Meeting'}
- **Location:** ${location || 'Not stated'}
- **Purpose/Subject:** ${title}
${caseRef ? `- **Case Reference:** ${caseRef}` : ''}

## 2. Attendees
- **Total attendees:** ${totalAttendees}
- **Names and roles:**
${attendees.length > 0 ? attendees.map(a => `  - ${a.name} (${a.role})`).join('\n') : '  - Not recorded'}

## 3. Key Points Discussed
${keyPoints.length > 0 ? keyPoints.map(p => `- ${p}`).join('\n') : '- General discussion took place'}

## 4. Decisions Made
${decisions.length > 0 ? decisions.map(d => `- ${d}`).join('\n') : '- No formal decisions recorded'}

## 5. Actions Agreed
${actions.length > 0 ? formatActionsTable(actions) : '| Action | Owner | Deadline |\\n|--------|-------|----------|\\n| No specific actions recorded | - | - |'}

## 6. Next Steps
`;
  if (type === 'disciplinary' || type === 'investigation') {
    minutes += '- Follow-up procedures as per HR policy\\n';
  }
  minutes += '- Minutes to be distributed to attendees\\n';
  minutes += '- Any actions to be completed as agreed';

  if (type === 'disciplinary' || type === 'investigation') {
    minutes += `

## 7. Allegations
- **Summary of allegations presented:** [To be completed]
- **Employee's response:** [To be completed]

## 8. Evidence Presented
- **Documents or evidence discussed:** [To be completed]
- **Witness statements (if any):** [To be completed]

## 9. Mitigation Factors
- **Any mitigating circumstances raised:** [To be completed]

## 10. Outcome
- **Decision reached:** [To be completed]
- **Reasoning:** [To be completed]

## 11. Right of Appeal
- **Appeal process explained:** [To be completed]
- **Deadline for appeal:** [To be completed]`;
  }

  minutes += `

---
*Minutes prepared by MinuteMate*
*Confidential - HR Records*`;

  return minutes;
}

interface ParsedContent {
  keyPoints: string[];
  decisions: string[];
  actions: { action: string; owner: string; deadline: string }[];
}

function parseTranscript(transcript: string | undefined): ParsedContent {
  const keyPoints: string[] = [];
  const decisions: string[] = [];
  const actions: { action: string; owner: string; deadline: string }[] = [];

  if (!transcript || !transcript.trim()) {
    return { keyPoints, decisions, actions };
  }

  // Clean transcript
  let cleaned = transcript
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|so|well|okay|right)\b/gi, '')
    .replace(/\b(\w+)\s+\1\s+\1+\b/gi, '$1')
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Split into segments
  const segments = cleaned
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  for (const segment of segments) {
    const lowerSegment = segment.toLowerCase();
    
    // Check if it's an ACTION
    const actionMatch = detectAction(segment);
    if (actionMatch) {
      actions.push(actionMatch);
      continue;
    }
    
    // Check if it's a DECISION
    const decisionMatch = detectDecision(segment);
    if (decisionMatch) {
      decisions.push(decisionMatch);
      continue;
    }
    
    // Otherwise it's a KEY POINT
    const point = formatAsKeyPoint(segment);
    if (point && !isGreeting(point)) {
      keyPoints.push(point);
    }
  }

  return { keyPoints, decisions, actions };
}

function detectAction(segment: string): { action: string; owner: string; deadline: string } | null {
  const lower = segment.toLowerCase();
  
  // Action patterns
  const actionPatterns = [
    { regex: /\b(action item|action|task)\s*(?:for|to)?\s+(\w+)?\s*(?:is|:)?\s*(.+)/i, extract: (m: RegExpMatchArray) => ({ action: m[3] || m[2], owner: m[2] || 'Not stated' }) },
    { regex: /\b(\w+)\s+(?:will|shall|is to|needs to|must)\s+(.+)/i, extract: (m: RegExpMatchArray) => ({ action: m[2], owner: m[1] }) },
    { regex: /\b(we|I)\s+(?:will|shall|need to|must|agreed to)\s+(.+)/i, extract: (m: RegExpMatchArray) => ({ action: m[2], owner: m[1] === 'I' ? 'Individual' : 'Team' }) },
    { regex: /\b(to|need to|must)\s+(.+?)\s+(?:by|before|for)\s+(.+)/i, extract: (m: RegExpMatchArray) => ({ action: m[2], owner: 'Not stated', deadline: m[3] }) },
  ];

  for (const pattern of actionPatterns) {
    const match = segment.match(pattern.regex);
    if (match) {
      const extracted = pattern.extract(match);
      return {
        action: cleanActionText(extracted.action),
        owner: extracted.owner || 'Not stated',
        deadline: extracted.deadline || 'Not stated'
      };
    }
  }

  // Check for deadline mentions
  const deadlineMatch = segment.match(/\b(complete|finish|review|send|prepare|update)\b.+\b(by|before|due)\b.+/i);
  if (deadlineMatch) {
    return {
      action: cleanActionText(segment),
      owner: extractName(segment) || 'Not stated',
      deadline: extractDeadline(segment) || 'Not stated'
    };
  }

  return null;
}

function detectDecision(segment: string): string | null {
  const lower = segment.toLowerCase();
  
  // Decision keywords
  const decisionPatterns = [
    /\b(?:it was|we|I)\s+(?:decided|agreed|resolved|concluded|determined|approved|confirmed)\b/i,
    /\b(?:decision|agreement|resolution)\s+(?:is|was|made|reached)\b/i,
    /\b(?:agreed|approved|confirmed|accepted|authorised|authorized)\s+(?:that|to)\b/i,
  ];

  const isDecision = decisionPatterns.some(pattern => pattern.test(segment));
  
  if (isDecision) {
    // Clean up decision text
    let decision = segment
      .replace(/\b(?:it was|we|I)\s+(?:decided|agreed|resolved|concluded|determined|approved|confirmed)\s+(?:that|to)?\s*/i, '')
      .replace(/\b(?:the|a|an)\s+(?:decision|agreement|resolution)\s+(?:is|was|made|reached)\s*(?:that)?\s*/i, '');
    
    return formatAsDecision(decision);
  }

  return null;
}

function formatAsKeyPoint(segment: string): string | null {
  // Remove conversational fluff
  let point = segment
    .replace(/\b(?:hello|hi|hey|welcome|thanks|thank you|good morning|good afternoon|okay|so|well|right|now)\b/gi, '')
    .replace(/\b(?:as you know|just to|I wanted to|I think|I believe|I feel|basically|actually|honestly)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (point.length < 15) return null;

  // Convert to professional meeting minutes style
  point = point
    .replace(/\bwe discussed\b/gi, 'discussed')
    .replace(/\bwe talked about\b/gi, 'discussed')
    .replace(/\bwe went over\b/gi, 'reviewed')
    .replace(/\bwe looked at\b/gi, 'reviewed')
    .replace(/\bwe considered\b/gi, 'considered')
    .replace(/\bwe noted\b/gi, 'noted')
    .replace(/\bI mentioned\b/gi, 'mentioned')
    .replace(/\bI explained\b/gi, 'explained')
    .replace(/\bI presented\b/gi, 'presented');

  // Capitalize first letter
  point = point.charAt(0).toUpperCase() + point.slice(1);
  
  // Remove trailing punctuation except periods
  point = point.replace(/[!?,;]+$/, '');
  
  // Add period if missing
  if (!point.endsWith('.')) point += '.';

  // Truncate if too long
  if (point.length > 120) {
    point = point.substring(0, 117) + '...';
  }

  return point;
}

function formatAsDecision(decision: string): string {
  decision = decision.trim();
  
  // Capitalize first letter
  decision = decision.charAt(0).toUpperCase() + decision.slice(1);
  
  // Remove trailing punctuation
  decision = decision.replace(/[!?,;]+$/, '');
  
  // Add period if missing
  if (!decision.endsWith('.')) decision += '.';

  return decision;
}

function cleanActionText(action: string): string {
  return action
    .replace(/\b(?:the|a|an)\s+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.!?;]+$/, '');
}

function extractName(segment: string): string | null {
  const nameMatch = segment.match(/\b(?:by|for|assigned to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  return nameMatch ? nameMatch[1] : null;
}

function extractDeadline(segment: string): string | null {
  const deadlinePatterns = [
    /\b(?:by|before|due)\s+(?:next\s+)?(\w+(?:day| week| month)?)/i,
    /\b(?:by|before|due)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?\w+)/i,
    /\b(?:by|before|due)\s+(tomorrow|end of day|end of week|Friday|Monday)/i,
  ];

  for (const pattern of deadlinePatterns) {
    const match = segment.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isGreeting(point: string): boolean {
  const greetings = ['hello', 'hi', 'welcome', 'good morning', 'good afternoon', 'thanks for', 'thank you for'];
  return greetings.some(g => point.toLowerCase().includes(g));
}

function formatActionsTable(actions: { action: string; owner: string; deadline: string }[]): string {
  let table = '| Action | Owner | Deadline |\\n';
  table += '|--------|-------|----------|\\n';
  table += actions.slice(0, 6).map(a => 
    `| ${a.action.substring(0, 50)}${a.action.length > 50 ? '...' : ''} | ${a.owner} | ${a.deadline} |`
  ).join('\\n');
  return table;
}

export function extractActionsFromMinutes(minutesText: string): Meeting['actions'] {
  const actions: Meeting['actions'] = [];
  
  const actionTableRegex = /\|\s*Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|[\\s\\S]*?(?=\\n##|\\n---|$)/i;
  const tableMatch = minutesText.match(actionTableRegex);
  
  if (tableMatch) {
    const lines = tableMatch[0].split('\\n').filter((l: string) => l.startsWith('|') && !l.includes('Action') && !l.includes('---'));
    
    for (const line of lines) {
      const parts = line.split('|').map((p: string) => p.trim()).filter((p: string) => p);
      if (parts.length >= 2 && parts[0] !== 'No specific actions recorded') {
        actions.push({
          id: crypto.randomUUID(),
          action: parts[0],
          owner: parts[1] || 'Not stated',
          deadline: parts[2] || 'Not stated',
        });
      }
    }
  }
  
  return actions;
}