/* =====================================================================
   AGENTS: Linear-Style AI Agent Command Center (Revelation Fintech)
   Completely clean, zero background watermark, pristine chat layout.
   ===================================================================== */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S } from '../core/store.js';
import { render } from '../shell/render.js';
import { A, IN, KEY } from '../actions/actions.js';

export const AGENTS_LIST = [
  {
    id: 'agent',
    name: 'Agent',
    role: 'Autonomous Project & Intelligence Partner',
    placeholder: 'Ask Agent…',
    examples: [
      {
        title: 'Create a new project',
        desc: 'Turn an idea into a well-scoped project',
        icon: 'folder-plus',
        prompt: 'can you create me a new project for marketing im starting it tomorrow and i needs to be finished in a week. im doing it solo its a branding project for Denta',
      },
      {
        title: 'Research a topic',
        desc: 'Research a topic across the issue backlog',
        icon: 'search',
        prompt: 'Research interchange fee compression trends and compare Stripe vs Adyen',
      },
      {
        title: 'Set up new team',
        desc: 'Create a team that matches how your organization works',
        icon: 'users',
        prompt: 'Help me configure a specialized Quantitative Risk & Compliance team workflow',
      },
    ],
  },
];

// Ephemeral in-memory state
export const agentsState = {
  messages: [],
  inputDraft: '',
  isThinking: false,
};

