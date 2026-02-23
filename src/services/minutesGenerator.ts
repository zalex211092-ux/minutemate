import type { Meeting } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  return generateStructuredMinutes(meeting);
}

function generateStructuredMinutes(meeting: Meeting): string {
  const { type, title, date, startTime, location, caseRef, attendees, transcriptText } = meeting;
  const totalAttendees = attendees.length;

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

${formatTranscriptToMinutes(transcriptText, attendees)}

## 4. Decisions Made
`;

  // Try to extract decisions from transcript
  const decisionPatterns = [
    /(?:decided|agreed|resolved|determined|concluded)(?:\s+that)?\s+([^.;]+)/gi,
    /(?:decision|resolution)\s*(?::|is|was)\s+([^.;]+)/gi,
    /(?:we|i)\s+(?:will|shall|agree to|decide to)\s+([^.;]+)/gi,
  ];

  const decisions: string[] = [];
  if (transcriptText) {
    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(transcriptText)) !== null) {
        const decision = match[1].trim();
        if (decision.length > 5 && !decisions.includes(decision)) {
          decisions.push(decision);
        }
      }
    }
  }

  if (decisions.length > 0) {
    minutes += decisions.slice(0, 5).map((d: string) => `- ${d.charAt(0).toUpperCase() + d.slice(1)}`).join('\n');
  } else {
    minutes += '- No specific decisions recorded';
  }

  minutes += `

## 5. Actions Agreed
`;

  // Try to extract actions from transcript
  const actionPatterns = [
    /(?:action|task|to do|todo)\s*(?::|is|was)?\s*([^.;]+)/gi,
    /(?:will|shall|need to|must|should)\s+([^.;]{10,100})/gi,
  ];

  const actions: { action: string; owner: string; deadline: string }[] = [];
  if (transcriptText) {
    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(transcriptText)) !== null) {
        const action = match[1].trim();
        if (action.length > 10) {
          actions.push({ action, owner: 'Not stated', deadline: 'Not stated' });
        }
      }
    }
  }

  if (actions.length > 0) {
    minutes += '| Action | Owner | Deadline |\n';
    minutes += '|--------|-------|----------|\n';
    minutes += actions.slice(0, 5).map((a) => `| ${a.action.substring(0, 60)}${a.action.length > 60 ? '...' : ''} | ${a.owner} | ${a.deadline} |`).join('\n');
  } else {
    minutes += '| Action | Owner | Deadline |\n';
    minutes += '|--------|-------|----------|\n';
    minutes += '| No specific actions recorded | - | - |';
  }

  minutes += `

## 6. Next Steps
`;

  if (type === 'disciplinary' || type === 'investigation') {
    minutes += '- Follow-up procedures as per HR policy\n';
  }
  minutes += '- Minutes to be distributed to attendees\n';
  minutes += '- Any actions to be completed as agreed';

  // Add HR-specific sections for disciplinary/investigation meetings
  if (type === 'disciplinary' || type === 'investigation') {
    minutes += `

## 7. Allegations
- **Summary of allegations presented:** Not stated
- **Employee's response:** Not stated

## 8. Evidence Presented
- **Documents or evidence discussed:** Not stated
- **Witness statements (if any):** Not stated

## 9. Mitigation Factors
- **Any mitigating circumstances raised:** Not stated

## 10. Outcome
- **Decision reached:** Not stated
- **Reasoning:** Not stated

## 11. Right of Appeal
- **Appeal process explained:** Not stated
- **Deadline for appeal:** Not stated
`;
  }

  minutes += `

---
*Minutes prepared by MinuteMate*
*Confidential - HR Records*`;

  return minutes;
}

function formatTranscriptToMinutes(transcript: string | undefined, attendees: Meeting['attendees']): string {
  if (!transcript || !transcript.trim()) {
    return '- Discussion took place (no transcript recorded)';
  }

  // Clean up the transcript
  let cleaned = transcript
    // Remove filler words and false starts
    .replace(/\b(um|uh|ah|er|hm|like|you know|I mean|sort of|kind of)\b/gi, '')
    // Remove stutters and repetitions (e.g., "the the the" → "the")
    .replace(/\b(\w+)\s+\1\s+\1+\b/gi, '$1')
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    // Fix multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Split into sentences intelligently
  const sentences = cleaned
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && s.split(' ').length > 2);

  if (sentences.length === 0) {
    return '- Discussion took place regarding the matters at hand';
  }

  // Group into thematic points (simple approach)
  const points: string[] = [];
  let currentPoint = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Start a new point if:
    // 1. Current point is getting long (30+ words)
    // 2. Sentence starts with transition words (indicating new topic)
    const isNewTopic = /^(however|additionally|furthermore|moreover|regarding|concerning|alternatively|separately|moving on|next|then)/i.test(sentence);
    const isLongEnough = currentPoint.split(' ').length > 25;
    
    if ((isNewTopic || isLongEnough) && currentPoint) {
      points.push(currentPoint);
      currentPoint = sentence;
    } else {
      currentPoint += (currentPoint ? ' ' : '') + sentence;
    }
  }
  
  if (currentPoint) points.push(currentPoint);

  // Convert to proper meeting minutes format
  return points.map((point) => {
    // Capitalize first letter
    point = point.charAt(0).toUpperCase() + point.slice(1);
    
    // Add period if missing
    if (!/[.!?]$/.test(point)) point += '.';
    
    // Convert present tense to past tense for minutes style
    point = convertToPastTense(point);
    
    return `- ${point}`;
  }).join('\n');
}

function convertToPastTense(text: string): string {
  // Simple conversions for meeting minutes style
  return text
    // "We are discussing" → "Discussed"
    .replace(/\bwe are discussing\b/gi, 'discussed')
    // "We discussed" → "Discussed" (already past tense)
    .replace(/\bwe discussed\b/gi, 'discussed')
    // "I propose" → "It was proposed"
    .replace(/\bi propose\b/gi, 'it was proposed')
    // "We need to" → "the need to"
    .replace(/\bwe need to\b/gi, 'the need to')
    // "We should" → "It was suggested that"
    .replace(/\bwe should\b/gi, 'it was suggested that')
    // "Let's" → "It was suggested to"
    .replace(/\blet's\b/gi, 'it was suggested to')
    // "We will" → "It was agreed that"
    .replace(/\bwe will\b/gi, 'it was agreed that')
    // "I suggest" → "It was suggested"
    .replace(/\bi suggest\b/gi, 'it was suggested')
    // "We agreed" → "It was agreed"
    .replace(/\bwe agreed\b/gi, 'it was agreed')
    .trim();
}

export function extractActionsFromMinutes(minutesText: string): Meeting['actions'] {
  const actions: Meeting['actions'] = [];
  
  // Look for action table in minutes
  const actionTableRegex = /\|\s*Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|[\s\S]*?(?=\n##|\n---|$)/i;
  const tableMatch = minutesText.match(actionTableRegex);
  
  if (tableMatch) {
    const lines = tableMatch[0].split('\n').filter((l: string) => l.startsWith('|') && !l.includes('Action') && !l.includes('---'));
    
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