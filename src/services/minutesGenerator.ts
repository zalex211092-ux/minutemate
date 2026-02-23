import type { Meeting, MeetingType, Attendee, ActionItem } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  return generateStructuredMinutes(meeting);
}

interface ParsedContent {
  keyPoints: Map<string, string[]>;
  decisions: string[];
  transcriptActions: ActionItem[];
  rawTopics: string[]; // fallback: raw cleaned sentences
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

function generateStructuredMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText, actions: existingActions } = meeting;

  const { keyPoints, decisions, transcriptActions, rawTopics } = parseTranscript(transcriptText);
  const allActions = mergeAndConsolidateActions(existingActions, transcriptActions);
  const consolidatedKeyPoints = consolidateKeyPoints(keyPoints);

  // Fallback: if parser found nothing, use raw sentences as a General Matters bucket
  if (consolidatedKeyPoints.size === 0 && rawTopics.length > 0) {
    consolidatedKeyPoints.set('General Matters', rawTopics.slice(0, 8));
  }

  const attendeesSection = formatAttendees(attendees, type);
  const keyPointsSection = formatKeyPoints(consolidatedKeyPoints);
  const decisionsSection = formatDecisions(decisions);
  const actionsTable = formatActionsTable(allActions);
  const nextSteps = formatNextSteps(type, allActions);
  const execSummary = generateExecutiveSummary(consolidatedKeyPoints, allActions, title, type);

  return `# ${formatMeetingTypeHeader(type)} MINUTES

${execSummary}

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

${keyPointsSection}

## Decisions

${decisionsSection}

## Action Items (${allActions.length})

${actionsTable}

## Follow-up

${nextSteps}
${type === 'disciplinary' || type === 'investigation' ? generateHRAddendum(type, meeting.consentConfirmed) : ''}

---
*Document prepared by MinuteMate | ${getConfidentialityLevel(type)} | Generated: ${new Date().toLocaleDateString('en-GB')}*
`;
}

// ============================================================================
// TRANSCRIPT PARSING
// ============================================================================

function parseTranscript(transcript: string | undefined): ParsedContent {
  const keyPoints = new Map<string, string[]>();
  const decisions: string[] = [];
  const actions: ActionItem[] = [];
  const rawTopics: string[] = [];

  if (!transcript || transcript.trim().length < 5) {
    return { keyPoints, decisions, transcriptActions: actions, rawTopics };
  }

  const text = preprocessTranscript(transcript);
  const units = extractSemanticUnits(text);

  for (const unit of units) {
    if (isNoise(unit)) continue;

    // Collect raw topics as fallback before strict filtering
    if (unit.length >= 15 && unit.split(' ').length >= 3) {
      const cleaned = toSentenceCase(unit.replace(/[.!?]+$/, '').trim()) + '.';
      rawTopics.push(cleaned);
    }

    if (isFragment(unit)) continue;

    // Actions get priority
    const action = extractAction(unit);
    if (action) {
      actions.push(action);
      continue;
    }

    // Then decisions
    const decision = extractDecision(unit);
    if (decision) {
      decisions.push(decision);
      continue;
    }

    // Then discussion points
    const point = createDiscussionPoint(unit);
    if (point) {
      const topic = detectTopic(point);
      if (!keyPoints.has(topic)) keyPoints.set(topic, []);
      keyPoints.get(topic)!.push(point);
    }
  }

  return { keyPoints, decisions, transcriptActions: actions, rawTopics };
}

// ============================================================================
// PREPROCESSING
// ============================================================================

