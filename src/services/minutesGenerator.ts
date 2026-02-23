import type { Meeting, MeetingType, Attendee, ActionItem } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  return generateStructuredMinutes(meeting);
}

interface ParsedContent {
  keyPoints: { topic: string; points: string[] }[];
  decisions: string[];
  transcriptActions: ActionItem[];
  summary: string;
}

function generateStructuredMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText, actions: existingActions } = meeting;
  const totalAttendees = attendees.length;

  // Parse transcript for content
  const { keyPoints, decisions, transcriptActions, summary } = parseTranscript(transcriptText, title, type);

  // Merge existing actions with parsed ones (existing take priority)
  const allActions = mergeActions(existingActions, transcriptActions);

  // Build sections
  const attendeesSection = formatAttendees(attendees);
  const keyPointsSection = formatKeyPoints(keyPoints);
  const decisionsSection = formatDecisions(decisions);
  const actionsTable = formatActionsTable(allActions);
  const nextSteps = formatNextSteps(type, allActions, decisions.length);
  const hrAddendum = (type === 'disciplinary' || type === 'investigation') ? generateHRAddendum(meeting) : '';

  return `# ${formatMeetingTypeHeader(type)} MINUTES

---

## Executive Summary
${summary}

---

## Meeting Details

| Attribute | Information |
|:----------|:------------|
| **Date** | ${formatDate(date)} |
| **Time** | ${startTime} |
| **Type** | ${MEETING_TYPE_LABELS[type]} |
| ${type === 'disciplinary' || type === 'investigation' ? '**Location**' : '**Venue**'} | ${location || 'Not stated'} |
| **Subject** | ${title} |
${caseRef ? `| **Case Reference** | ${caseRef} |` : ''}
${(type === 'disciplinary' || type === 'investigation') ? `| **Consent** | ${meeting.consentConfirmed ? 'Confirmed' : 'Pending'} |` : ''}

---

## Attendees (${totalAttendees})

${attendeesSection}

---

## Key Points Discussed

${keyPointsSection}

---

## Decisions Made

${decisionsSection}

---

## Actions Agreed (${allActions.length})

${actionsTable}

---

## Next Steps & Follow-up

${nextSteps}

${hrAddendum}
---

*Document prepared by MinuteMate*  
*Classification: ${getConfidentialityLevel(type)}*  
*Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}*
`;
}

