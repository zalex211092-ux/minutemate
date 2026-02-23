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

  // Step 1: Deep clean
  let cleaned = transcript
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally|actually|honestly)\b/gi, '')
    .replace(/\b(\w+)\s+\1\s+\1+\b/gi, '$1')
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 2: Remove pleasantries but KEEP the meat
  cleaned = removePleasantries(cleaned);

  // Step 3: Split into sentences/segments
  const segments = splitIntoCleanSegments(cleaned);

  // Step 4: Extract actions and decisions first (these are priority)
  const remainingSegments: string[] = [];
  
  for (const segment of segments) {
    if (segment.length < 15 || isJustFluff(segment)) continue;

    const actionMatch = detectAction(segment);
    if (actionMatch) {
      actions.push(actionMatch);
      continue;
    }

    const decisionMatch = detectDecision(segment);
    if (decisionMatch) {
      decisions.push(decisionMatch);
      continue;
    }

    remainingSegments.push(segment);
  }

  // Step 5: Group related segments into coherent bullets (no limit!)
  keyPoints.push(...groupAndPolishPoints(remainingSegments));

  return { keyPoints, decisions, actions };
}

function removePleasantries(text: string): string {
  // Remove only clear opening/closing fluff, keep content
  text = text.replace(/^(?:hello|hi|hey|welcome|good morning|good afternoon)[,.\s]+/i, '');
  text = text.replace(/\bthank\s+you\s+(?:for\s+)?(?:coming|joining|attending)[,.\s]+/gi, '');
  text = text.replace(/\bit'?s\s+(?:nice|good|great)\s+to\s+see\s+everyone\b/gi, '');
  text = text.replace(/\b(?:that'?s\s+all|let'?s\s+wrap\s+up|good\s+meeting)[\s.]*$/i, '');
  return text.trim();
}

function splitIntoCleanSegments(text: string): string[] {
  // Add periods where missing (lowercase followed by uppercase usually means new sentence)
  text = text
    .replace(/([a-z])([A-Z])/g, '$1. $2')
    .replace(/\s+(and then|next|also|additionally)\s+/gi, '. $1 ')
    .replace(/,/g, ', ')
    .replace(/\s+/g, ' ');

  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

function groupAndPolishPoints(segments: string[]): string[] {
  if (segments.length === 0) return [];
  
  const points: string[] = [];
  let currentGroup: string[] = [];
  let currentTopic: string | null = null;

  for (const segment of segments) {
    const topic = detectTopic(segment);
    
    // If same topic as previous, group them
    if (topic === currentTopic && currentGroup.length > 0) {
      currentGroup.push(segment);
    } else {
      // Save previous group if exists
      if (currentGroup.length > 0) {
        const polished = polishGroup(currentGroup, currentTopic);
        if (polished) points.push(polished);
      }
      // Start new group
      currentGroup = [segment];
      currentTopic = topic;
    }
  }
  
  // Don't forget the last group
  if (currentGroup.length > 0) {
    const polished = polishGroup(currentGroup, currentTopic);
    if (polished) points.push(polished);
  }

  return points;
}

function detectTopic(segment: string): string {
  const lower = segment.toLowerCase();
  
  if (/\b(shift|roster|schedule|late|punctual|time|attendance|clock in|clock out)\b/.test(lower)) return 'attendance';
  if (/\b(budget|cost|money|finance|expense|revenue|profit|spending|invoice)\b/.test(lower)) return 'finance';
  if (/\b(customer|guest|complaint|service|review|rating|feedback)\b/.test(lower)) return 'customer';
  if (/\b(staff|employee|team|hiring|training|discipline|performance|review)\b/.test(lower)) return 'hr';
  if (/\b(project|deadline|timeline|milestone|delivery|completion)\b/.test(lower)) return 'project';
  if (/\b(safety|health|security|risk|compliance|fire|emergency)\b/.test(lower)) return 'safety';
  if (/\b(marketing|promotion|social media|advertising|campaign)\b/.test(lower)) return 'marketing';
  if (/\b(supplier|vendor|order|stock|inventory|delivery)\b/.test(lower)) return 'operations';
  if (/\b(website|app|software|system|tech|computer|online)\b/.test(lower)) return 'technology';
  
  return 'general';
}

function polishGroup(segments: string[], topic: string | null): string | null {
  if (segments.length === 0) return null;
  
  let combined: string;
  
  if (segments.length === 1) {
    combined = segments[0];
  } else {
    combined = segments.join(' ');
    combined = combined.replace(/\b(\w+)\s+\1\b/gi, '$1');
  }

  let polished = convertToProfessionalLanguage(combined, topic);
  
  polished = polished
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zA-Z]+/, '')
    .trim();

  if (polished.length < 20) return null;
  
  if (!/[.!?]$/.test(polished)) polished += '.';
  
  // If very long, try to split at a logical point
  if (polished.length > 140) {
    const midPoint = polished.substring(0, 140).lastIndexOf(' ');
    if (midPoint > 80) {
      const firstPart = polished.substring(0, midPoint).trim() + '.';
      return firstPart;
    }
  }

  return polished;
}

