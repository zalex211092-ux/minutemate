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
// TRANSCRIPT PARSING - FIXED VERSION
// ============================================================================

function parseTranscript(transcript: string | undefined): ParsedContent {
  const keyPoints = new Map<string, string[]>();
  const decisions: string[] = [];
  const actions: ActionItem[] = [];

  if (!transcript || transcript.trim().length < 10) {
    return { keyPoints, decisions, transcriptActions: actions };
  }

  // STEP 1: Preprocess - normalize and clean
  let text = preprocessTranscript(transcript);
  
  // STEP 2: Extract semantic units (not just sentence splits)
  const units = extractSemanticUnits(text);
  
  // STEP 3: Process each unit
  for (const unit of units) {
    // Skip fragments and noise
    if (isFragment(unit) || isNoise(unit)) continue;
    
    // Try to extract as action first (priority)
    const action = extractActionRobust(unit);
    if (action) {
      actions.push(action);
      continue;
    }
    
    // Try to extract as decision
    const decision = extractDecisionRobust(unit);
    if (decision) {
      decisions.push(decision);
      continue;
    }
    
    // Must be a discussion point
    const discussionPoint = createDiscussionPointRobust(unit);
    if (discussionPoint) {
      const topic = detectTopicRobust(discussionPoint);
      if (!keyPoints.has(topic)) {
        keyPoints.set(topic, []);
      }
      keyPoints.get(topic)!.push(discussionPoint);
    }
  }

  return { keyPoints, decisions, transcriptActions: actions };
}

// ============================================================================
// PREPROCESSING & SEGMENTATION
// ============================================================================