export function pageAgents() {
  const agent = AGENTS_LIST[0];
  const msgs = agentsState.messages;
  const thinking = agentsState.isThinking;

  return `<div class="page flush" style="display:flex;flex-direction:column;height:100%;min-height:100%;position:relative;background:var(--bg)">

    ${
      !msgs.length
        ? `<!-- Centered Linear-Style Command View -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px var(--gutter);max-width:720px;width:100%;margin:0 auto">
          
          <!-- Large Input Capsule -->
          <div class="agent-capsule" style="width:100%;padding:14px 16px;display:flex;flex-direction:column;gap:12px">
            <span class="border-beam" aria-hidden="true"></span>
            <textarea
              id="agents-input"
              class="agent-textarea"
              placeholder="${esc(agent.placeholder)}"
              rows="2"
              data-in="agentsDraft"
              data-key-enter="submitAgentChat"
              style="width:100%;font-size:15px;line-height:1.5;color:var(--text);caret-color:var(--accent)"
            >${esc(agentsState.inputDraft || '')}</textarea>

            <div class="row" style="align-items:center;justify-content:space-between;padding-top:4px">
              <div class="row" style="gap:6px">
                <button class="btn btn-secondary btn-xs" style="font-size:12px;padding:3px 8px;border-radius:6px;gap:5px;background:var(--surface-2);border:1px solid var(--border)">
                  ${ic('sparkles', 12)}
                  <span>Skills</span>
                  <span style="opacity:0.6">${ic('chevron-down', 11)}</span>
                </button>
              </div>

              <div class="row" style="gap:6px">
                <button class="ibtn ibtn-xs" style="color:var(--text-3);border-radius:6px" data-tip="Attach context" aria-label="Attach context">
                  ${ic('paperclip', 13)}
                </button>
                <button
                  class="ibtn ibtn-sm"
                  data-a="submitAgentChat"
                  style="width:26px;height:26px;border-radius:7px;background:${agentsState.inputDraft?.trim() ? 'var(--accent)' : 'var(--surface-3)'};color:${agentsState.inputDraft?.trim() ? 'var(--on-accent)' : 'var(--text-4)'};display:grid;place-items:center;transition:background var(--dur)"
                  aria-label="Send"
                >
                  ${ic('arrow-up', 14)}
                </button>
              </div>
            </div>
          </div>

          <!-- Examples Header -->
          <div style="width:100%;margin-top:28px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span class="faint" style="font-size:12px;font-weight:500;letter-spacing:0.02em">Get started with some examples</span>
          </div>

          <!-- 3-Column Example Prompt Cards -->
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;width:100%">
            ${agent.examples
              .map(
                ex => `
              <div
                class="example-card"
                data-a="sendSuggestedPrompt"
                data-prompt="${esc(ex.prompt)}"
                role="button"
                tabindex="0"
                style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:8px;text-align:left;transition:background var(--dur), border-color var(--dur);box-shadow:var(--shadow-sm)"
                onmouseover="this.style.borderColor='var(--border-strong)';this.style.background='var(--surface-2)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'"
              >
                <div style="color:var(--text-3)">${ic(ex.icon, 15)}</div>
                <div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.3">${esc(ex.title)}</div>
                <div class="faint" style="font-size:11.5px;line-height:1.4">${esc(ex.desc)}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>`
        : `<!-- Active Conversation View (Clean Linear Chat Style - No Header) -->
        <!-- Messages Area -->
        <div id="agents-chat-body" style="flex:1;overflow-y:auto;padding:24px var(--gutter);display:flex;flex-direction:column;gap:24px;scrollbar-width:thin">
          <div style="text-align:center;font-size:11px;color:var(--text-4);margin-bottom:8px">
            Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          ${msgs
            .map(m => {
              const isUser = m.role === 'user';
              if (isUser) {
                // User Prompt Pill on right
                return `<div style="display:flex;justify-content:flex-end;max-width:800px;margin:0 auto;width:100%">
                  <div style="padding:8px 14px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border-strong);color:var(--text);font-size:13.5px;line-height:1.5;max-width:70%;box-shadow:var(--shadow-sm)">
                    ${esc(m.content)}
                  </div>
                </div>`;
              }

              // Agent Response on left with execution telemetry & clean card if created
              return `<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:800px;margin:0 auto;width:100%">
                <div style="font-size:13.5px;line-height:1.6;color:var(--text);margin-bottom:12px">
                  ${m.content}
                </div>

                ${
                  m.card
                    ? `<div style="margin-top:4px;width:100%">
                      <div class="row" style="gap:6px;font-size:11.5px;color:var(--text-3);margin-bottom:8px">
                        <span>Worked for ${m.card.elapsed || '11 seconds'}</span>
                        <span style="opacity:0.6">${ic('chevron-down', 11)}</span>
                      </div>
                      <div style="font-size:11.5px;color:var(--text-3);margin-bottom:6px">Created project</div>

                      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;max-width:520px;width:100%;box-shadow:var(--shadow-sm)">
                        <div style="font-size:11px;font-family:var(--mono);color:var(--text-4);margin-bottom:3px">${esc(m.card.key)}</div>
                        <div class="row" style="gap:6px;margin-bottom:10px">
                          <span style="color:var(--amber)">${ic('folder', 13)}</span>
                          <span style="font-size:13px;font-weight:600;color:var(--text)">${esc(m.card.title)}</span>
                        </div>
                        <div class="row" style="gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--text-3)">
                          <span class="row" style="gap:4px">
                            <span class="sdot" style="background:var(--st-backlog);width:6px;height:6px;border-radius:50%"></span>
                            <span>Backlog</span>
                          </span>
                          <span class="row" style="gap:4px">
                            ${ic('briefcase', 12)}
                            <span>Axestreet</span>
                          </span>
                          <span class="row" style="gap:4px">
                            <span style="width:14px;height:14px;border-radius:50%;background:var(--accent);color:#fff;font-size:9px;display:grid;place-items:center">P</span>
                            <span>${esc(S.prefs.name || 'Owner')}</span>
                          </span>
                          <span style="color:var(--text-4)">--- No priority</span>
                          <span class="row" style="gap:4px">
                            ${ic('calendar', 11)}
                            <span>Oct 22nd</span>
                          </span>
                        </div>
                      </div>
                    </div>`
                    : ''
                }
              </div>`;
            })
            .join('')}

          ${
            thinking
              ? `<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:800px;margin:0 auto;width:100%">
                  <div class="row" style="gap:6px;font-size:12px;color:var(--text-3)">
                    <span class="btn is-loading" style="width:12px;height:12px;pointer-events:none"></span>
                    <span>Thinking…</span>
                  </div>
                </div>`
              : ''
          }
        </div>

        <!-- Sticky Bottom Chat Capsule -->
        <div style="padding:16px var(--gutter) 24px;background:transparent">
          <div class="agent-capsule" style="max-width:800px;margin:0 auto;padding:12px 14px">
            <span class="border-beam" aria-hidden="true"></span>
            <textarea
              id="agents-input"
              class="agent-textarea"
              placeholder="Reply…"
              rows="1"
              data-in="agentsDraft"
              data-key-enter="submitAgentChat"
              style="width:100%;font-size:13.5px;line-height:1.45;color:var(--text)"
            >${esc(agentsState.inputDraft || '')}</textarea>

            <div class="row" style="align-items:center;justify-content:space-between;padding-top:8px">
              <div class="row" style="gap:6px">
                <button class="btn btn-ghost btn-xs" style="font-size:11.5px;padding:2px 6px;color:var(--text-3);gap:4px">
                  ${ic('sparkles', 12)}
                  <span>Skills</span>
                  <span style="opacity:0.6">${ic('chevron-down', 10)}</span>
                </button>
              </div>

              <div class="row" style="gap:4px">
                <button class="ibtn ibtn-xs" style="color:var(--text-3);border-radius:4px" data-tip="Attach" aria-label="Attach">
                  ${ic('paperclip', 13)}
                </button>
                <button
                  class="ibtn ibtn-xs"
                  data-a="submitAgentChat"
                  style="width:24px;height:24px;border-radius:6px;background:${agentsState.inputDraft?.trim() ? 'var(--accent)' : 'var(--surface-3)'};color:${agentsState.inputDraft?.trim() ? 'var(--on-accent)' : 'var(--text-4)'};display:grid;place-items:center;transition:background var(--dur)"
                  aria-label="Send"
                >
                  ${ic('arrow-up', 13)}
                </button>
              </div>
            </div>
          </div>
        </div>`
    }
  </div>`;
}

/* Actions */
A.clearAgentChat = () => {
  agentsState.messages = [];
  render();
};

A.sendSuggestedPrompt = el => {
  const prompt = el.dataset.prompt;
  if (!prompt) return;
  agentsState.inputDraft = prompt;
  A.submitAgentChat();
};

IN.agentsDraft = el => {
  agentsState.inputDraft = el.value;
};

KEY.submitAgentChat = () => {
  A.submitAgentChat();
};

A.submitAgentChat = () => {
  const text = (agentsState.inputDraft || '').trim();
  if (!text || agentsState.isThinking) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  agentsState.messages.push({
    role: 'user',
    content: text,
    time: timeStr,
  });

  agentsState.inputDraft = '';
  agentsState.isThinking = true;
  render();

  setTimeout(() => {
    const box = document.getElementById('agents-chat-body');
    if (box) box.scrollTop = box.scrollHeight;
  }, 10);

  setTimeout(() => {
    agentsState.isThinking = false;
    const now2 = new Date();
    const timeStr2 = `${String(now2.getHours()).padStart(2, '0')}:${String(now2.getMinutes()).padStart(2, '0')}`;

    let replyObj = generateAgentReply(text);
    agentsState.messages.push({
      role: 'agent',
      content: replyObj.content,
      card: replyObj.card || null,
      time: timeStr2,
    });

    render();
    setTimeout(() => {
      const box = document.getElementById('agents-chat-body');
      if (box) box.scrollTop = box.scrollHeight;
      const inp = document.getElementById('agents-input');
      if (inp) inp.focus();
    }, 10);
  }, 600);
};

function generateAgentReply(query) {
  const q = query.toLowerCase();

  if (q.includes('how\'s it going') || q.includes('how are you') || q.includes('hello') || q.includes('hi')) {
    return {
      content: 'Going well—ready to help. What are you working on today?',
    };
  }

  if (q.includes('project') || q.includes('denta') || q.includes('marketing') || q.includes('create')) {
    const projTitle = q.includes('denta') ? 'Denta branding' : 'Marketing Launch';
    return {
      content: 'I have set up the project workspace, roadmap milestones, and initial sprint structure for you.',
      card: {
        key: 'P-REV-7',
        title: projTitle,
        elapsed: '11 seconds',
      },
    };
  }

  return {
    content: `Understood. I have scoped "${query}" and aligned it with your current workspace roadmap. Let me know if you would like me to create the corresponding task items or adjust the timeline.`,
  };
}