function parseTranscript(transcript: string | undefined, title: string, type: MeetingType): ParsedContent {
  const keyPoints: Map<string, string[]> = new Map();
  const decisions: string[] = [];
  const transcriptActions: ActionItem[] = [];
  
  if (!transcript || !transcript.trim()) {
    return { 
      keyPoints: new Map(), 
      decisions: [], 
      transcriptActions: [], 
      summary: `_Meeting held regarding: ${title}. No transcript available for analysis._` 
    };
  }

  // Clean transcript
  let cleaned = transcript
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally|actually|honestly|right|okay|ok)\b/gi, '')
    .replace(/\b(\w+)\s+\1\s+\1+\b/gi, '$1')
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove meeting management phrases
  cleaned = cleaned
    .replace(/^(?:hello|hi|hey|welcome|good morning|good afternoon|good evening)[,.\s]+/i, '')
    .replace(/\bthank\s+you\s+(?:for\s+)?(?:coming|joining|attending)\b/gi, '')
    .replace(/\b(?:let's|let us)\s+(?:begin|start|get started|move on|continue)\b/gi, '')
    .replace(/\b(?:that'?s\s+all|let'?s\s+wrap\s+up|we'?ll\s+stop\s+there|good\s+meeting)\b/gi, '')
    .replace(/\b(?:does\s+that\s+make\s+sense|any\s+questions|is\s+that\s+clear)\b/gi, '');

  // Split into segments
  const segments = splitIntoSegments(cleaned);

  // Classify each segment
  for (const segment of segments) {
    if (segment.length < 15 || isAdministrativeNoise(segment)) continue;

    // Check for decisions first
    const decision = extractDecision(segment);
    if (decision) {
      decisions.push(decision);
      continue;
    }

    // Check for specific actions
    const action = extractAction(segment);
    if (action) {
      transcriptActions.push(action);
      continue;
    }

    // Remaining content = key points
    const topic = detectTopic(segment);
    const polished = polishToKeyPoint(segment, topic);
    
    if (polished) {
      if (!keyPoints.has(topic)) {
        keyPoints.set(topic, []);
      }
      // Avoid duplicates
      if (!keyPoints.get(topic)!.some(p => p.toLowerCase() === polished.toLowerCase())) {
        keyPoints.get(topic)!.push(polished);
      }
    }
  }

  const summary = generateExecutiveSummary(keyPoints, decisions, transcriptActions, title, type);

  return { keyPoints, decisions, transcriptActions, summary };
}

function splitIntoSegments(text: string): string[] {
  // Normalize sentence boundaries
  text = text
    .replace(/([a-z])([A-Z])/g, '$1. $2')
    .replace(/\s+(?:and then|next|also|additionally|furthermore|moreover|however)\s+/gi, '. $1 ')
    .replace(/,/g, ', ')
    .replace(/\s+/g, ' ');

  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

function isAdministrativeNoise(segment: string): boolean {
  const noise = [
    /^(?:welcome|hello|hi|hey|thanks|thank you|okay|ok|right|so|well|now|yes|no|yeah)/i,
    /^(?:moving on|next item|let's continue|as I was saying|before we start)/i,
    /^(?:any questions|does that make sense|is that clear|are we good)/i,
    /^(?:great|good|excellent|perfect|wonderful|nice)\s+(?:job|work|meeting|stuff)/i,
    /^(?:let's|let us)\s+(?:move on|continue|start)/i,
  ];
  return noise.some(pattern => pattern.test(segment));
}

function detectTopic(segment: string): string {
  const lower = segment.toLowerCase();
  
  // HR/People topics
  if (/\b(shift|roster|schedule|punctuality|attendance|timekeeping|late|absent|clock|annual leave|holiday|sick leave)\b/.test(lower)) 
    return 'Attendance & Scheduling';
  if (/\b(hiring|recruitment|interview|job offer|probation|training|performance|review|appraisal|capability|grievance)\b/.test(lower)) 
    return 'Human Resources';
  if (/\b(disciplinary|warning|sanction|misconduct|performance issue|behavior)\b/.test(lower)) 
    return 'Disciplinary & Conduct';
    
  // Business topics  
  if (/\b(sales|revenue|profit|growth|target|forecast|pipeline|client|customer|lead|conversion)\b/.test(lower)) 
    return 'Sales & Business Development';
  if (/\b(budget|cost|expense|financial|spend|investment|margin|cash flow|invoice|payment)\b/.test(lower)) 
    return 'Finance & Budget';
  if (/\b(complaint|feedback|review|rating|service quality|guest experience|satisfaction|NPS)\b/.test(lower)) 
    return 'Customer Experience';
  if (/\b(project|deadline|milestone|delivery|timeline|completion|phase|scope|resource)\b/.test(lower)) 
    return 'Projects & Delivery';
  if (/\b(safety|health|security|risk|compliance|regulation|audit|inspection|GDPR|data protection)\b/.test(lower)) 
    return 'Safety & Compliance';
  if (/\b(marketing|promotion|campaign|advertising|social media|brand|content|SEO)\b/.test(lower)) 
    return 'Marketing & Communications';
  if (/\b(supplier|vendor|inventory|stock|order|supply chain|logistics|procurement)\b/.test(lower)) 
    return 'Operations & Supply Chain';
  if (/\b(system|software|website|app|technical|IT|digital|automation|platform|tool)\b/.test(lower)) 
    return 'Technology & Systems';
  if (/\b(strategy|objective|goal|mission|vision|value|culture|expansion|restructure)\b/.test(lower)) 
    return 'Strategy & Planning';
    
  return 'General Discussion';
}

function extractDecision(segment: string): string | null {
  const patterns = [
    /\b(?:it was|we have|I have|the panel has|management has)?\s*(?:decided|agreed|resolved|concluded|determined|approved|confirmed|authorised|authorized)\s+(?:that|to)?\b/i,
    /\b(?:decision|resolution|agreement)\s+(?:is|was|has been)\s+(?:made|reached|taken)\b/i,
  ];

  if (!patterns.some(p => p.test(segment))) return null;

  let decision = segment
    .replace(/\b(?:it was|we have|I have|the panel has|management has)?\s*(?:decided|agreed|resolved|concluded|determined|approved|confirmed|authorised|authorized)\s+(?:that|to)?\s*/i, '')
    .replace(/\b(?:the|a)\s+(?:decision|resolution|agreement)\s+(?:is|was|has been)\s+(?:made|reached|taken)\s*/i, '')
    .trim();

  if (decision.length < 10) return null;
  
  decision = decision.charAt(0).toUpperCase() + decision.slice(1);
  if (!/[.!?]$/.test(decision)) decision += '.';
  
  return decision;
}

function extractAction(segment: string): ActionItem | null {
  const lower = segment.toLowerCase();
  
  // Must have clear ownership or deadline to be an action (not just a discussion point)
  const hasCommitment = /\b(will|shall|must|need to|have to|required to|ensure|make sure)\b/.test(lower);
  const hasOwner = /\b(?:by|for)\s+[A-Z][a-z]+|[A-Z][a-z]+ will\b/.test(segment);
  const hasDeadline = /\b(?:by|before|due|deadline)\s+(?:tomorrow|today|next week|Monday|Tuesday|Wednesday|Thursday|Friday|the \d+|end of|EOB|EOD|COB|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i.test(segment);
  
  if (!hasCommitment || (!hasOwner && !hasDeadline)) return null;

  // Extract owner
  let owner = 'Team';
  const ownerMatch = segment.match(/\b(?:by|for|assigned to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (ownerMatch) owner = ownerMatch[1];
  else if (/\b(I will|I'll)\b/i.test(segment)) owner = 'Manager';
  
  // Extract deadline
  let deadline: string | undefined;
  const deadlineMatch = segment.match(/\b(?:by|before|due)\s+(tomorrow|today|next week|Monday|Tuesday|Wednesday|Thursday|Friday|the \d+.*?|end of.*?|EOB|EOD|COB|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (deadlineMatch) deadline = deadlineMatch[1];

  // Clean action text
  let actionText = segment
    .replace(/\b(?:I want you to|I need you to|please make sure|ensure that|we will|I will)\b/gi, '')
    .replace(/\b(?:by|for)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, '')
    .replace(/\b(?:by|before|due)\s+(?:tomorrow|today|next week|.*?)\b/gi, '')
    .trim();

  // Professionalize
  actionText = actionText
    .replace(/\bdon'?t\s+be\s+late\b/gi, 'maintain punctual arrival')
    .replace(/\bbe\s+on\s+time\b/gi, 'maintain punctuality')
    .replace(/\bget\s+this\s+done\b/gi, 'complete')
    .replace(/\bsort\s+this\s+out\b/gi, 'resolve');

  if (actionText.length < 10) return null;
  
  actionText = actionText.charAt(0).toUpperCase() + actionText.slice(1).replace(/[.!?;,]+$/, '');

  return {
    id: crypto.randomUUID(),
    action: actionText,
    owner,
    deadline
  };
}

function polishToKeyPoint(segment: string, topic: string): string | null {
  let polished = segment;

  // Convert casual to professional
  const conversions: [RegExp, string][] = [
    [/\b(want|would like|need)\s+(?:you|the team|staff|everyone)\s+to\b/gi, 'Required:'],
    [/\bI want you guys to\b/gi, 'Team instructed to'],
    [/\bwe discussed\b/gi, 'Discussion covered'],
    [/\bwe talked about\b/gi, 'Reviewed'],
    [/\bwe went over\b/gi, 'Examined'],
    [/\bwe looked at\b/gi, 'Analysed'],
    [/\bwe noted\b/gi, 'Noted'],
    [/\bI mentioned\b/gi, 'Raised'],
    [/\bI explained\b/gi, 'Outlined'],
    [/\bI suggested\b/gi, 'Proposed'],
    [/\bwe agreed\b/gi, 'Consensus reached'],
    [/\bwe need to improve\b/gi, 'Improvement required:'],
    [/\bgoing forward\b/gi, 'Moving forward'],
    [/\bjust to remind you\b/gi, 'Reminder:'],
    [/\bas you know\b/gi, ''],
    [/\bI think\b/gi, 'It was considered that'],
    [/\bI feel\b/gi, 'It was noted that'],
    [/\bwe have to\b/gi, 'Required:'],
    [/\bwe should\b/gi, 'Recommended:'],
  ];

  for (const [pattern, replacement] of conversions) {
    polished = polished.replace(pattern, replacement);
  }

  polished = polished.trim();
  if (polished.length < 20) return null;
  
  // Capitalize first letter after cleaning
  polished = polished.replace(/^[^a-zA-Z]*([a-zA-Z])/, (match, p1) => match.replace(p1, p1.toUpperCase()));
  
  if (!/[.!?]$/.test(polished)) polished += '.';

  return polished;
}

function generateExecutiveSummary(
  keyPoints: Map<string, string[]>, 
  decisions: string[], 
  actions: ActionItem[], 
  title: string,
  type: MeetingType
): string {
  const topicCount = keyPoints.size;
  const decisionCount = decisions.length;
  const actionCount = actions.length;
  
  let summary = `_Meeting addressed ${topicCount} key topic area${topicCount !== 1 ? 's' : ''}`;
  
  if (decisionCount > 0) {
    summary += ` with ${decisionCount} formal decision${decisionCount !== 1 ? 's' : ''}`;
  }
  
  if (actionCount > 0) {
    summary += `${decisionCount > 0 ? ' and' : ' with'} ${actionCount} action item${actionCount !== 1 ? 's' : ''} identified`;
  }
  
  summary += `._`;
  
  // Add context for HR meetings
  if (type === 'disciplinary') {
    summary += ` _This constitutes a formal disciplinary hearing._`;
  } else if (type === 'investigation') {
    summary += ` _This is a fact-finding investigation meeting._`;
  } else if (type === '1:1') {
    summary += ` _Regular check-in meeting._`;
  }
  
  return summary;
}

function formatAttendees(attendees: Attendee[]): string {
  if (attendees.length === 0) return '_No attendees recorded_';
  
  return attendees.map(a => {
    const role = a.role.trim();
    return `• **${a.name}** – ${role}`;
  }).join('\n');
}

function formatKeyPoints(keyPoints: Map<string, string[]>): string {
  if (keyPoints.size === 0) {
    return '_No substantive discussion points recorded._';
  }

  const sections: string[] = [];
  
  // Sort topics alphabetically for consistency
  const sortedTopics = Array.from(keyPoints.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [topic, points] of sortedTopics) {
    if (points.length === 0) continue;
    const topicHeader = `**${topic}**`;
    const bulletPoints = points.map(p => `  • ${p}`).join('\n');
    sections.push(`${topicHeader}\n${bulletPoints}`);
  }
  
  return sections.join('\n\n');
}

function formatDecisions(decisions: string[]): string {
  if (decisions.length === 0) return '_No formal decisions recorded._';
  return decisions.map(d => `• ${d}`).join('\n');
}

function formatActionsTable(actions: ActionItem[]): string {
  if (actions.length === 0) {
    return '| Action | Owner | Deadline |\n|:-------|:-----:|:---------|\n| _No specific actions agreed_ | – | – |';
  }

  const header = '| Action | Owner | Deadline |';
  const separator = '|:-------|:-----:|:---------|';
  
  const rows = actions.map(a => {
    let action = a.action.replace(/\|/g, '/').trim();
    if (action.length > 70) action = action.substring(0, 67) + '...';
    
    const owner = a.owner || 'TBC';
    const deadline = a.deadline || 'TBC';
    
    return `| ${action} | ${owner} | ${deadline} |`;
  });
  
  return [header, separator, ...rows].join('\n');
}

function formatNextSteps(type: MeetingType, actions: ActionItem[], decisionCount: number): string {
  const steps: string[] = [];
  
  if (actions.length > 0) {
    steps.push(`• **Action Items:** ${actions.length} item${actions.length !== 1 ? 's' : ''} to be completed as detailed above`);
  }
  
  if (decisionCount > 0) {
    steps.push(`• **Implementation:** Decisions to be implemented as agreed`);
  }
  
  if (type === 'disciplinary') {
    steps.push('• **HR Follow-up:** Formal disciplinary procedures to be actioned in accordance with company policy');
    steps.push('• **Documentation:** Complete records to be filed securely within 48 hours');
    steps.push('• **Right of Appeal:** Employee to be advised of appeal rights in writing');
  } else if (type === 'investigation') {
    steps.push('• **Investigation:** Fact-finding to continue as necessary');
    steps.push('• **Next Meeting:** Follow-up scheduled if required to conclude investigation');
    steps.push('• **Confidentiality:** All parties reminded of confidentiality requirements');
  } else if (type === '1:1') {
    steps.push('• **Follow-up:** Next 1:1 to be scheduled as per regular cadence');
    steps.push('• **Development:** Any agreed development actions to be tracked');
  }
  
  steps.push('• **Circulation:** Minutes to be distributed to all attendees within 24 hours');
  
  if (actions.length > 0) {
    steps.push('• **Review:** Outstanding actions to be reviewed at next meeting');
  }
  
  return steps.join('\n');
}

function generateHRAddendum(meeting: Meeting): string {
  const type = meeting.type;
  const isDisciplinary = type === 'disciplinary';
  
  return `
---

## HR Addendum (${isDisciplinary ? 'Disciplinary Hearing' : 'Investigation Meeting'})

${isDisciplinary ? `### Disciplinary Allegations
_Allegations presented to the employee. Detailed response recorded in meeting transcript._

### Evidence Reviewed
_List of documentary evidence presented:_
- [ ] Witness statements (if applicable)
- [ ] Relevant policies/procedures
- [ ] Previous records (if applicable)

### Mitigating Factors
_Any mitigating circumstances or explanations offered by the employee:_
${meeting.consentConfirmed ? '_Employee provided full response_' : '_Consent pending_'}

### Outcome
${isDisciplinary ? `_Decision communicated and rationale explained. Written confirmation to follow within 5 working days._` : `_No formal decision reached at investigation stage. Further enquiries may be required._`}

### Appeal Rights
${isDisciplinary ? `_Employee advised of right to appeal within 5 working days of receiving written outcome._` : `_Employee advised that investigation is ongoing and no decision has been made._`}

` : `### Investigation Scope
_Investigation parameters and allegations under review explained to employee._

### Evidence Presented
_Documents and witness accounts reviewed with employee:_
- [ ] Incident reports
- [ ] Witness statements
- [ ] Relevant communications

### Employee Response
_Employee given opportunity to respond and provide evidence:_
${meeting.consentConfirmed ? '_Full cooperation provided_' : '_Awaiting full response_'}

### Next Steps
- Investigation findings to be compiled
- Decision on formal proceedings to follow
- Employee to be informed of outcome within 10 working days

`}---
`;
}

// Helper functions
function mergeActions(existing: ActionItem[], parsed: ActionItem[]): ActionItem[] {
  if (existing.length === 0) return parsed;
  
  // Use existing actions but fill in gaps from parsed if needed
  const merged = [...existing];
  
  // Add parsed actions that don't duplicate existing ones
  for (const parsedAction of parsed) {
    const isDuplicate = existing.some(e => 
      e.action.toLowerCase().includes(parsedAction.action.toLowerCase()) ||
      parsedAction.action.toLowerCase().includes(e.action.toLowerCase())
    );
    
    if (!isDuplicate) {
      merged.push(parsedAction);
    }
  }
  
  return merged;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatMeetingTypeHeader(type: MeetingType): string {
  const headers: Record<MeetingType, string> = {
    '1:1': '1:1 MEETING',
    'team': 'TEAM MEETING',
    'disciplinary': 'DISCIPLINARY HEARING',
    'investigation': 'INVESTIGATION MEETING'
  };
  return headers[type];
}

function getConfidentialityLevel(type: MeetingType): string {
  if (type === 'disciplinary' || type === 'investigation') return 'CONFIDENTIAL – HR & Legal Records';
  if (type === '1:1') return 'CONFIDENTIAL – Management Records';
  return 'INTERNAL USE ONLY – Business Records';
}

// Import these from your types file or define here
const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  '1:1': '1:1 Meeting',
  'team': 'Team Meeting',
  'disciplinary': 'Disciplinary Hearing',
  'investigation': 'Investigation Meeting',
};

// Export for compatibility with existing code
export function extractActionsFromMinutes(minutesText: string): ActionItem[] {
  const actions: ActionItem[] = [];
  
  const tableRegex = /\|\s*Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|\n\|[-:]+\|[-:]+\|[-:]+\|\n([\s\S]*?)(?=\n##|\n---|$)/i;
  const match = minutesText.match(tableRegex);
  
  if (match && match[1]) {
    const lines = match[1].split('\n')
      .filter(l => l.startsWith('|') && !l.includes('Action'))
      .map(l => l.split('|').map(p => p.trim()).filter(p => p));
    
    for (const parts of lines) {
      if (parts.length >= 2 && parts[0] !== '_No specific actions agreed_' && !parts[0].startsWith('---')) {
        actions.push({
          id: crypto.randomUUID(),
          action: parts[0],
          owner: parts[1] || 'TBC',
          deadline: parts[2]
        });
      }
    }
  }
  
  return actions;
}