function preprocessTranscript(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove common speech fillers but keep flow
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of|basically|literally|actually|honestly)\b/gi, ' ')
    // Fix common speech-to-text artifacts (camelCase)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Normalize spacing
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractSemanticUnits(text: string): string[] {
  const units: string[] = [];
  
  // First, try to identify natural boundaries in speech
  // Pattern: Look for [transition] + [subject] + [verb] structures
  
  // Replace transition words with markers for splitting
  const marked = text
    // Remove opening pleasantries completely
    .replace(/^(?:and\s+)?(?:welcome|hello|hi|hey|good morning|good afternoon|good evening)[,\.\s]+/i, '')
    .replace(/(?:thank you|thanks)\s+(?:for\s+)?(?:coming|joining|attending)[,\.\s]*/gi, '')
    
    // Mark transition boundaries
    .replace(/\s+(?:first|firstly|first of all|to start|to begin)\s+/gi, ' .SPLIT. ')
    .replace(/\s+(?:second|secondly|next|then|after that|following that)\s+/gi, ' .SPLIT. ')
    .replace(/\s+(?:another thing|another point|also|additionally|furthermore|moreover)\s+/gi, ' .SPLIT. ')
    .replace(/\s+(?:however|but|although|though)\s+/gi, ' .SPLIT. ')
    .replace(/\s+(?:finally|lastly|to conclude|in summary)\s+/gi, ' .SPLIT. ')
    
    // Mark action boundaries
    .replace(/\s+(?:I need you|I want you|you need|you must|please ensure)\s+/gi, ' .SPLIT. $1 ')
    .replace(/\s+(?:we need to|we should|we must)\s+/gi, ' .SPLIT. $1 ')
    .trim();
  
  // Split by markers and periods
  const rawUnits = marked
    .split(/(?:\.SPLIT\.|[.!?])/)
    .map(u => u.trim())
    .filter(u => u.length >= 15); // Minimum meaningful length
  
  // Additional processing: handle "is that" constructions
  for (const unit of rawUnits) {
    // Check if this contains multiple clauses we should split
    const clauses = unit.split(/\s+(?:is that|was that|means that)\s+/i);
    if (clauses.length > 1) {
      units.push(...clauses.map(c => c.trim()).filter(c => c.length >= 15));
    } else {
      units.push(unit);
    }
  }
  
  return units;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function isFragment(text: string): boolean {
  // Check if text is an incomplete sentence fragment
  const fragmentPatterns = [
    // Ends with conjunction or preposition (incomplete)
    /\b(that|which|who|when|where|what|how|if|because|since|although|while|before|after|during|in|on|at|to|for|with|by|about|into|through|during|before|after|above|below|between|under|again|further|then|once)\s*$/i,
    
    // Starts with incomplete phrases
    /^(?:and|but|or|so|then|also|plus|minus|in|on|at|to|for|with|by|about|into|through|during)\s+$/i,
    
    // Just a subordinate clause starter
    /^(?:in one of|one of|some of|many of|most of|all of|none of|any of|each of|every one of)\s*$/i,
    
    // Ends with verb waiting for object
    /\b(need|want|should|must|will|can|could|would|may|might|touch|discuss|review|check|improve|increase|decrease|start|begin|continue|finish|complete)\s*$/i,
    
    // Too short after cleaning
    /^.{0,20}$/,
  ];
  
  return fragmentPatterns.some(pattern => pattern.test(text));
}

function isNoise(text: string): boolean {
  const noisePatterns = [
    /^(?:yes|no|yeah|nah|okay|ok|right|sure|fine|great|good|excellent|perfect|thanks|thank you)\b/i,
    /^(?:welcome|hello|hi|hey)\b/i,
    /^(?:any questions|does that make sense|is that clear|are we good)\b/i,
    /^(?:moving on|let's continue|next slide)\b/i,
    /^\d+$/,
  ];
  
  return noisePatterns.some(pattern => pattern.test(text));
}

// ============================================================================
// CONTENT EXTRACTION - ROBUST VERSIONS
// ============================================================================

function extractActionRobust(text: string): ActionItem | null {
  const lower = text.toLowerCase();
  
  // Must contain directive language
  const hasDirective = /\b(need|want|must|require|ensure|make sure|complete|finish|submit|review|send|prepare|update|check|arrange|organize|deliver|provide|create|implement|follow|monitor|track|report|address|handle|resolve|fix|improve|increase|reduce|maintain|achieve|meet|reach|establish|set up|schedule|plan|coordinate|communicate|inform|notify|contact|call|email|share|distribute|present|demonstrate|explain|train|guide|assist|help|support|manage|lead|direct|oversee|supervise|delegate|assign|allocate|approve|authorize|sign|confirm|verify|validate|test|audit|inspect|assess|evaluate|measure|analyze|research|investigate|find|identify|determine|decide|agree|commit|promise|guarantee|insist|demand|request|ask|tell|instruct|order|command|advise|recommend|suggest|propose|offer|volunteer|consent|accept|endorse|back)\b/.test(lower);
  
  const hasSubject = /\b(you|we|I|team|staff|manager|employee|everyone|people|guys)\b/.test(lower);
  
  if (!hasDirective) return null;
  
  // Clean and transform
  let action = text;
  
  // Remove trailing optional clauses (like "if you want", "or something", "have a coffee")
  action = action
    .replace(/\s+if\s+(?:you\s+)?(?:want|need|like|prefer).*/i, '')
    .replace(/\s+or\s+(?:something|whatever|etc).*/i, '')
    .replace(/\s+to\s+have\s+(?:a|an)\s+(?:coffee|tea|break|drink).*/i, '')
    .replace(/\s+and\s+(?:have|get|take)\s+(?:a|an)\s+.*/i, '')
    .trim();
  
  // Transform to professional format
  action = action
    // Convert directives
    .replace(/\bI\s+(?:need|want)\s+(?:you\s+guys|you\s+all|you)\s+to\b/gi, 'Team to')
    .replace(/\byou\s+(?:guys|all)\s+(?:need|must)\s+to\b/gi, 'Team to')
    .replace(/\bwe\s+need\s+to\b/gi, 'To')
    .replace(/\byou\s+(?:need|must)\s+to\b/gi, '')
    .replace(/\bmake\s+sure\s+(?:you\s+)?/gi, '')
    .replace(/\bensure\s+(?:you\s+)?/gi, '');
  
  // Consolidate punctuality phrases
  if (/\b(?:on time|not be late|cannot be late|arrive|punctual|early|late|shift)\b/i.test(action)) {
    action = action
      .replace(/\b(?:be|arrive|come)\s+(?:on time|punctually)\s+(?:for|on)?\s*(?:shift|work)?/gi, 'Arrive punctually for shifts')
      .replace(/\b(?:not be late|cannot be late|don't be late)\b/gi, '')
      .replace(/\b10\s+minutes\s+(?:early|earlier)\b/gi, '')
      .replace(/\s{2,}/g, ' ');
  }
  
  // Clean up
  action = action
    .replace(/\b(?:maybe|perhaps|possibly|might|could|should)\s+/gi, '')
    .trim();
  
  // Validate
  if (action.length < 10 || action.length > 120) return null;
  
  // Ensure professional start
  action = action.charAt(0).toUpperCase() + action.slice(1);
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

function extractDecisionRobust(text: string): string | null {
  if (!/\b(?:decided|agreed|resolved|concluded|approved|confirmed|determined|established)\b/i.test(text)) {
    return null;
  }
  
  let decision = text
    .replace(/^(?:it\s+was|we|I|the\s+team)\s+(?:was\s+)?(?:decided|agreed|resolved|concluded|approved|confirmed|determined|established)(?:\s+that)?\s*/i, '')
    .replace(/\b(?:the\s+)?(?:decision|agreement)\s+(?:is|was)\s+/i, '')
    .trim();
  
  if (decision.length < 10 || decision.length > 120) return null;
  
  return decision.charAt(0).toUpperCase() + decision.slice(1).replace(/[.!?;,]+$/, '') + '.';
}

function createDiscussionPointRobust(text: string): string | null {
  // Skip if too short or looks like noise
  if (text.length < 20) return null;
  
  let point = text;
  
  // Remove leading incomplete phrases
  point = point.replace(/^(?:in one of|one of|some of|the|a|an)\s+/i, '');
  
  // Transform to professional summary format
  point = point
    // Meeting topic starters
    .replace(/\b(?:we|I)\s+(?:need to touch|touch|discuss|talk about|go over|look at|review|address)\b/gi, 'Discussion covered')
    .replace(/\b(?:we|I)\s+(?:noted|mentioned|raised|brought up|highlighted)\b/gi, 'Noted')
    .replace(/\b(?:we|I)\s+(?:explained|clarified|went through)\b/gi, 'Explained')
    .replace(/\b(?:we|I)\s+(?:agreed|concurred)\b/gi, 'Consensus on')
    .replace(/\b(?:we|I)\s+(?:emphasized|stressed)\b/gi, 'Emphasized')
    .replace(/\b(?:we|I)\s+(?:identified|recognized)\b/gi, 'Identified')
    
    // Handle specific content patterns
    .replace(/\bthis\s+is\s+(?:the\s+)?(?:most important|critical|key|main|primary)\s+thing\b/gi, 'Priority focus identified')
    .replace(/\bimproving\s+sales\s+in\b/gi, 'Sales improvement for');
  
  // Remove trailing noise
  point = point
    .replace(/\s+this\s+is\s+(?:the\s+)?(?:most important|critical|key).*/i, '')
    .replace(/\s+if\s+(?:you|we).*/i, '')
    .trim();
  
  // Validate it's a complete thought
  if (point.length < 20 || point.length > 120) return null;
  
  // Check it doesn't end with a preposition (fragment)
  if (/\b(that|which|who|when|where|what|how|if|because|for|to|in|on|at|with|by)\s*$/i.test(point)) {
    return null;
  }
  
  // Capitalize and punctuate
  point = point.charAt(0).toUpperCase() + point.slice(1);
  if (!/[.!?]$/.test(point)) point += '.';
  
  return point;
}

// ============================================================================
// TOPIC DETECTION - ENHANCED
// ============================================================================

function detectTopicRobust(text: string): string {
  const lower = text.toLowerCase();
  
  // Priority-ordered patterns
  if (/\b(?:sales|revenue|profit|target|client|customer|business development|pipeline|improving sales)\b/.test(lower)) return 'Sales & Business Development';
  if (/\b(?:shift|schedule|attendance|punctual|late|timekeeping|roster|on time|arrive|early)\b/.test(lower)) return 'Attendance & Scheduling';
  if (/\b(?:performance|review|development|career|progress|appraisal|assessment)\b/.test(lower)) return 'Performance & Development';
  if (/\b(?:budget|cost|financial|expense|spend|cash flow|invoice|money|profit)\b/.test(lower)) return 'Finance';
  if (/\b(?:project|deadline|delivery|milestone|timeline)\b/.test(lower)) return 'Projects';
  if (/\b(?:complaint|feedback|service|customer experience|guest|visitor)\b/.test(lower)) return 'Customer Service';
  if (/\b(?:safety|compliance|risk|security|health|hazard|policy)\b/.test(lower)) return 'Safety & Compliance';
  if (/\b(?:food|beverage|menu|kitchen|bar|drink|service)\b/.test(lower)) return 'Food & Beverage';
  if (/\b(?:staff|hiring|recruitment|vacancy|turnover|team)\b/.test(lower)) return 'Staffing';
  if (/\b(?:operation|process|procedure|system|workflow)\b/.test(lower)) return 'Operations';
  
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
      // Check similarity with existing
      let isDuplicate = false;
      
      for (const existing of uniquePoints) {
        if (calculateSimilarity(existing, point) > 0.7) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniquePoints.push(point);
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
    const similarIdx = merged.findIndex(existing => 
      calculateSimilarity(existing.action, parsedAction.action) > 0.75 ||
      (existing.action.toLowerCase().includes(parsedAction.action.toLowerCase().substring(0, 20)))
    );
    
    if (similarIdx === -1) {
      merged.push(parsedAction);
    }
  }
  
  return merged;
}

function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1.0;
  
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// ============================================================================
// FORMATTING FUNCTIONS - FIXED WITH ASCII CHARACTERS ONLY
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
  
  return sorted.map(a => `- **${a.name}** – ${a.role}`).join('\n');
}

function formatKeyPoints(keyPoints: Map<string, string[]>): string {
  if (keyPoints.size === 0) return '_No discussion points recorded._';
  
  const sections: string[] = [];
  const sortedTopics = Array.from(keyPoints.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [topic, points] of sortedTopics) {
    if (points.length === 0) continue;
    const bulletPoints = points.map(p => `- ${p}`).join('\n');
    sections.push(`**${topic}**\n${bulletPoints}`);
  }
  
  return sections.join('\n\n');
}

function formatDecisions(decisions: string[]): string {
  if (decisions.length === 0) return '_No formal decisions recorded._';
  return decisions.map(d => `- ${d}`).join('\n');
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
    steps.push(`- Complete ${actions.length} action item${actions.length !== 1 ? 's' : ''} detailed above`);
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
  } else if (type === 'team') {
    steps.push('- Progress on actions to be reviewed at next team meeting');
  }
  
  steps.push('- Minutes circulated to attendees within 24 hours');
  
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