import type { Meeting, MeetingType, Attendee, ActionItem } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  return generateStructuredMinutes(meeting);
}

interface ParsedContent {
  keyPoints: { topic: string; points: string[] }[];
  decisions: string[];
  transcriptActions: ActionItem[];
}

function generateStructuredMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText, actions: existingActions } = meeting;
  const totalAttendees = attendees.length;

  const { keyPoints, decisions, transcriptActions } = parseTranscript(transcriptText);

  // Merge existing actions with parsed ones
  const allActions = mergeActions(existingActions, transcriptActions);

  // Format sections
  const attendeesSection = formatAttendees(attendees, type);
  const keyPointsSection = formatKeyPoints(keyPoints);
  const decisionsSection = formatDecisions(decisions);
  const actionsTable = formatActionsTable(allActions);
  const nextSteps = formatNextSteps(type, allActions);

  return `# ${formatMeetingTypeHeader(type)} MINUTES

${generateExecutiveSummary(keyPoints, allActions, title, type)}

## Meeting Information

| Field | Details |
|:------|:--------|
| **Date** | ${formatDate(date)} |
| **Time** | ${startTime} |
| **Type** | ${formatMeetingType(type)} |
| ${type === 'disciplinary' || type === 'investigation' ? '**Location**' : '**Venue**'} | ${location || 'Not stated'} |
| **Subject** | ${title} |
${caseRef ? `| **Case Ref** | ${caseRef} |` : ''}

## Attendees (${totalAttendees})

${attendeesSection}

## Discussion Summary

${keyPointsSection}

## Decisions

${decisionsSection}

## Action Items (${allActions.length})

${actionsTable}

## Follow-up

${nextSteps}
${(type === 'disciplinary' || type === 'investigation') ? generateHRAddendum(type, meeting.consentConfirmed) : ''}

---
*Document prepared by MinuteMate | ${getConfidentialityLevel(type)} | Generated: ${new Date().toLocaleDateString('en-GB')}*
`;
}

function parseTranscript(transcript: string | undefined): ParsedContent {
  const keyPoints: Map<string, string[]> = new Map();
  const decisions: string[] = [];
  const actions: ActionItem[] = [];

  if (!transcript || !transcript.trim()) {
    return { keyPoints: new Map(), decisions, transcriptActions: actions };
  }

  // STEP 1: Aggressive cleaning - remove filler words
  let text = transcript
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally|actually|honestly|right|okay|ok|so|well|now|yes|no|yeah)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // STEP 2: Remove all meeting management phrases completely
  const noisePhrases = [
    /^(?:hello|hi|hey|welcome|good morning|good afternoon|good evening)[,\.\s]+/i,
    /thank\s+you\s+(?:for\s+)?(?:coming|joining|attending)[,\.\s]+/gi,
    /(?:let's|let us)\s+(?:begin|start|get started|move on|continue)/gi,
    /that'?s\s+all\s+for\s+now/gi,
    /let'?s\s+wrap\s+up/gi,
    /(?:does\s+that\s+make\s+sense|any\s+questions|is\s+that\s+clear)/gi,
    /(?:great|good|excellent|perfect|wonderful|nice)\s+(?:job|work)/gi,
    /welcome\s+to\s+the\s+meeting/gi,
    /thank\s+you\s+for\s+coming\s+in/gi,
    /can\s+start\s+with\s+the\s+first\s+point/gi,
  ];

  noisePhrases.forEach(pattern => {
    text = text.replace(pattern, ' ');
  });

  text = text.replace(/\s+/g, ' ').trim();

  // STEP 3: Add sentence boundaries for unpunctuated speech
  // This is the KEY FIX - handle transcripts with no punctuation
  text = text
    // Add period before new thought indicators
    .replace(/\s+and\s+that's\s+/gi, ". That's ")
    .replace(/\s+and\s+that\s+is\s+/gi, ". That is ")
    .replace(/\s+another\s+point\s+is\s+that\s+/gi, ". Another point is that ")
    .replace(/\s+also\s+/gi, ". Also ")
    .replace(/\s+additionally\s+/gi, ". Additionally ")
    .replace(/\s+however\s+/gi, ". However ")
    .replace(/\s+but\s+/gi, ". But ")
    .replace(/\s+and\s+I\s+want/gi, ". I want")
    .replace(/\s+and\s+also/gi, ". Also")
    .replace(/\s+in\s+the\s+immediately/gi, ". Immediately")
    .replace(/\s+immediately\s+another/gi, ". Another")
    .replace(/\s+next\s+/gi, ". Next ")
    .replace(/\s+moving\s+on\s+/gi, ". Moving on ")
    .replace(/\s+finally\s+/gi, ". Finally ")
    // Handle camelCase from speech-to-text (e.g., "salesOfBaha")
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Add period before capitalized words that start new ideas
    .replace(/([a-z])\s+([A-Z][a-z]+\s+(?:is|was|needs?|should?|will|can))/g, '$1. $2');

  // STEP 4: Split into sentences and filter
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 10 && !isNoiseOnly(s));

  // STEP 5: Process each sentence
  for (const sentence of sentences) {
    // Try extract action first (priority)
    const action = extractAction(sentence);
    if (action) {
      actions.push(action);
      continue;
    }

    // Try extract decision
    const decision = extractDecision(sentence);
    if (decision) {
      decisions.push(decision);
      continue;
    }

    // Must be a discussion point - clean and categorize
    const cleaned = cleanDiscussionPoint(sentence);
    if (cleaned && cleaned.length >= 15) {
      const topic = detectTopic(cleaned);
      if (!keyPoints.has(topic)) {
        keyPoints.set(topic, []);
      }

      // Avoid duplicates/similar points
      const existing = keyPoints.get(topic)!;
      const isSimilar = existing.some(p => 
        calculateSimilarity(p.toLowerCase(), cleaned.toLowerCase()) > 0.7
      );

      if (!isSimilar) {
        existing.push(cleaned);
      }
    }
  }

  return { keyPoints, decisions, transcriptActions: actions };
}

