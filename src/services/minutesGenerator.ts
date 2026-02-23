import type { Meeting, MeetingType, Attendee, ActionItem } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  return generateStructuredMinutes(meeting);
}

interface ParsedContent {
  keyPoints: Map<string, string[]>;
  decisions: string[];
  transcriptActions: ActionItem[];
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

function generateStructuredMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText, actions: existingActions } = meeting;
  
  // Parse the transcript
  const { keyPoints, decisions, transcriptActions } = parseTranscript(transcriptText);
  
  // Merge with existing actions
  const allActions = mergeAndConsolidateActions(existingActions, transcriptActions);
  
  // Consolidate similar key points
  const consolidatedKeyPoints = consolidateKeyPoints(keyPoints);
  
  // Format sections
  const attendeesSection = formatAttendees(attendees, type);
  const keyPointsSection = formatKeyPoints(consolidatedKeyPoints);
  const decisionsSection = formatDecisions(decisions);
  const actionsTable = formatActionsTable(allActions);
  const nextSteps = formatNextSteps(type, allActions);

  return `# ${formatMeetingTypeHeader(type)} MINUTES

${generateExecutiveSummary(consolidatedKeyPoints, allActions, title, type)}

## Meeting Information

| Field | Details |
|:------|:--------|
| **Date** | ${formatDate(date)} |
| **Time** | ${startTime} |
| **Type** | ${formatMeetingType(type)} |
| ${type === 'disciplinary' || type === 'investigation' ? '**Location**' : '**Venue**'} | ${location || 'Not stated'} |
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
${(type === 'disciplinary' || type === 'investigation') ? generateHRAddendum(type, meeting.consentConfirmed) : ''}

---
*Document prepared by MinuteMate | ${getConfidentialityLevel(type)} | Generated: ${new Date().toLocaleDateString('en-GB')}*
`;
}

// ============================================================================
// TRANSCRIPT PARSING - ROBUST VERSION
// ============================================================================

function parseTranscript(transcript: string | undefined): ParsedContent {
  const keyPoints = new Map<string, string[]>();
  const decisions: string[] = [];
  const actions: ActionItem[] = [];

  if (!transcript || transcript.trim().length < 5) {
    return { keyPoints, decisions, transcriptActions: actions };
  }

  // STEP 1: Smart text segmentation for unpunctuated speech
  let text = transcript;
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // STEP 2: Clean filler words but preserve meaning
  text = cleanFillerWords(text);
  
  // STEP 3: Add punctuation boundaries for run-on speech
  text = addSentenceBoundaries(text);
  
  // STEP 4: Split into units (sentences or intent phrases)
  const units = splitIntoUnits(text);
  
  // STEP 5: Process each unit
  for (const unit of units) {
    const cleaned = unit.trim();
    if (cleaned.length < 8) continue; // Too short to be meaningful
    
    // Try to extract as action first
    const action = extractActionSmart(cleaned);
    if (action) {
      actions.push(action);
      continue;
    }
    
    // Try to extract as decision
    const decision = extractDecisionSmart(cleaned);
    if (decision) {
      decisions.push(decision);
      continue;
    }
    
    // Must be a discussion point
    const discussionPoint = createDiscussionPoint(cleaned);
    if (discussionPoint) {
      const topic = detectTopic(discussionPoint);
      if (!keyPoints.has(topic)) {
        keyPoints.set(topic, []);
      }
      keyPoints.get(topic)!.push(discussionPoint);
    }
  }

  return { keyPoints, decisions, transcriptActions: actions };
}

// ============================================================================
// TEXT CLEANING & SEGMENTATION
// ============================================================================