function convertToProfessionalLanguage(text: string, topic: string | null): string {
  const topicPrefixes: Record<string, string> = {
    attendance: 'Attendance & Scheduling: ',
    finance: 'Financial Review: ',
    customer: 'Customer Service: ',
    hr: 'HR & Staffing: ',
    project: 'Project Update: ',
    safety: 'Safety & Compliance: ',
    marketing: 'Marketing: ',
    operations: 'Operations: ',
    technology: 'IT & Systems: ',
  };

  let prefix = topic && topicPrefixes[topic] ? topicPrefixes[topic] : '';
  
  const conversions: [RegExp, string][] = [
    [/\b(want|need|would like)\s+(?:you|the team|staff|everyone)\s+to\b/gi, 'Team required to'],
    [/\bI want you guys to\b/gi, 'Team instructed to'],
    [/\bmake sure you\b/gi, 'Ensure'],
    [/\bdon'?t\s+be\s+late\b/gi, 'maintain punctual arrival'],
    [/\b(be|arrive)\s+on\s+time\b/gi, 'maintain punctuality'],
    [/\bwe discussed\b/gi, 'Discussed'],
    [/\bwe talked about\b/gi, 'Covered'],
    [/\bwe went over\b/gi, 'Reviewed'],
    [/\bwe looked at\b/gi, 'Examined'],
    [/\bwe noted\b/gi, 'Noted'],
    [/\bI mentioned\b/gi, 'Raised'],
    [/\bI explained\b/gi, 'Outlined'],
    [/\bI suggested\b/gi, 'Proposed'],
    [/\bwe agreed\b/gi, 'Consensus reached on'],
    [/\bwe need to\b/gi, 'Required action:'],
    [/\bwe should\b/gi, 'Recommended:'],
    [/\bgoing forward\b/gi, 'Moving forward'],
    [/\bas you know\b/gi, ''],
    [/\bjust to remind you\b/gi, 'Reminder:'],
  ];

  for (const [pattern, replacement] of conversions) {
    text = text.replace(pattern, replacement);
  }

  text = text.trim();
  if (text && prefix) {
    text = text.charAt(0).toLowerCase() + text.slice(1);
  } else if (text) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return prefix + text;
}

function isJustFluff(segment: string): boolean {
  const fluff = [
    /^(?:hello|hi|hey|thanks|thank you|okay|ok|right|so|well|now|yes|no|yeah|um|uh)$/i,
    /^(?:as you know|just to say|I wanted to mention|I think that|I believe that)$/i,
    /^(?:any questions?|does that make sense?|is that clear?)$/i,
    /^(?:moving on|next item|let's continue|as I was saying)$/i,
  ];
  return fluff.some(pattern => pattern.test(segment.trim()));
}

function detectAction(segment: string): { action: string; owner: string; deadline: string } | null {
  const lower = segment.toLowerCase();
  
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

  let owner = extractName(segment) || 'Team';
  if (/\b(I will|I'll|I shall)\b/i.test(segment)) owner = 'Manager';
  if (/\b(we will|we'll|we shall)\b/i.test(segment)) owner = 'Team';
  if (/\b(you will|you'll|you must)\b/i.test(segment)) owner = 'Staff';
  
  const deadline = extractDeadline(segment) || 'TBC';
  
  let actionText = segment
    .replace(/\b(?:I want you to|I need you to|I ask you to|make sure you|ensure you)\b/gi, '')
    .replace(/\b(?:we|I)\s+(?:will|shall|must|need to|have to)\b/gi, '')
    .replace(/\b(?:you|we|they)\s+(?:must|should|need to|have to)\b/gi, '')
    .trim();
    
  actionText = actionText.charAt(0).toUpperCase() + actionText.slice(1);
  actionText = actionText.replace(/[.!?;,]+$/, '');
  
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
  const decisionPatterns = [
    /\b(?:it was|we have|I have|the panel has)?\s*(?:decided|agreed|resolved|concluded|determined|approved|confirmed)\b/i,
    /\b(?:decision|agreement|resolution)\s+(?:is|was|made|reached)\b/i,
    /\b(?:agreed|approved|confirmed|accepted|authorised|authorized)\s+(?:that|to)\b/i,
  ];

  const isDecision = decisionPatterns.some(pattern => pattern.test(segment));
  
  if (!isDecision) return null;

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

function formatActionsTable(actions: { action: string; owner: string; deadline: string }[]): string {
  const header = '| Action | Owner | Deadline |';
  const separator = '|--------|-------|----------|';
  
  const rows = actions.slice(0, 8).map(a => {
    let cleanAction = a.action
      .replace(/\|/g, '/')
      .replace(/\n/g, ' ')
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