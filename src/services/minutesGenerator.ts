import type { Meeting } from '../types';

export async function generateMinutes(meeting: Meeting): Promise<string> {
  // For now, we'll generate structured minutes without an API call
  // In a production app, this would call an LLM API
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
`;

  if (transcriptText && transcriptText.trim()) {
    // Extract key points from transcript
    const sentences = transcriptText.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
    const keyPoints = sentences.slice(0, Math.min(8, sentences.length));
    
    if (keyPoints.length > 0) {
      minutes += keyPoints.map((s: string) => `- ${s.trim()}`).join('\n');
    } else {
      minutes += '- Discussion took place as per transcript';
    }
  } else {
    minutes += '- No transcript available';
  }

  minutes += `

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