function cleanFillerWords(text: string): string {
  // Remove filler words but keep sentence flow
  return text
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally|actually|honestly|right|okay|ok|well)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function addSentenceBoundaries(text: string): string {
  // Convert speech transitions to sentence breaks
  return text
    // Greetings and openings
    .replace(/^(?:hello|hi|hey|welcome|good morning|good afternoon|good evening)[,\.\s]+/i, '')
    .replace(/(?:thank you|thanks)\s+(?:for\s+)?(?:coming|joining|attending)[,\.\s]*/gi, '. ')
    
    // Transition words/phrases → period
    .replace(/\s+first\s+point\s+is\s*/gi, '. ')
    .replace(/\s+first\s+of\s+all\s*/gi, '. ')
    .replace(/\s+also\s+/gi, '. ')
    .replace(/\s+additionally\s+/gi, '. ')
    .replace(/\s+furthermore\s+/gi, '. ')
    .replace(/\s+moreover\s+/gi, '. ')
    .replace(/\s+however\s+/gi, '. ')
    .replace(/\s+that\s+said\s*/gi, '. ')
    .replace(/\s+on\s+the\s+other\s+hand\s*/gi, '. ')
    .replace(/\s+in\s+addition\s+/gi, '. ')
    .replace(/\s+another\s+point\s+/gi, '. ')
    .replace(/\s+next\s+/gi, '. ')
    .replace(/\s+moving\s+on\s*/gi, '. ')
    .replace(/\s+finally\s+/gi, '. ')
    .replace(/\s+lastly\s+/gi, '. ')
    .replace(/\s+and\s+then\s+/gi, '. ')
    .replace(/\s+so\s+/gi, '. ')
    .replace(/\s+but\s+/gi, '. ')
    
    // Action indicators → period before them
    .replace(/\s+I\s+need\s+you\s+/gi, '. ')
    .replace(/\s+I\s+want\s+you\s+/gi, '. ')
    .replace(/\s+we\s+need\s+to\s+/gi, '. ')
    .replace(/\s+you\s+need\s+to\s+/gi, '. ')
    
    // Decision indicators
    .replace(/\s+it\s+was\s+(?:decided|agreed|resolved)\s*/gi, '. ')
    .replace(/\s+we\s+(?:decided|agreed|resolved)\s*/gi, '. ')
    
    // CamelCase fix for speech-to-text artifacts
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    
    // Ensure spaces after periods
    .replace(/\.\s*/g, '. ')
    .trim();
}

function splitIntoUnits(text: string): string[] {
  // Split by sentence endings or logical breaks
  const units = text
    .split(/[.!?]+/)
    .map(u => u.trim())
    .filter(u => u.length >= 8);
  
  // If no splits occurred (no punctuation), try splitting by conjunctions
  if (units.length <= 1 && text.length > 50) {
    return text
      .split(/\s+(?:and|but|also)\s+/i)
      .map(u => u.trim())
      .filter(u => u.length >= 8);
  }
  
  return units;
}

// ============================================================================
// CONTENT EXTRACTION - SMART VERSIONS
// ============================================================================