function preprocessTranscript(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    // Remove filler words
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally|actually|honestly|right so|so yeah|yeah so)\b/gi, ' ')
    // Fix camelCase from speech-to-text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Remove repeated words (stuttering: "the the", "and and")
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractSemanticUnits(text: string): string[] {
  // Mark natural speech boundaries before splitting
  const marked = text
    // Remove opening pleasantries
    .replace(/^(?:and\s+)?(?:welcome|hello|hi|hey|good morning|good afternoon|good evening)[,.\s]*/i, '')
    .replace(/^(?:thank you|thanks)\s+(?:for\s+)?(?:coming|joining|attending)[,.\s]*/i, '')

    // Transition words → split markers
    .replace(/\b(first(?:ly)?|first of all|to start|to begin with?)\b/gi, '.SPLIT.')
    .replace(/\b(second(?:ly)?|next(?:\s+thing)?|then|after that|following that)\b/gi, '.SPLIT.')
    .replace(/\b(another thing|another point|also|additionally|furthermore|moreover|on top of that)\b/gi, '.SPLIT.')
    .replace(/\b(however|but then again|although|though|that said)\b/gi, '.SPLIT.')
    .replace(/\b(finally|lastly|to conclude|in summary|to wrap up)\b/gi, '.SPLIT.')
    .replace(/\b(I (?:also\s+)?(?:want|need|would like) (?:to\s+)?(?:mention|raise|highlight|flag|touch on))\b/gi, '.SPLIT.')
    .replace(/\b(moving on|next item|next point|next up)\b/gi, '.SPLIT.')
    .trim();

  return marked
    .split(/(?:\.SPLIT\.|(?<=[.!?])\s+(?=[A-Z])|\n)/)
    .map(u => u.replace(/^\.SPLIT\.\s*/, '').trim())
    .filter(u => u.length >= 12);
}

// ============================================================================
// VALIDATION
// ============================================================================

function isFragment(text: string): boolean {
  const t = text.trim();

  // Too short
  if (t.length < 15) return true;

  // Fewer than 3 words
  if (t.split(/\s+/).length < 3) return true;

  // Ends with a dangling preposition or conjunction
  if (/\b(that|which|who|when|where|what|how|if|because|since|although|while|before|after|during|in|on|at|to|for|with|by|about|into|through|under|again|further|once|and|but|or|so|then|also)\s*$/i.test(t)) return true;

  // Pure subordinate clause openers
  if (/^(?:in one of|one of|some of|many of|most of|all of|none of|any of|each of|every one of)\b/i.test(t)) return true;

  // Ends mid-verb with no object
  if (/\b(need|want|should|must|will|can|could|would|may|might|touch|discuss|review|check|improve|increase|decrease|start|begin|continue|finish|complete|is|are|was|were|be)\s*$/i.test(t)) return true;

  return false;
}