function isNoiseOnly(text: string): boolean {
  const noisePatterns = [
    /^(?:welcome|hello|hi|hey|thanks|okay|ok|right|so|well|and|the|in|on)/i,
    /^(?:moving on|next|let's continue)/i,
    /^(?:any questions|does that make sense)/i,
    /^\d+$/,
    /^\s*$/,
  ];
  return noisePatterns.some(p => p.test(text));
}

function extractAction(sentence: string): ActionItem | null {
  const lower = sentence.toLowerCase();

  // Skip if it's just discussion without clear action
  if (/\b(need|want|must)\s+to\s+discuss\b/.test(lower)) {
    return null;
  }

  // Must contain clear directive language that implies DOING
  const hasDirective = /\b(need|want|must|require|ensure|make sure|be|arrive|come|start|finish|complete|submit|review|send|prepare|update|check|arrange|organize|deliver|provide|create|implement|follow|monitor|track|report|address|handle|resolve|fix|improve|increase|reduce|maintain|achieve|meet|reach|establish|set up|schedule|plan|coordinate|communicate|inform|notify|contact|call|email|give|share|distribute|present|show|demonstrate|explain|train|teach|guide|assist|help|support|manage|lead|direct|oversee|supervise|delegate|assign|allocate|approve|authorize|sign|confirm|verify|validate|test|audit|inspect|assess|evaluate|measure|analyze|research|investigate|find|identify|determine|decide|agree|commit|promise|guarantee|insist|demand|request|ask|tell|instruct|order|command|advise|recommend|suggest|propose|offer|volunteer|consent|accept|endorse|back|cannot|don't)\b/.test(lower);
  const hasOwner = /\b(you|we|I|team|staff|manager|employee|guys|everyone|people)\b/.test(lower);

  if (!hasDirective || !hasOwner) return null;

  // Extract meaning, not exact words
  let actionText = sentence;

  // Remove leading filler
  actionText = actionText.replace(/\banother\s+point\s+is\s+that\s+/gi, '');

  // Transform directives
  actionText = actionText
    .replace(/\bI want you guys to\b/gi, 'Team to')
    .replace(/\bI need you guys to\b/gi, 'Team to')
    .replace(/\bI need you to\b/gi, '')
    .replace(/\bwe need to\b/gi, 'To')
    .replace(/\byou need to\b/gi, '')
    .replace(/\bmake sure you\b/gi, '')
    .replace(/\b(maybe|perhaps|possibly|might)\b/gi, '')
    .replace(/\b(or something|or whatever|etc)\b/gi, '')
    .replace(/\s+(?:of|for)\s+(?:the|a|an)\s+(?:ocean|coffee|break|minute)/gi, '')
    .replace(/\s+if\s+you're\s+not\s+a\s+coffee.*/gi, '')
    .trim();

  // Consolidate punctuality-related phrases
  if (/\b(be on time|cannot be late|arrive punctually|maintain punctual)\b/i.test(actionText)) {
    actionText = actionText
      .replace(/\s+(?:you\s+)?cannot\s+be\s+late\b/gi, '')
      .replace(/\s+(?:you\s+)?can\s+arrive\s+10\s+minutes\s+early\b/gi, '')
      .replace(/\s+(?:you\s+)?can\s+come\s+10\s+minutes\s+earlier\b/gi, '')
      .replace(/\bbe\s+on\s+time\s+on\s+shift\b/gi, 'arrive punctually for shifts')
      .replace(/\bbe\s+on\s+time\b/gi, 'arrive punctually');
  }

  actionText = actionText.trim();

  if (actionText.length < 10 || actionText.length > 100) return null;

  // Determine owner
  let owner = 'Team';
  if (/\bI\s+will|I'll\b/i.test(sentence)) owner = 'Manager';
  else if (/\byou\s+will|you'll\b/i.test(sentence)) owner = 'Employee';
  else if (/\bwe\s+will|we'll\b/i.test(sentence)) owner = 'All';
  else if (/\bI need you guys to\b/i.test(sentence)) owner = 'Team';
  else if (/\byou guys\b/i.test(sentence)) owner = 'Team';

  // Extract deadline if present
  let deadline: string | undefined;
  const deadlineMatch = sentence.match(/\b(?:by|before|due)\s+(tomorrow|today|next week|Monday|Tuesday|Wednesday|Thursday|Friday|(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)|the\s+end\s+of|EOB|EOD)\b/i);
  if (deadlineMatch) deadline = deadlineMatch[1];

  return {
    id: crypto.randomUUID(),
    action: actionText.charAt(0).toUpperCase() + actionText.slice(1).replace(/[.!?;,]+$/, ''),
    owner,
    deadline
  };
}

function extractDecision(sentence: string): string | null {
  if (!/\b(decided|agreed|resolved|concluded|approved|confirmed)\b/i.test(sentence)) {
    return null;
  }

  let decision = sentence
    .replace(/\b(?:it was|we have|I have)?\s*(?:decided|agreed|resolved|concluded|approved|confirmed)\s+(?:that|to)?\s*/i, '')
    .replace(/\b(?:the|a)\s+(?:decision|agreement)\s+(?:is|was)\s*/i, '')
    .trim();

  if (decision.length < 10) return null;

  return decision.charAt(0).toUpperCase() + decision.slice(1).replace(/[.!?;,]+$/, '') + '.';
}

function cleanDiscussionPoint(text: string): string | null {
  // Skip noise sentences
  if (isNoiseOnly(text) || text.length < 20) return null;

  let cleaned = text;

  // Remove leading filler phrases FIRST
  cleaned = cleaned
    .replace(/^(?:and|so|but|also|then)\s+/gi, '')
    .replace(/^that's\s+/gi, '')
    .replace(/^another\s+point\s+is\s+that\s+/gi, '');

  // Apply transformations - capture subject + verb phrase together
  cleaned = cleaned
    .replace(/\b(?:we|I|they)\s+need\s+to\s+discuss\s+about\b/gi, 'Discussion covered')
    .replace(/\b(?:we|I|they)\s+need\s+to\s+discuss\b/gi, 'Discussion covered')
    .replace(/\b(?:we|I|they)\s+(?:discussed|talked about|went over|looked at)\b/gi, 'Discussion covered')
    .replace(/\b(?:we|I|they)\s+noted\b/gi, 'Noted')
    .replace(/\bI\s+(?:mentioned|explained|suggested)\b/gi, 'Raised')
    .replace(/\bI\s+want\b/gi, 'Focus on')
    .replace(/\b(?:we|I|they)\s+agreed\b/gi, 'Consensus reached')
    .replace(/\b(?:we|I|they)\s+need\s+to\s+improve\b/gi, 'Improvement needed')
    .replace(/\bas you know\b/gi, '')
    .replace(/\bI\s+think\b/gi, 'View:')
    .replace(/\bstart\s+with\s+point\s+one\b/gi, 'review initial points')
    .replace(/\b(that'?s|that is)\s+in\s+between\b/gi, 'regarding')
    .replace(/\bsales\s+of\s+bar\b/gi, 'bar sales performance')
    .replace(/\bthe\s+proving\s+sales\s+of\b/gi, 'sales performance of');

  // Remove rambling endings
  cleaned = cleaned
    .replace(/\s+(?:or|and)\s+(?:something|whatever|etc|so on).*/gi, '')
    .replace(/\s+maybe\s+.*/gi, '')
    .replace(/\s+if\s+you're\s+not\s+a\s+coffee.*/gi, '');

  cleaned = cleaned.trim();

  if (cleaned.length < 15 || cleaned.length > 120) return null;

  // Ensure it reads like a summary
  if (!/^\b(Discussion|Noted|Raised|Consensus|Improvement|Review|Update|Focus)\b/i.test(cleaned)) {
    cleaned = 'Discussion covered ' + cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).replace(/[.!?;,]+$/, '') + '.';
}

function detectTopic(text: string): string {
  const lower = text.toLowerCase();

  if (/\b(sales|revenue|profit|target|client|customer|business development|pipeline)\b/.test(lower)) return 'Sales & Business Development';
  if (/\b(shift|schedule|attendance|punctual|late|timekeeping|roster|on time|on shift)\b/.test(lower)) return 'Attendance & Scheduling';
  if (/\b(budget|cost|financial|expense|spend|cash flow|invoice)\b/.test(lower)) return 'Finance';
  if (/\b(performance|review|training|development|career|progress)\b/.test(lower)) return 'Performance & Development';
  if (/\b(project|deadline|delivery|milestone|timeline)\b/.test(lower)) return 'Projects';
  if (/\b(complaint|feedback|service|customer experience)\b/.test(lower)) return 'Customer Service';
  if (/\b(safety|compliance|risk|security|health)\b/.test(lower)) return 'Safety & Compliance';
  if (/\b(operation|process|procedure|system)\b/.test(lower)) return 'Operations';

  return 'General';
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

function formatAttendees(attendees: Attendee[], type: MeetingType): string {
  if (attendees.length === 0) return '_No attendees recorded_';

  const rolePriority: Record<string, number> = {
    'Chair': 1, 'Investigator': 1, 'Manager': 2, 'HR': 3, 
    'Employee': 4, 'Note-taker': 5, 'Witness': 6, 'Companion': 7
  };

  const sorted = [...attendees].sort((a, b) => {
    const priA = rolePriority[a.role] || 99;
    const priB = rolePriority[b.role] || 99;
    return priA - priB;
  });

  return sorted.map(a => `• **${a.name}** – ${a.role}`).join('\n');
}

function formatKeyPoints(keyPoints: Map<string, string[]>): string {
  if (keyPoints.size === 0) return '_No discussion points recorded._';

  const sections: string[] = [];
  const sortedTopics = Array.from(keyPoints.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [topic, points] of sortedTopics) {
    if (points.length === 0) continue;
    sections.push(`**${topic}**\n${points.map(p => `• ${p}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

function formatDecisions(decisions: string[]): string {
  if (decisions.length === 0) return '_No formal decisions recorded._';
  return decisions.map(d => `• ${d}`).join('\n');
}

function formatActionsTable(actions: ActionItem[]): string {
  if (actions.length === 0) {
    return '| Action | Owner | Deadline |\n|:-------|:-----:|:---------|\n| _No actions recorded_ | – | – |';
  }

  const rows = actions.map(a => {
    let action = a.action.replace(/\|/g, '/');
    if (action.length > 60) action = action.substring(0, 57) + '...';
    return `| ${action} | ${a.owner} | ${a.deadline || 'TBC'} |`;
  });

  return ['| Action | Owner | Deadline |', '|:-------|:-----:|:---------|', ...rows].join('\n');
}

function formatNextSteps(type: MeetingType, actions: ActionItem[]): string {
  const steps: string[] = [];

  if (actions.length > 0) {
    steps.push(`• Complete ${actions.length} action item${actions.length !== 1 ? 's' : ''} detailed above`);
  }

  if (type === 'disciplinary') {
    steps.push('• HR to process formal documentation within 48 hours');
    steps.push('• Written outcome to be issued within 5 working days');
    steps.push('• Employee rights to appeal to be confirmed in writing');
  } else if (type === 'investigation') {
    steps.push('• Investigation findings to be compiled');
    steps.push('• Decision on next steps within 10 working days');
  } else if (type === '1:1') {
    steps.push('• Next 1:1 to be scheduled per regular cadence');
  }

  steps.push('• Minutes circulated to attendees within 24 hours');

  return steps.join('\n');
}

function generateExecutiveSummary(keyPoints: Map<string, string[]>, actions: ActionItem[], title: string, type: MeetingType): string {
  const topicCount = keyPoints.size;
  const actionCount = actions.length;

  let summary = `Meeting addressed ${topicCount} topic area${topicCount !== 1 ? 's' : ''}`;
  if (actionCount > 0) summary += ` with ${actionCount} action item${actionCount !== 1 ? 's' : ''}`;
  summary += `. **${title}**.`;

  if (type === 'disciplinary') summary += ' *Formal disciplinary hearing.*';
  if (type === 'investigation') summary += ' *Investigation meeting.*';

  return summary;
}

function generateHRAddendum(type: MeetingType, consentConfirmed: boolean): string {
  if (type === 'disciplinary') {
    return `

## HR Documentation

**Allegations:** Presented to employee. Response recorded.
**Evidence:** Reviewed and acknowledged.
**Mitigation:** ${consentConfirmed ? 'Employee response provided.' : 'Pending.'}
**Outcome:** To be confirmed in writing within 5 working days.
**Appeal Rights:** 5 working days from written confirmation.`;
  }

  return `

## HR Documentation

**Investigation Scope:** Parameters explained to employee.
**Evidence:** Documents reviewed.
**Response:** ${consentConfirmed ? 'Employee cooperation provided.' : 'Pending.'}
**Next Steps:** Findings to be compiled.`;
}

function mergeActions(existing: ActionItem[], parsed: ActionItem[]): ActionItem[] {
  if (existing.length === 0) return parsed;
  if (parsed.length === 0) return existing;

  const merged = [...existing];

  for (const p of parsed) {
    const isDup = existing.some(e => 
      e.action.toLowerCase().includes(p.action.toLowerCase().substring(0, 20)) ||
      p.action.toLowerCase().includes(e.action.toLowerCase().substring(0, 20))
    );
    if (!isDup) merged.push(p);
  }

  return merged;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatMeetingType(type: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    '1:1': '1:1 Meeting',
    'team': 'Team Meeting', 
    'disciplinary': 'Disciplinary Hearing',
    'investigation': 'Investigation Meeting'
  };
  return labels[type];
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
  if (type === 'disciplinary' || type === 'investigation') return 'CONFIDENTIAL – HR Records';
  if (type === '1:1') return 'CONFIDENTIAL – Management';
  return 'Internal';
}

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  '1:1': '1:1 Meeting',
  'team': 'Team Meeting',
  'disciplinary': 'Disciplinary Hearing',
  'investigation': 'Investigation Meeting',
};

export function extractActionsFromMinutes(minutesText: string): ActionItem[] {
  const actions: ActionItem[] = [];

  const match = minutesText.match(/\|\s*Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|\n\|[-:]+\|[-:]+\|[-:]+\|\n([\s\S]*?)(?=\n##|\n---|$)/i);

  if (match) {
    const lines = match[1].split('\n')
      .filter(l => l.startsWith('|') && !l.includes('Action'))
      .map(l => l.split('|').map(p => p.trim()).filter(Boolean));

    for (const parts of lines) {
      if (parts.length >= 2 && !parts[0].includes('No actions')) {
        actions.push({
          id: crypto.randomUUID(),
          action: parts[0],
          owner: parts[1],
          deadline: parts[2]
        });
      }
    }
  }

  return actions;
}
