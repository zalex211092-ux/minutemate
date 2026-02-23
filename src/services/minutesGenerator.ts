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
${keyPoints.length > 0 ? keyPoints.map(p => `- ${p}`).join('\n') : '- No key points recorded'}

## 4. Decisions Made
${decisions.length > 0 ? decisions.map(d => `- ${d}`).join('\n') : '- No decisions recorded'}

## 5. Actions Agreed
${actions.length > 0 ? formatActionsTable(actions) : '| Action | Owner | Deadline |\n|--------|-------|----------|\n| No actions recorded | - | - |'}

## 6. Next Steps
${formatNextSteps(type, actions)}
`;

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

  // Clean transcript - remove filler words and normalize spaces
  let cleaned = transcript
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally)\b/gi, '')
    .replace(/\b(\w+)\s+\1\s+\1+\b/gi, '$1') // triple duplicates
    .replace(/\b(\w+)\s+\1\b/gi, '$1') // double duplicates
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Split into segments - handle both punctuation and conjunctions
  const segments = splitIntoSegments(cleaned);

  for (const segment of segments) {
    // Skip if too short or just fluff
    if (segment.length < 10 || isJustFluff(segment)) continue;
    
    // Check if it's an ACTION (imperative/directive)
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
    if (point) {
      keyPoints.push(point);
    }
  }

  // If we have very few key points but have transcript, try to extract more
  if (keyPoints.length === 0 && segments.length > 0) {
    const meaningfulContent = segments
      .filter(s => !isJustFluff(s) && s.length > 15)
      .map(s => formatAsKeyPoint(s))
      .filter((p): p is string => p !== null);
    keyPoints.push(...meaningfulContent.slice(0, 5));
  }

  return { keyPoints, decisions, actions };
}

function splitIntoSegments(text: string): string[] {
  // First try to split by sentence endings
  let segments = text
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // If no sentence breaks found (common in speech-to-text), split by conjunctions
  if (segments.length === 1 && segments[0].length > 100) {
    segments = segments[0]
      .replace(/\s+(and|so|but|however|therefore)\s+/gi, "|$1 ")
      .split("|")
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }
  
  return segments;
}

function isJustFluff(segment: string): boolean {
  const fluffPatterns = [
    /^(hello|hi|hey|welcome|thanks|thank you|good morning|good afternoon|good evening|okay|ok|right|so|well|now)[\s.!]*$/i,
    /^(as you know|just to|I wanted to|I think|I believe|I feel|I guess)[\s.!]*$/i,
  ];
  return fluffPatterns.some(pattern => pattern.test(segment));
}

function detectAction(segment: string): { action: string; owner: string; deadline: string } | null {
  const lower = segment.toLowerCase();
  
  // Strong action indicators
  const actionIndicators = [
    { pattern: /\b(want|need|ask|tell|remind)\s+(?:you|him|her|them|us)\s+(?:to|that)\b/i, type: 'directive' },
    { pattern: /\b(you|we|they|he|she)\s+(?:must|should|need to|have to|got to|gotta)\b/i, type: 'obligation' },
    { pattern: /\b(make sure|ensure|see that|confirm that)\b/i, type: 'instruction' },
    { pattern: /\b(will|shall)\s+(?:send|review|complete|finish|prepare|update|check|look at)\b/i, type: 'commitment' },
    { pattern: /\b(don't|do not|never)\s+(?:be|forget|miss)\b/i, type: 'prohibition' },
    { pattern: /\b(always|must be|should be)\s+(?:on time|punctual|present|available)\b/i, type: 'requirement' },
  ];

  const isAction = actionIndicators.some(ind => ind.pattern.test(segment));
  
  if (!isAction) return null;

  // Extract owner
  let owner = extractName(segment) || 'Team';
  if (/\b(I will|I'll|I shall)\b/i.test(segment)) owner = 'Manager';
  if (/\b(we will|we'll|we shall)\b/i.test(segment)) owner = 'Team';
  if (/\b(you will|you'll|you must)\b/i.test(segment)) owner = 'Staff';
  
  // Extract deadline
  const deadline = extractDeadline(segment) || 'TBC';
  
  // Clean and format the action text
  let actionText = segment
    .replace(/\b(?:I want you to|I need you to|I ask you to|make sure you|ensure you)\b/gi, '')
    .replace(/\b(?:we|I)\s+(?:will|shall|must|need to|have to)\b/gi, '')
    .replace(/\b(?:you|we|they)\s+(?:must|should|need to|have to)\b/gi, '')
    .trim();
    
  // Capitalize first letter
  actionText = actionText.charAt(0).toUpperCase() + actionText.slice(1);
  actionText = actionText.replace(/[.!?;,]+$/, '');
  
  // If action is too long, summarize
  if (actionText.length > 80) {
    const coreMatch = actionText.match(/\b(?:ensure|maintain|complete|review|send|prepare|update|check|be|arrive|attend)\b.+/i);
    if (coreMatch) {
      actionText = coreMatch[0];
    } else {
      actionText = actionText.substring(0, 77) + '...';
    }
  }

  return { action: actionText, owner, deadline };
}

function detectDecision(segment: string): string | null {
  // Decision patterns
  const decisionPatterns = [
    /\b(?:it was|we have|I have|the panel has)?\s*(?:decided|agreed|resolved|concluded|determined|approved|confirmed)\b/i,
    /\b(?:decision|agreement|resolution)\s+(?:is|was|made|reached)\b/i,
    /\b(?:agreed|approved|confirmed|accepted|authorised|authorized)\s+(?:that|to)\b/i,
  ];

  const isDecision = decisionPatterns.some(pattern => pattern.test(segment));
  
  if (!isDecision) return null;

  // Clean up decision text
  let decision = segment
    .replace(/\b(?:it was|we have|I have)?\s*(?:decided|agreed|resolved|concluded|determined|approved|confirmed)\s+(?:that|to)?\s*/i, '')
    .replace(/\b(?:the|a|an)\s+(?:decision|agreement|resolution)\s+(?:is|was|made|reached)\s*(?:that)?\s*/i, '')
    .replace(/\b(?:going forward|from now on|with immediate effect)\b/gi, '')
    .trim();

  if (decision.length < 5) return null;
  
  decision = decision.charAt(0).toUpperCase() + decision.slice(1);
  decision = decision.replace(/[.!?;,]+$/, '');
  if (!decision.endsWith('.')) decision += '.';

  return decision;
}

function formatAsKeyPoint(segment: string): string | null {
  // Remove conversational fluff at start
  let point = segment
    .replace(/^(?:hello|hi|hey|welcome|thanks|thank you|good morning|good afternoon|okay|so|well|right|now|and|but)\s+/gi, '')
    .replace(/\b(?:as you know|just to|I wanted to|I think|I believe|I feel|basically|actually|honestly|literally)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (point.length < 15) return null;

  // Convert conversational phrases to professional minutes style
  const replacements: [RegExp, string][] = [
    [/\bwe discussed\b/gi, 'Discussed'],
    [/\bwe talked about\b/gi, 'Discussed'],
    [/\bwe went over\b/gi, 'Reviewed'],
    [/\bwe looked at\b/gi, 'Reviewed'],
    [/\bwe considered\b/gi, 'Considered'],
    [/\bwe noted\b/gi, 'Noted'],
    [/\bI mentioned\b/gi, 'Raised'],
    [/\bI explained\b/gi, 'Explained'],
    [/\bI presented\b/gi, 'Presented'],
    [/\bI suggested\b/gi, 'Proposed'],
    [/\bwe agreed\b/gi, 'Agreement reached on'],
    [/\bthere was a discussion about\b/gi, 'Discussion covered'],
    [/\bwe covered\b/gi, 'Covered'],
  ];

  for (const [pattern, replacement] of replacements) {
    point = point.replace(pattern, replacement);
  }

  if (/^[a-z]/.test(point)) {
    point = point.charAt(0).toUpperCase() + point.slice(1);
  }
  
  point = point.replace(/[!?,;]+$/, '');
  if (!point.endsWith('.')) point += '.';
  if (point.length > 120) point = point.substring(0, 117).trim() + '...';

  return point;
}

function formatNextSteps(type: string, actions: { action: string }[]): string {
  const steps: string[] = [];
  
  if (type === 'disciplinary' || type === 'investigation') {
    steps.push('- HR follow-up procedures to be actioned as per policy');
  }
  
  if (actions.length > 0) {
    steps.push(`- ${actions.length} action item${actions.length > 1 ? 's' : ''} to be completed as detailed above`);
  }
  
  steps.push('- Minutes to be circulated to all attendees');
  steps.push('- Outstanding actions to be reviewed at next meeting');
  
  return steps.join('\n');
}

function extractName(segment: string): string | null {
  const nameMatch = segment.match(/\b(?:by|for|assigned to|owner:|responsible:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (nameMatch) return nameMatch[1];
  
  const subjectMatch = segment.match(/\b([A-Z][a-z]+)\s+(?:will|shall|is to|needs to)\b/);
  if (subjectMatch) return subjectMatch[1];
  
  return null;
}

function extractDeadline(segment: string): string | null {
  const deadlinePatterns = [
    /\b(?:by|before|due|for)\s+(?:the\s+)?(end\s+of\s+(?:day|week|month)|close\s+of\s+business|COB|EOD)/i,
    /\b(?:by|before|due|for)\s+(?:next\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
    /\b(?:by|before|due|for)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December))/i,
    /\b(?:by|before|due|for)\s+(tomorrow|today|this week|next week)/i,
    /\b(?:within|in)\s+(\d+\s*(?:days?|weeks?|hours?))/i,
  ];

  for (const pattern of deadlinePatterns) {
    const match = segment.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatActionsTable(actions: { action: string; owner: string; deadline: string }[]): string {
  // FIXED: Use actual newlines (\n) not escaped (\\n)
  const header = '| Action | Owner | Deadline |';
  const separator = '|--------|-------|----------|';
  
  const rows = actions.slice(0, 8).map(a => {
    let cleanAction = a.action
      .replace(/\|/g, '/') // Remove pipe characters that break markdown
      .replace(/\n/g, ' ') // Remove internal newlines
      .trim();
      
    if (cleanAction.length > 60) {
      cleanAction = cleanAction.substring(0, 57) + '...';
    }
    
    let owner = (a.owner || 'TBC').charAt(0).toUpperCase() + (a.owner || 'TBC').slice(1);
    let deadline = a.deadline || 'TBC';
    
    return `| ${cleanAction} | ${owner} | ${deadline} |`;
  });
  
  return [header, separator, ...rows].join('\n');
}

export function extractActionsFromMinutes(minutesText: string): Meeting['actions'] {
  const actions: Meeting['actions'] = [];
  
  // Fixed regex to properly match newlines
  const actionTableRegex = /\|\s*Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|\n\|[-\s|]+\n([\s\S]*?)(?=\n##|\n---|$)/i;
  const tableMatch = minutesText.match(actionTableRegex);
  
  if (tableMatch && tableMatch[1]) {
    const lines = tableMatch[1].split('\n').filter(l => l.startsWith('|') && !l.includes('Action'));
    
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2 && parts[0] !== 'No actions recorded' && !parts[0].startsWith('---')) {
        actions.push({
          id: crypto.randomUUID(),
          action: parts[0],
          owner: parts[1] || 'TBC',
          deadline: parts[2] || 'TBC',
        });
      }
    }
  }
  
  return actions;
}