function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 5) return true;

  return /^(?:yes|no|yeah|nah|okay|ok|right|sure|fine|great|good|excellent|perfect|thanks|thank you|welcome|hello|hi|hey|any questions|does that make sense|is that clear|are we good|moving on|let's continue|next slide|\d+)[\s.,!?]*$/i.test(t);
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

function extractAction(text: string): ActionItem | null {
  const lower = text.toLowerCase();

  // Must have directive language
  const hasDirective = /\b(need|must|require|ensure|make sure|have to|got to|complete|finish|submit|review|send|prepare|update|check|arrange|deliver|provide|create|implement|follow up|monitor|report|address|resolve|fix|improve|schedule|plan|contact|inform|notify|share|confirm|verify|approve|sign off|assign|set up|reach out)\b/.test(lower);

  if (!hasDirective) return null;

  // Must involve a person/group doing something
  const hasAgent = /\b(you|we|I|team|staff|manager|employee|everyone|all|guys|he|she|they)\b/.test(lower);
  if (!hasAgent) return null;

  let action = text;

  // Strip trailing noise clauses
  action = action
    .replace(/\s*,?\s+(?:if\s+(?:you|we)\s+(?:want|need|like|prefer|can|could)).*/i, '')
    .replace(/\s*,?\s+or\s+(?:something|whatever|anything|etc).*/i, '')
    .replace(/\s*,?\s+(?:to\s+)?have\s+(?:a|an)\s+(?:coffee|tea|break|drink|chat|catch-?up).*/i, '')
    .replace(/\s*,?\s+(?:and|or)\s+(?:have|get|grab|take)\s+(?:a|an)\s+.{1,20}$/i, '')
    .replace(/\s*,?\s+(?:just\s+)?to\s+(?:be|get)\s+(?:ready|prepared|set).*/i, '')
    .trim();

  // Professional transformation
  action = action
    .replace(/\bI\s+(?:need|want|would like)\s+(?:you\s+(?:guys\s+)?|everyone\s+)?to\b/gi, 'Team to')
    .replace(/\byou\s+(?:guys|all|everyone)\s+(?:need|must|have)\s+to\b/gi, 'Team to')
    .replace(/\byou\s+(?:need|must|have)\s+to\b/gi, 'Team to')
    .replace(/\bwe\s+(?:need|must|have)\s+to\b/gi, 'To')
    .replace(/\bmake\s+sure\s+(?:that\s+)?(?:you\s+(?:guys\s+)?)?/gi, 'Ensure ')
    .replace(/\bensure\s+that\s+/gi, 'Ensure ')
    .replace(/\bplease\s+/gi, '')
    .replace(/\bjust\s+/gi, '');

  // Normalise punctuality / attendance phrasing into one clean action
  if (/\b(?:on time|not be late|cannot be late|can't be late|arrive|punctual|punctuality|early|late for\s+(?:your\s+)?shift)\b/i.test(action)) {
    // Extract any specific time offset
    const timeMatch = action.match(/(\d+)\s+minutes?\s+(?:early|before|prior)/i);
    const timeNote = timeMatch ? ` (${timeMatch[1]} minutes before shift start)` : '';
    action = `Arrive punctually for all scheduled shifts${timeNote}`;
  }

  // Clean stray artefacts
  action = action
    .replace(/\b(?:maybe|perhaps|possibly)\s+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();

  // Validate — relaxed upper limit to 150
  if (action.length < 8 || action.length > 150) return null;

  // Ensure proper casing
  action = toSentenceCase(action).replace(/[.!?;,]+$/, '');

  // Owner detection
  let owner = 'Team';
  if (/\b(?:I will|I'll|I shall|I am going to|I'm going to)\b/i.test(text)) owner = 'Manager';
  else if (/\b(?:we will|we'll|we are going to|we're going to)\b/i.test(text)) owner = 'All';
  else if (/\b(?:HR|human resources)\b/i.test(text)) owner = 'HR';

  // Deadline detection
  let deadline: string | undefined;
  const deadlineMatch = text.match(/\b(?:by|before|due(?:\s+by)?|no later than)\s+(today|tomorrow|(?:next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday)|(?:end of|by\s+end of)\s+(?:the\s+)?(?:day|week|month)|EOB|EOD|COB)\b/i);
  if (deadlineMatch) deadline = deadlineMatch[1];

  return {
    id: crypto.randomUUID(),
    action,
    owner,
    deadline,
  };
}

function extractDecision(text: string): string | null {
  if (!/\b(?:decided|agreed|resolved|concluded|approved|confirmed|determined|established|signed off)\b/i.test(text)) return null;

  let decision = text
    .replace(/^(?:it\s+was|we|I|the\s+(?:team|group|committee))\s+(?:was\s+)?(?:decided|agreed|resolved|concluded|approved|confirmed|determined|established|signed off)(?:\s+that)?\s*/i, '')
    .replace(/^(?:decision|agreement|resolution)\s*(?:is|was)\s*/i, '')
    .trim();

  if (decision.length < 8 || decision.length > 150) return null;

  return toSentenceCase(decision.replace(/[.!?;,]+$/, '')) + '.';
}

function createDiscussionPoint(text: string): string | null {
  if (text.length < 15) return null;

  let point = text;

  // Strip leading incomplete openers
  point = point.replace(/^(?:in one of|one of|some of|the\s+fact\s+that|a\s+key\s+point\s+is)\s+/i, '');

  // Neutralise first-person into professional third-person summaries
  point = point
    .replace(/\b(?:we|I)\s+(?:need to touch on|touched on|discussed|talked about|went over|looked at|reviewed|addressed)\b/gi, 'Discussion covered')
    .replace(/\b(?:we|I)\s+(?:noted|mentioned|raised|brought up|highlighted|flagged)\b/gi, 'Noted:')
    .replace(/\b(?:we|I)\s+(?:explained|clarified|walked through|went through)\b/gi, 'Clarified:')
    .replace(/\b(?:we|I)\s+(?:agreed|concurred|decided)\b/gi, 'Consensus reached:')
    .replace(/\b(?:we|I)\s+(?:emphasized|stressed|underlined|underscored)\b/gi, 'Emphasised:')
    .replace(/\b(?:we|I)\s+(?:identified|recognised|spotted)\b/gi, 'Identified:')
    .replace(/\bimproving\s+sales\s+(?:in|for|at)\b/gi, 'Sales improvement discussed for')
    .replace(/\bthis\s+is\s+(?:the\s+)?(?:most important|critical|key|main|primary|top)\s+(?:thing|priority|issue|concern)\b/gi, 'Identified as a top priority');

  // Strip trailing noise
  point = point
    .replace(/\s+(?:this\s+is\s+(?:the\s+)?(?:most important|critical|key)).*/i, '')
    .replace(/\s+if\s+(?:you|we)\s+(?:want|need|like).*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Relaxed length range — allow up to 160 chars
  if (point.length < 15 || point.length > 160) return null;

  // Reject if still ends with a dangling preposition
  if (/\b(that|which|who|when|where|what|how|if|because|for|to|in|on|at|with|by)\s*$/i.test(point)) return null;

  point = toSentenceCase(point);
  if (!/[.!?]$/.test(point)) point += '.';

  return point;
}

// ============================================================================
// TOPIC DETECTION
// ============================================================================

function detectTopic(text: string): string {
  const lower = text.toLowerCase();

  if (/\b(?:sales|revenue|profit|target|client|customer|business development|pipeline|upsell|cross.?sell|quota)\b/.test(lower)) return 'Sales & Business Development';
  if (/\b(?:shift|schedule|attendance|punctual|late|timekeeping|roster|on time|arrive|early|absence|time off|rota)\b/.test(lower)) return 'Attendance & Scheduling';
  if (/\b(?:performance|review|development|career|progress|appraisal|assessment|kpi|objective|goal)\b/.test(lower)) return 'Performance & Development';
  if (/\b(?:budget|cost|financial|expense|spend|cash flow|invoice|money|profit|margin|forecast|p&l)\b/.test(lower)) return 'Finance';
  if (/\b(?:project|deadline|delivery|milestone|timeline|sprint|launch|rollout)\b/.test(lower)) return 'Projects & Delivery';
  if (/\b(?:complaint|feedback|service|customer experience|guest|visitor|satisfaction|nps)\b/.test(lower)) return 'Customer Service';
  if (/\b(?:safety|compliance|risk|security|health|hazard|policy|gdpr|regulation|audit)\b/.test(lower)) return 'Safety & Compliance';
  if (/\b(?:food|beverage|menu|kitchen|bar|drink|hospitality|venue|event)\b/.test(lower)) return 'Food & Beverage / Events';
  if (/\b(?:staff|hiring|recruitment|vacancy|turnover|onboard|induction|headcount)\b/.test(lower)) return 'Staffing & HR';
  if (/\b(?:operation|process|procedure|system|workflow|tool|platform|software|tech)\b/.test(lower)) return 'Operations & Technology';
  if (/\b(?:marketing|brand|campaign|social media|advertising|promotion|pr)\b/.test(lower)) return 'Marketing & Communications';

  return 'General Matters';
}

// ============================================================================
// CONSOLIDATION
// ============================================================================

function consolidateKeyPoints(keyPoints: Map<string, string[]>): Map<string, string[]> {
  const consolidated = new Map<string, string[]>();

  for (const [topic, points] of keyPoints) {
    const unique: string[] = [];
    for (const point of points) {
      const isDup = unique.some(existing => calculateSimilarity(existing, point) > 0.65);
      if (!isDup) unique.push(point);
    }
    if (unique.length > 0) consolidated.set(topic, unique);
  }

  return consolidated;
}

function mergeAndConsolidateActions(existing: ActionItem[], parsed: ActionItem[]): ActionItem[] {
  const merged = [...existing];

  for (const pa of parsed) {
    const isDup = merged.some(
      ex =>
        calculateSimilarity(ex.action, pa.action) > 0.72 ||
        ex.action.toLowerCase().startsWith(pa.action.toLowerCase().substring(0, 25))
    );
    if (!isDup) merged.push(pa);
  }

  return merged;
}

function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1.0;

  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatAttendees(attendees: Attendee[], _type: MeetingType): string {
  if (attendees.length === 0) return '_No attendees recorded._';

  const rolePriority: Record<string, number> = {
    Chair: 1, Investigator: 1, Manager: 2, HR: 3,
    Employee: 4, 'Note-taker': 5, Witness: 6, Companion: 7,
  };

  return [...attendees]
    .sort((a, b) => (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99))
    .map(a => `- **${a.name}** – ${a.role}`)
    .join('\n');
}

function formatKeyPoints(keyPoints: Map<string, string[]>): string {
  if (keyPoints.size === 0) return '_No discussion points recorded._';

  return Array.from(keyPoints.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([, points]) => points.length > 0)
    .map(([topic, points]) => `**${topic}**\n${points.map(p => `- ${p}`).join('\n')}`)
    .join('\n\n');
}

function formatDecisions(decisions: string[]): string {
  if (decisions.length === 0) return '_No formal decisions recorded._';
  return decisions.map(d => `- ${d}`).join('\n');
}

function formatActionsTable(actions: ActionItem[]): string {
  if (actions.length === 0) {
    return '| Action | Owner | Deadline |\n|:-------|:-----:|:---------|\n| _No actions recorded_ | - | - |';
  }

  const rows = actions.map(a => {
    let action = a.action.replace(/\|/g, '/');
    if (action.length > 70) action = action.substring(0, 67) + '...';
    return `| ${action} | ${a.owner} | ${a.deadline || 'TBC'} |`;
  });

  return ['| Action | Owner | Deadline |', '|:-------|:-----:|:---------|', ...rows].join('\n');
}

function formatNextSteps(type: MeetingType, actions: ActionItem[]): string {
  const steps: string[] = [];

  if (actions.length > 0) {
    steps.push(`- Complete ${actions.length} action item${actions.length !== 1 ? 's' : ''} listed above`);
  }

  if (type === 'disciplinary') {
    steps.push('- HR to process formal documentation within 48 hours');
    steps.push('- Written outcome to be issued within 5 working days');
    steps.push('- Employee rights to appeal to be confirmed in writing');
  } else if (type === 'investigation') {
    steps.push('- Investigation findings to be compiled');
    steps.push('- Decision on next steps within 10 working days');
  } else if (type === '1:1') {
    steps.push('- Next 1:1 to be scheduled per regular cadence');
    steps.push('- Development actions to be reviewed at next session');
  } else if (type === 'team') {
    steps.push('- Action progress to be reviewed at next team meeting');
  }

  steps.push('- Minutes to be circulated to all attendees within 24 hours');

  return steps.join('\n');
}

function generateExecutiveSummary(
  keyPoints: Map<string, string[]>,
  actions: ActionItem[],
  title: string,
  type: MeetingType
): string {
  const topicCount = keyPoints.size;
  const actionCount = actions.length;
  const topics = Array.from(keyPoints.keys()).join(', ');

  let summary = `**${title}** – `;

  if (topicCount > 0) {
    summary += `${topicCount} topic area${topicCount !== 1 ? 's' : ''} covered`;
    if (topics) summary += ` (${topics})`;
  } else {
    summary += 'Meeting held';
  }

  if (actionCount > 0) {
    summary += `. ${actionCount} action item${actionCount !== 1 ? 's' : ''} assigned.`;
  } else {
    summary += '. No actions assigned.';
  }

  if (type === 'disciplinary') summary += ' *Formal disciplinary hearing – HR records apply.*';
  if (type === 'investigation') summary += ' *Formal investigation meeting – HR records apply.*';

  return summary;
}

function generateHRAddendum(type: MeetingType, consentConfirmed: boolean): string {
  if (type === 'disciplinary') {
    return `

## HR Documentation

**Allegations:** Presented to employee and response recorded.
**Evidence:** Reviewed and acknowledged by employee.
**Mitigation:** ${consentConfirmed ? 'Employee provided response and mitigation.' : 'Pending employee response.'}
**Outcome:** To be confirmed in writing within 5 working days.
**Appeal Rights:** Employee has 5 working days from written confirmation date to lodge an appeal.`;
  }

  if (type === 'investigation') {
    return `

## HR Documentation

**Investigation Scope:** Parameters explained to employee.
**Evidence:** Supporting documents reviewed during meeting.
**Employee Response:** ${consentConfirmed ? 'Cooperation provided.' : 'Pending.'}
**Next Steps:** Findings to be compiled; outcome communicated within 10 working days.`;
  }

  return '';
}

// ============================================================================
// UTILITIES
// ============================================================================

function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

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
    '1:1': '1:1 Meeting',
    team: 'Team Meeting',
    disciplinary: 'Disciplinary Hearing',
    investigation: 'Investigation Meeting',
  };
  return labels[type] ?? type;
}

function formatMeetingTypeHeader(type: MeetingType): string {
  const headers: Record<MeetingType, string> = {
    '1:1': '1:1 MEETING',
    team: 'TEAM MEETING',
    disciplinary: 'DISCIPLINARY HEARING',
    investigation: 'INVESTIGATION MEETING',
  };
  return headers[type] ?? type.toUpperCase();
}

function getConfidentialityLevel(type: MeetingType): string {
  if (type === 'disciplinary' || type === 'investigation') return 'CONFIDENTIAL - HR Records';
  if (type === '1:1') return 'CONFIDENTIAL - Management';
  return 'Internal';
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