function extractActionSmart(text: string): ActionItem | null {
  const lower = text.toLowerCase();
  
  // Must have action indicators
  const hasActionVerb = /\b(need|want|must|require|ensure|make sure|complete|finish|submit|review|send|prepare|update|check|arrange|organize|deliver|provide|create|implement|follow|monitor|track|report|address|handle|resolve|fix|improve|increase|reduce|maintain|achieve|meet|reach|establish|set up|schedule|plan|coordinate|communicate|inform|notify|contact|call|email|share|distribute|present|demonstrate|explain|train|guide|assist|help|support|manage|lead|direct|oversee|supervise|delegate|assign|allocate|approve|authorize|sign|confirm|verify|validate|test|audit|inspect|assess|evaluate|measure|analyze|research|investigate|find|identify|determine)\b/.test(lower);
  
  const hasSubject = /\b(you|we|I|team|staff|manager|employee|everyone)\b/.test(lower);
  
  if (!hasActionVerb) return null;
  
  // Transform to professional action
  let action = text;
  
  // Remove leading connectors
  action = action.replace(/^(?:and|so|but|then)\s+/i, '');
  
  // Transform directive phrases
  action = action
    .replace(/\bI\s+(?:need|want)\s+(?:you\s+guys|you\s+all|you)\s+to\b/gi, 'Team to')
    .replace(/\bwe\s+need\s+to\b/gi, 'To')
    .replace(/\byou\s+(?:need|must)\s+to\b/gi, '')
    .replace(/\bmake\s+sure\s+(?:you\s+)?/gi, '')
    .replace(/\bensure\s+(?:you\s+)?/gi, '');
  
  // Clean up remaining pronouns
  action = action.replace(/\byou guys\b/gi, 'Team');
  action = action.replace(/\byou\b/gi, 'Team');
  
  // Consolidate punctuality phrases
  if (/\b(?:on time|not be late|cannot be late|arrive early|come early|punctual)\b/i.test(action)) {
    action = action
      .replace(/\b(?:be|arrive|come)\s+(?:on time|punctually|early)\b/gi, 'arrive punctually')
      .replace(/\b(?:not be late|cannot be late|don't be late)\b/gi, '')
      .replace(/\b10\s+minutes\s+(?:early|earlier)\b/gi, '')
      .replace(/\s{2,}/g, ' ');
  }
  
  // Clean up filler endings
  action = action.replace(/\s+(?:or something|or whatever|etc|so on|maybe).*$/i, '');
  
  action = action.trim();
  
  // Validate
  if (action.length < 10 || action.length > 120) return null;
  
  // Capitalize first letter
  action = action.charAt(0).toUpperCase() + action.slice(1);
  
  // Ensure it ends with period (no, actions don't end with periods in tables usually, but for completeness)
  action = action.replace(/[.!?;,]+$/, '');
  
  // Determine owner
  let owner = 'Team';
  if (/\b(?:I will|I'll|I shall)\b/i.test(text)) owner = 'Manager';
  else if (/\b(?:we will|we'll)\b/i.test(text)) owner = 'All';
  
  // Extract deadline
  let deadline: string | undefined;
  const deadlineMatch = text.match(/\b(?:by|before|due|for)\s+(tomorrow|today|next week|Monday|Tuesday|Wednesday|Thursday|Friday|the end of the week|EOB|EOD)\b/i);
  if (deadlineMatch) deadline = deadlineMatch[1];
  
  return {
    id: crypto.randomUUID(),
    action,
    owner,
    deadline
  };
}

function extractDecisionSmart(text: string): string | null {
  if (!/\b(?:decided|agreed|resolved|concluded|approved|confirmed|determined)\b/i.test(text)) {
    return null;
  }
  
  let decision = text
    .replace(/^(?:it\s+was|we|I|the\s+team)\s+(?:was\s+)?(?:decided|agreed|resolved|concluded|approved|confirmed|determined)(?:\s+that)?\s*/i, '')
    .replace(/\b(?:the\s+)?(?:decision|agreement)\s+(?:is|was)\s+/i, '')
    .trim();
  
  if (decision.length < 10 || decision.length > 120) return null;
  
  return decision.charAt(0).toUpperCase() + decision.slice(1).replace(/[.!?;,]+$/, '') + '.';
}

function createDiscussionPoint(text: string): string | null {
  // Skip obvious noise
  if (/^(?:welcome|hello|hi|hey|thanks|okay|so|well|and|the)\b/i.test(text)) return null;
  if (text.length < 15) return null;
  
  let point = text;
  
  // Transform discussion phrases to summary format
  point = point
    .replace(/\b(?:we|I)\s+(?:discussed|talked about|went over|looked at|touched base on)\b/gi, 'Discussion covered')
    .replace(/\b(?:we|I)\s+(?:need to discuss|should discuss)\b/gi, 'Discussion required on')
    .replace(/\b(?:we|I)\s+noted\b/gi, 'Noted')
    .replace(/\b(?:we|I)\s+mentioned\b/gi, 'Raised')
    .replace(/\b(?:we|I)\s+explained\b/gi, 'Explained')
    .replace(/\bsales\s+of\b/gi, 'sales performance for');
  
  // Remove rambling endings
  point = point.replace(/\s+(?:or something|or whatever|etc|and so on).*$/i, '');
  
  point = point.trim();
  
  if (point.length < 15 || point.length > 120) return null;
  
  // Ensure it starts with a capital
  point = point.charAt(0).toUpperCase() + point.slice(1);
  
  // Ensure it ends with period
  if (!/[.!?]$/.test(point)) point += '.';
  
  return point;
}

// ============================================================================
// TOPIC DETECTION
// ============================================================================

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  
  const topics = [
    { pattern: /\b(?:sales|revenue|profit|target|client|customer|business development|pipeline|increase sales|bar sales)\b/, topic: 'Sales & Business Development' },
    { pattern: /\b(?:shift|schedule|attendance|punctual|late|timekeeping|roster|on time|on shift|arrive|come early)\b/, topic: 'Attendance & Scheduling' },
    { pattern: /\b(?:budget|cost|financial|expense|spend|cash flow|invoice|money)\b/, topic: 'Finance' },
    { pattern: /\b(?:performance|review|training|development|career|progress|appraisal)\b/, topic: 'Performance & Development' },
    { pattern: /\b(?:project|deadline|delivery|milestone|timeline)\b/, topic: 'Projects' },
    { pattern: /\b(?:complaint|feedback|service|customer experience|guest)\b/, topic: 'Customer Service' },
    { pattern: /\b(?:safety|compliance|risk|security|health|hazard)\b/, topic: 'Safety & Compliance' },
    { pattern: /\b(?:operation|process|procedure|system|workflow)\b/, topic: 'Operations' },
    { pattern: /\b(?:food|beverage|menu|kitchen|bar|drink)\b/, topic: 'Food & Beverage' },
    { pattern: /\b(?:staff|hiring|recruitment|vacancy|turnover)\b/, topic: 'Staffing' },
  ];
  
  for (const { pattern, topic } of topics) {
    if (pattern.test(lower)) return topic;
  }
  
  return 'General Matters';
}

// ============================================================================
// CONSOLIDATION LOGIC
// ============================================================================

function consolidateKeyPoints(keyPoints: Map<string, string[]>): Map<string, string[]> {
  const consolidated = new Map<string, string[]>();
  
  for (const [topic, points] of keyPoints) {
    const uniquePoints: string[] = [];
    
    for (const point of points) {
      // Check if similar to existing
      const isSimilar = uniquePoints.some(existing => 
        calculateSimilarity(existing, point) > 0.75
      );
      
      if (!isSimilar) {
        uniquePoints.push(point);
      } else {
        // Merge with similar point - keep the more professional one
        const idx = uniquePoints.findIndex(existing => 
          calculateSimilarity(existing, point) > 0.75
        );
        if (idx !== -1) {
          uniquePoints[idx] = mergePoints(uniquePoints[idx], point);
        }
      }
    }
    
    if (uniquePoints.length > 0) {
      consolidated.set(topic, uniquePoints);
    }
  }
  
  return consolidated;
}

function mergeAndConsolidateActions(existing: ActionItem[], parsed: ActionItem[]): ActionItem[] {
  const merged = [...existing];
  
  for (const parsedAction of parsed) {
    // Check for similar existing action
    const similarIdx = merged.findIndex(existing => 
      calculateSimilarity(existing.action, parsedAction.action) > 0.75 ||
      (existing.action.includes(parsedAction.action.substring(0, 15)) && 
       existing.owner === parsedAction.owner)
    );
    
    if (similarIdx === -1) {
      merged.push(parsedAction);
    } else {
      // Merge - keep the more complete one
      const existing = merged[similarIdx];
      if (parsedAction.action.length > existing.action.length) {
        merged[similarIdx] = { ...parsedAction, id: existing.id };
      }
    }
  }
  
  return merged;
}

function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  // Jaccard similarity on words
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function mergePoints(p1: string, p2: string): string {
  // Return the more comprehensive one, or combine if different aspects
  if (p1.length > p2.length) return p1;
  if (p2.length > p1.length) return p2;
  return p1; // They're similar enough, keep first
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

function formatAttendees(attendees: Attendee[], type: MeetingType): string {
  if (attendees.length === 0) return '_No attendees recorded._';
  
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
  const sortedTopics = Array.from(keyPoints.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [topic, points] of sortedTopics) {
    if (points.length === 0) continue;
    const bulletPoints = points.map(p => `• ${p}`).join('\n');
    sections.push(`**${topic}**\n${bulletPoints}`);
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
    // Truncate if too long for table
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
  } else if (type === 'team') {
    steps.push('• Progress on actions to be reviewed at next team meeting');
  }
  
  steps.push('• Minutes circulated to attendees within 24 hours');
  
  return steps.join('\n');
}

function generateExecutiveSummary(keyPoints: Map<string, string[]>, actions: ActionItem[], title: string, type: MeetingType): string {
  const topicCount = keyPoints.size;
  const actionCount = actions.length;
  
  let summary = `Meeting addressed ${topicCount} topic area${topicCount !== 1 ? 's' : ''}`;
  if (actionCount > 0) summary += ` with ${actionCount} action item${actionCount !== 1 ? 's' : ''} assigned`;
  summary += `. **${title}**.`;
  
  if (type === 'disciplinary') summary += ' *Formal disciplinary hearing conducted.*';
  if (type === 'investigation') summary += ' *Investigation meeting conducted.*';
  
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
**Appeal Rights:** 5 working days from written confirmation date.`;
  }
  
  if (type === 'investigation') {
    return `

## HR Documentation

**Investigation Scope:** Parameters explained to employee.
**Evidence:** Supporting documents reviewed.
**Employee Response:** ${consentConfirmed ? 'Cooperation provided.' : 'Pending.'}
**Next Steps:** Findings to be compiled and decision communicated.`;
  }
  
  return '';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
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

// ============================================================================
// EXTRACTION FROM EXISTING MINUTES
// ============================================================================

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